#!/usr/bin/env node
// Cortex MCP server  -  the all-inclusive connector and multi-agent hub. Exposes the
// full Cortex memory plane (recall, remember, ingest, list, timeline, tags, digest,
// connections, extraction, head, forget, verify-stamp, dream, verify), the agent
// collaboration layer (roster, durable task board, message bus, run-step) so MCP
// hosts and external agents communicate through shared Walrus memory, and outbound
// bridges (web_fetch, service_notify, service_export). Also publishes MCP Resources
// and Prompts. Optional dep: @modelcontextprotocol/sdk. Mock unless config is wired.

import {
  loadConfig,
  isLive,
  createClients,
  openCortex,
  ingestSource,
  runDream,
  applyDiff,
  verify,
  getExtraction,
  seedDemo,
  importExternal,
  AGENTS,
  createTask,
  listTasks,
  getTask,
  observeTask,
  handoffTask,
  completeTask,
  postMessage,
  listMessages,
  runAndRecordStep,
  createLoop,
  listLoops,
  getLoop,
  runLoopStep,
  stopLoop,
  readUserAccount,
  executorGrantKbAccess,
  executorRenewKbFile,
} from "./src/core";
import { createServer } from "node:http";
import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import {
  authServerMetadata,
  protectedResourceMetadata,
  registerClient,
  mintAuthCode,
  exchangeToken,
  personalAccessToken,
  userFromBearer,
  verifyJwt,
  verifySuiConsent,
  type UserContext,
} from "./auth";

const DEFAULT_PERIOD = { from: "0000", to: "9999" };
const SUMMARY_RECENT_LIMIT = 20;
const FETCH_TIMEOUT_MS = 30_000;
const RESOURCE_MIME = "application/json";
const MCP_PATH = "/mcp";
const HTTP_PORT = 8787;
const ENV_FILE = process.env.CORTEX_ENV_FILE ?? ".env";

// "Recall everything / what do you know about me" intent: such questions want the
// whole memory set, not the top-K semantic matches, so memory_recall returns the
// full namespace instead. Mirrors isRecallAllIntent in the frontend's logic.ts.
const RECALL_ALL_RE = new RegExp(
  [
    "\\beverything\\b",
    "\\bevery memory\\b",
    "\\ball (of )?(my |the )?memories\\b",
    "\\blist (all|my|every|everything)\\b",
    "\\brecall (all|everything)\\b",
    "\\bshow (me )?(all|everything)\\b",
    "\\bwhat have i (told|said)\\b",
    "\\bwhat do you have on me\\b",
    "what do you (know|remember)( about (me|us))?\\s*\\??$",
  ].join("|"),
  "i",
);
function isRecallAllIntent(query: string): boolean {
  return RECALL_ALL_RE.test(query.trim());
}

// Load the MCP's own .env (CORTEX_ENV_FILE to point elsewhere) before reading config.
if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);

const cfg = loadConfig();
const live = isLive(cfg);
const c = createClients(cfg);
const cortex = openCortex(cfg);

// Managed OAuth (HTTP transport only). It turns on when a public URL is set, so
// the stdio / local-HTTP paths keep working unauthenticated against the
// configured account. The token-signing secret is derived from the delegate key
// unless one is provided explicitly.
const OAUTH_PUBLIC_URL = (
  process.env.CORTEX_MCP_PUBLIC_URL ?? ""
).replace(/\/$/, "");
const OAUTH_APP_URL = (
  process.env.CORTEX_APP_URL ?? "https://app.usecortexai.com"
).replace(/\/$/, "");
const OAUTH_ENABLED = OAUTH_PUBLIC_URL.length > 0;
const OAUTH_SECRET =
  process.env.CORTEX_OAUTH_SECRET ||
  createHash("sha256")
    .update(`cortex-mcp-oauth:${cfg.delegateKey}`)
    .digest("hex");

interface StoredConnectionRecord {
  id?: unknown;
}

function hasConnectionRecord(raw: string | undefined, connectionId: string): boolean {
  if (!raw || !connectionId) return false;
  try {
    const parsed = JSON.parse(raw) as StoredConnectionRecord[];
    return (
      Array.isArray(parsed) &&
      parsed.some((entry) => typeof entry?.id === "string" && entry.id === connectionId)
    );
  } catch {
    return false;
  }
}

async function isConnectionActive(userCtx: UserContext): Promise<boolean> {
  // Allow legacy tokens with no connection id to keep working until they expire.
  if (!userCtx.connectionId) return true;
  // The connection record is written on-chain during consent; the server's read
  // node can lag that write by a few seconds, so a token minted moments ago would
  // look "revoked". Re-read once after a short delay before denying. A genuinely
  // revoked connection stays absent and is still rejected.
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 2500));
    const account = await readUserAccount(cfg, userCtx.address);
    const raw = account?.settings["mcp:connections"];
    if (hasConnectionRecord(raw, userCtx.connectionId)) return true;
    console.error(
      `[mcp-auth] connection miss attempt=${attempt} addr=${userCtx.address.slice(0, 12)} ` +
        `account=${account ? account.accountId.slice(0, 12) : "NULL"} ` +
        `connections=${raw ? raw.slice(0, 160) : "none"} cid=${userCtx.connectionId.slice(0, 10)}`,
    );
  }
  return false;
}

async function main() {
  const { McpServer } = await importExternal(
    "@modelcontextprotocol/sdk/server/mcp.js",
  );
  const { StdioServerTransport } = await importExternal(
    "@modelcontextprotocol/sdk/server/stdio.js",
  );
  const { z } = await importExternal("zod");

  const text = (s: string) => ({
    content: [{ type: "text" as const, text: s }],
  });
  const json = (value: unknown) => text(JSON.stringify(value, null, 2));
  const resource = (uri: string, value: unknown) => ({
    contents: [
      {
        uri,
        mimeType: RESOURCE_MIME,
        text: JSON.stringify(value, null, 2),
      },
    ],
  });

  // The server's own wallet (admin identity): the delegate keypair that signs Sui
  // transactions and pays for Walrus writes.
  const delegateAddress = async (): Promise<string | null> => {
    if (!cfg.delegateKey) return null;
    try {
      const ed: any = await importExternal("@mysten/sui/keypairs/ed25519");
      return ed.Ed25519Keypair.fromSecretKey(cfg.delegateKey)
        .getPublicKey()
        .toSuiAddress();
    } catch {
      return null;
    }
  };

  if (!live) await seedDemo(c, cfg);

  // The configured-account clients (used for stdio / unauthenticated HTTP, and as
  // the base each per-user session is cloned from).
  const globalCfg = cfg;
  const globalClients = c;
  const globalCortex = cortex;

  // A fresh, fully-configured McpServer. The stdio path builds one; the hosted
  // HTTP path builds one per client session (each transport binds one server).
  // When a session is bound to an authenticated OAuth user, cfg + clients are
  // shadowed with that user's namespace and MemWal account, so every tool below
  // (which closes over `cfg` and `c`) acts on the caller's own memory.
  const buildServer = (userCtx?: UserContext) => {
    const cfg = userCtx
      ? {
          ...globalCfg,
          namespace: userCtx.namespace,
          memwal: { ...globalCfg.memwal, accountId: userCtx.memwalAccountId },
          userAddress: userCtx.address,
        }
      : globalCfg;
    const c = userCtx ? createClients(cfg) : globalClients;
    const cortex = userCtx ? openCortex(cfg) : globalCortex;
    const server = new McpServer({ name: "cortex-memory", version: "0.3.0" });

  // ---- memory: write / consolidate / verify ----
  server.tool(
    "memory_recall",
    "Recall memories from the namespace (verified-first). For 'everything / what do you know about me' style questions, returns the full set instead of the top matches.",
    { query: z.string().optional(), limit: z.number().optional() },
    async ({ query, limit }: any) => {
      const q = query ?? "";
      // "Recall everything" intent wants the whole set, not focused top-K. Read the
      // full namespace (restore = broad recall) so nothing is dropped to a low limit.
      if (isRecallAllIntent(q)) {
        const all = await cortex.memories();
        return json(all);
      }
      const recs = await c.memwal.recall(cfg.namespace, q, { limit });
      return json(recs);
    },
  );
  server.tool(
    "memory_remember",
    "Write a durable memory.",
    { text: z.string() },
    async ({ text: body }: any) => {
      const r = await c.memwal.remember(cfg.namespace, body, {
        agent: "mcp-client",
      });
      return text(`remembered ${r.memoryId}`);
    },
  );
  server.tool(
    "memory_ingest",
    "Ingest a note/document and extract memories from it.",
    { text: z.string(), title: z.string().optional() },
    async ({ text: body, title }: any) => {
      const r = await ingestSource(c, cfg, {
        type: "note",
        uri: "mcp://" + (title ?? "note"),
        title,
        text: body,
        hint: title,
      });
      return text(
        `ingested ${r.source.id}: ${r.memoryIds.length} memories. ${r.extraction.summary}`,
      );
    },
  );
  server.tool(
    "dream_run",
    "Consolidate memory. Commits a diff first; applies only if apply=true.",
    { apply: z.boolean().optional() },
    async ({ apply }: any) => {
      const { diff } = await runDream(c, cfg);
      let extra = "";
      if (apply) {
        const a = await applyDiff(c, diff);
        extra = ` Applied ${a.applied}; head ${a.newHead}.`;
      }
      return text(
        `dream ${diff.diffId}: ${diff.operations.length} ops.${extra}`,
      );
    },
  );
  server.tool(
    "verify_memory",
    "Verify all blobs are fetchable from the public aggregator.",
    {},
    async () => {
      const v = await verify(c, cfg);
      return text(`${v.fetched}/${v.total} blobs fetchable. head ${v.head}.`);
    },
  );

  server.tool(
    "memory_forget",
    "De-index a memory (tombstone). The raw record stays on Walrus; recall stops surfacing it.",
    { memoryId: z.string(), reason: z.string().optional() },
    async ({ memoryId, reason }: any) => {
      await c.memwal.tombstone(
        cfg.namespace,
        memoryId,
        reason ?? "forgotten via mcp",
      );
      return text(`forgot ${memoryId}`);
    },
  );
  server.tool(
    "memory_verify_stamp",
    "Stamp a memory as verified at a given time (defaults to now).",
    { memoryId: z.string(), at: z.string().optional() },
    async ({ memoryId, at }: any) => {
      const when = at ?? new Date().toISOString();
      await c.memwal.stampVerified(cfg.namespace, memoryId, when);
      return text(`verified ${memoryId} @ ${when}`);
    },
  );

  // ---- memory: read views over the Cortex facade ----
  server.tool(
    "memory_list",
    "List all live memories in the namespace.",
    {},
    async () => json(await cortex.memories()),
  );
  server.tool(
    "memory_timeline",
    "Version history (manifest versions) for the namespace.",
    {},
    async () => json(await cortex.timeline()),
  );
  server.tool(
    "memory_tags",
    "Tag frequencies across live memories.",
    {},
    async () => json(await cortex.tags()),
  );
  server.tool(
    "memory_digest",
    "Period digest of memories. Optional from/to bound the window.",
    { from: z.string().optional(), to: z.string().optional() },
    async ({ from, to }: any) =>
      json(
        await cortex.digest({
          from: from ?? DEFAULT_PERIOD.from,
          to: to ?? DEFAULT_PERIOD.to,
        }),
      ),
  );
  server.tool(
    "memory_connections",
    "Inferred relations between live memories.",
    {},
    async () => json(await cortex.connections()),
  );
  server.tool(
    "memory_extraction",
    "Fetch the extraction artifact stored at a Walrus blob id.",
    { blobId: z.string() },
    async ({ blobId }: any) => json(await getExtraction(c, blobId)),
  );
  server.tool(
    "memory_head",
    "Current head (latest committed version hash) of the namespace.",
    {},
    async () => {
      const head = await cortex.head();
      return json({ namespace: cfg.namespace, head, live });
    },
  );

  // ---- multi-agent hub: the team, the durable task board, and the message bus ----
  // Tasks and messages persist as event-sourced MemWal records in dedicated
  // sub-namespaces, so every MCP host and external agent collaborates over the same
  // Walrus-backed state.
  server.tool(
    "agent_list",
    "List the specialist agents (id, name, role, blurb) that share this memory.",
    {},
    async () =>
      json(
        AGENTS.map((a) => ({
          id: a.id,
          name: a.name,
          role: a.role,
          blurb: a.blurb,
        })),
      ),
  );
  server.tool(
    "task_create",
    "Open a task and assign it to an agent. Returns the durable task record.",
    {
      goal: z.string(),
      assignTo: z.string(),
      createdBy: z.string().optional(),
    },
    async ({ goal, assignTo, createdBy }: any) =>
      json(await createTask(c, cfg, { goal, assignTo, createdBy })),
  );
  server.tool(
    "task_list",
    "List the team's tasks (latest revision of each), newest first.",
    {},
    async () => json(await listTasks(c, cfg)),
  );
  server.tool(
    "task_get",
    "Fetch one task by id, including its observations and outputs.",
    { taskId: z.string() },
    async ({ taskId }: any) => json(await getTask(c, cfg, taskId)),
  );
  server.tool(
    "task_observe",
    "Append an observation to a task as a given agent (records what was found/done).",
    { taskId: z.string(), agentId: z.string(), text: z.string() },
    async ({ taskId, agentId, text: body }: any) =>
      json(await observeTask(c, cfg, { taskId, agentId, text: body })),
  );
  server.tool(
    "task_handoff",
    "Reassign a task to another agent so they continue it. Posts a handoff to the bus.",
    { taskId: z.string(), toAgentId: z.string() },
    async ({ taskId, toAgentId }: any) =>
      json(await handoffTask(c, cfg, { taskId, toAgentId })),
  );
  server.tool(
    "task_complete",
    "Mark a task done, rolling its latest observation into the task's outputs.",
    { taskId: z.string() },
    async ({ taskId }: any) => json(await completeTask(c, cfg, taskId)),
  );
  server.tool(
    "agent_run_step",
    "Run one collaborative step: the assigned (or named) agent recalls shared memory, reasons, and records an observation + a bus message.",
    {
      taskId: z.string(),
      agentId: z.string().optional(),
      recallLimit: z.number().optional(),
    },
    async ({ taskId, agentId, recallLimit }: any) =>
      json(await runAndRecordStep(c, cfg, { taskId, agentId, recallLimit })),
  );
  server.tool(
    "agent_message_post",
    "Post a message to the durable agent bus (from/to may be an agent id, 'user', or 'team').",
    {
      from: z.string(),
      to: z.string(),
      taskId: z.string(),
      kind: z.enum(["handoff", "note", "result"]),
      content: z.string(),
    },
    async ({ from, to, taskId, kind, content }: any) =>
      json(await postMessage(c, cfg, { from, to, taskId, kind, content })),
  );
  server.tool(
    "agent_message_list",
    "Read the agent message bus, newest first. Optionally filter by taskId.",
    { taskId: z.string().optional(), limit: z.number().optional() },
    async ({ taskId, limit }: any) =>
      json(await listMessages(c, cfg, { taskId, limit })),
  );

  // ---- agentic loops: long-running, self-correcting agents over the Workspace ----
  // A loop is a durable LoopRun persisted in the same Workspace as the task board
  // (loops_blob). Each step runs the five-step sense→decide→act→gather→verify cycle as
  // the executor, so an external host can spawn a loop, watch its trace, and stop it.
  server.tool(
    "loop_create",
    "Spawn an agentic loop over the shared Workspace and register it as a draft. Pass a templateId (keep-tests-green, research-monitor) to shape its gates/budget, or omit it for the deterministic skeleton.",
    {
      goal: z.string(),
      agentId: z.string(),
      templateId: z.enum(["keep-tests-green", "research-monitor"]).optional(),
    },
    async ({ goal, agentId, templateId }: any) =>
      json(await createLoop(c, cfg, { goal, agentId, templateId })),
  );
  server.tool(
    "loop_list",
    "List the durable loop runs in the Workspace (spec, status, iterations), newest first.",
    {},
    async () => json(await listLoops(c, cfg)),
  );
  server.tool(
    "loop_get",
    "Fetch one loop run by id, including its full five-step iteration trace and rubric.",
    { loopId: z.string() },
    async ({ loopId }: any) => json(await getLoop(c, cfg, loopId)),
  );
  server.tool(
    "loop_run_step",
    "Advance a loop by one iteration as the executor: sense, run the agent step, gather, verify against the gate, and record the result. Returns the updated run, status, and verdict.",
    { loopId: z.string() },
    async ({ loopId }: any) => json(await runLoopStep(c, cfg, loopId)),
  );
  server.tool(
    "loop_stop",
    "Pause a running loop so the scheduler stops firing it; a human resumes it by stepping it again. Done/gave-up loops are returned unchanged.",
    { loopId: z.string() },
    async ({ loopId }: any) => json(await stopLoop(c, cfg, loopId)),
  );

  // ---- outbound connectors: bridge Cortex to other services ----
  server.tool(
    "web_fetch",
    "Fetch a URL and return its text. With ingest=true, the fetched content also becomes durable memory.",
    { url: z.string().url(), ingest: z.boolean().optional() },
    async ({ url, ingest }: any) => {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok)
        throw new Error(`fetch ${url} failed: ${res.status} ${res.statusText}`);
      const body = await res.text();
      if (!ingest) return text(body);
      const r = await ingestSource(c, cfg, {
        type: "url",
        uri: url,
        title: url,
        text: body,
        hint: url,
      });
      return text(
        `fetched ${url} (${body.length} bytes), ingested ${r.source.id}: ${r.memoryIds.length} memories.`,
      );
    },
  );
  server.tool(
    "service_notify",
    "POST a JSON payload to the configured CORTEX_WEBHOOK_URL (Slack/Discord/Zapier).",
    { event: z.string(), payload: z.record(z.unknown()).optional() },
    async ({ event, payload }: any) => {
      if (!cfg.webhookUrl)
        throw new Error(
          "service_notify needs CORTEX_WEBHOOK_URL set (Slack/Discord/Zapier incoming webhook). It is currently unset.",
        );
      const body = {
        source: "cortex-mcp",
        namespace: cfg.namespace,
        event,
        payload: payload ?? {},
        at: new Date().toISOString(),
      };
      const res = await fetch(cfg.webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok)
        throw new Error(
          `webhook POST failed: ${res.status} ${res.statusText}`,
        );
      return text(`notified ${event} -> ${res.status}`);
    },
  );
  server.tool(
    "service_export",
    "Return a portable JSON bundle (namespace, head, memories) for syncing into other tools.",
    {},
    async () => {
      const [memories, head] = await Promise.all([
        cortex.memories(),
        cortex.head(),
      ]);
      return json({
        kind: "cortex.export.v1",
        namespace: cfg.namespace,
        head,
        live,
        exportedAt: new Date().toISOString(),
        memories,
      });
    },
  );

  // ---- low-level execution: the MCP wallet acts directly on Walrus + Sui + MemWal ----
  // These run under the server's own admin wallet (cfg.delegateKey), so an external
  // agent can store blobs, record on-chain pointers, and read raw state directly.
  server.tool(
    "wallet_info",
    "The MCP server's own Sui wallet (admin identity), network, and live status.",
    {},
    async () =>
      json({
        namespace: cfg.namespace,
        live,
        hasWallet: !!cfg.delegateKey,
        address: await delegateAddress(),
        network: cfg.sui.network,
        suiRpc: cfg.sui.rpc,
        walrusAggregator: cfg.walrus.aggregator,
        accessRegistry: cfg.accessRegistryId,
        executorCap: cfg.executorCapId,
      }),
  );
  server.tool(
    "walrus_put_blob",
    "Store raw bytes on Walrus using the server wallet. data is utf8 by default; set encoding=base64 for binary. Returns the blob id.",
    { data: z.string(), encoding: z.enum(["utf8", "base64"]).optional() },
    async ({ data, encoding }: any) => {
      const bytes =
        encoding === "base64"
          ? new Uint8Array(Buffer.from(data, "base64"))
          : new TextEncoder().encode(data);
      const blobId = await c.walrus.putBlob(bytes);
      return json({ blobId, bytes: bytes.length });
    },
  );
  server.tool(
    "walrus_get_blob",
    "Fetch a raw Walrus blob by id. Returns base64 by default; set encoding=utf8 for text.",
    { blobId: z.string(), encoding: z.enum(["utf8", "base64"]).optional() },
    async ({ blobId, encoding }: any) => {
      const bytes = await c.walrus.getBlob(blobId);
      const out =
        encoding === "utf8"
          ? new TextDecoder().decode(bytes)
          : Buffer.from(bytes).toString("base64");
      return json({
        blobId,
        encoding: encoding ?? "base64",
        bytes: bytes.length,
        data: out,
      });
    },
  );
  server.tool(
    "sui_record_pointer",
    "Record a namespace → manifest blob pointer on Sui, signed by the server wallet. Returns the transaction digest.",
    { namespace: z.string().optional(), manifestBlobId: z.string() },
    async ({ namespace, manifestBlobId }: any) => {
      const ns = namespace ?? cfg.namespace;
      const digest = await c.sui.recordManifest(ns, manifestBlobId);
      return json({ namespace: ns, manifestBlobId, digest });
    },
  );
  server.tool(
    "kb_grant_access",
    "Grant a delegate read access to a shared KbFile, acting as the executor (cfg.executorCapId). Returns the transaction digest.",
    { kbFileId: z.string(), delegate: z.string() },
    async ({ kbFileId, delegate }: any) => {
      const digest = await executorGrantKbAccess(cfg, kbFileId, delegate);
      return json({ kbFileId, delegate, digest });
    },
  );
  server.tool(
    "kb_renew",
    "Extend a shared KbFile's Walrus storage to a later end epoch, acting as the executor (cfg.executorCapId). Returns the transaction digest.",
    { kbFileId: z.string(), newEndEpoch: z.number().int().positive() },
    async ({ kbFileId, newEndEpoch }: any) => {
      const digest = await executorRenewKbFile(cfg, kbFileId, newEndEpoch);
      return json({ kbFileId, newEndEpoch, digest });
    },
  );
  server.tool(
    "sui_read_pointer",
    "Read the on-chain manifest pointer for a namespace.",
    { namespace: z.string().optional() },
    async ({ namespace }: any) =>
      json(await c.sui.readManifestPointer(namespace ?? cfg.namespace)),
  );
  server.tool(
    "memwal_restore",
    "Restore the full namespace head + memories (including tombstoned) straight from MemWal.",
    { namespace: z.string().optional() },
    async ({ namespace }: any) =>
      json(await c.memwal.restore(namespace ?? cfg.namespace)),
  );

  // ---- authorized user access: read a granting user's profile, memory, context ----
  // The MCP reads with its own admin wallet (cfg.delegateKey). Once a user grants it
  // via account::grant_admin, these tools surface that user's public on-chain account,
  // distilled MemWal facts, and durable context pointers.
  const CONTEXT_POINTER_KEYS = [
    "sessions:index",
    "events:current",
    "docs:current",
    "agents:tasks",
    "agents:bus",
  ];
  const CONTEXT_NOTE =
    "These pointers reference Seal/AES-encrypted Walrus blobs; decrypting the verbatim transcripts requires the user's own key (owner-only). The MCP works from user_memory (the distilled facts) for context.";

  server.tool(
    "user_profile",
    "Read an authorized user's public on-chain account: profile (display name, handle, bio), MemWal account pointer, and which durable context keys exist.",
    { address: z.string() },
    async ({ address }: any) => {
      const account = await readUserAccount(cfg, address);
      if (!account)
        return text(
          `No on-chain account found for ${address}. The Cortex contracts must be deployed (seal.policyPackage set) and the user must own an account::Account object granting this MCP admin access.`,
        );
      return json(account);
    },
  );
  server.tool(
    "user_memory",
    "Recall an authorized user's distilled memory facts from their shared MemWal namespace.",
    {
      namespace: z.string().optional(),
      query: z.string().optional(),
      limit: z.number().optional(),
    },
    async ({ namespace, query, limit }: any) =>
      json(
        await c.memwal.recall(namespace ?? cfg.namespace, query ?? "", {
          limit,
        }),
      ),
  );
  server.tool(
    "user_context",
    "Read an authorized user's durable CONTEXT pointers (blob-id pointers to their sessions, events, docs, and agent state) from the on-chain account settings.",
    { address: z.string() },
    async ({ address }: any) => {
      const account = await readUserAccount(cfg, address);
      if (!account)
        return text(
          `No on-chain account found for ${address}. The Cortex contracts must be deployed (seal.policyPackage set) and the user must own an account::Account object granting this MCP admin access.`,
        );
      const contextPointers: Record<string, string> = {};
      for (const key of CONTEXT_POINTER_KEYS) {
        const value = account.settings[key];
        if (value) contextPointers[key] = value;
      }
      return json({
        accountId: account.accountId,
        namespace: cfg.namespace,
        contextPointers,
        note: CONTEXT_NOTE,
      });
    },
  );

  // ---- resources: browse Cortex memory as MCP resources ----
  server.registerResource(
    "memory",
    "cortex://memory",
    {
      title: "Cortex live memories",
      description: "All live memories in the namespace.",
      mimeType: RESOURCE_MIME,
    },
    async (uri: any) => resource(uri.href, await cortex.memories()),
  );
  server.registerResource(
    "timeline",
    "cortex://timeline",
    {
      title: "Cortex timeline",
      description: "Version history (manifest versions) for the namespace.",
      mimeType: RESOURCE_MIME,
    },
    async (uri: any) => resource(uri.href, await cortex.timeline()),
  );
  server.registerResource(
    "digest",
    "cortex://digest",
    {
      title: "Cortex digest",
      description: "Full-period digest of the namespace's memories.",
      mimeType: RESOURCE_MIME,
    },
    async (uri: any) => resource(uri.href, await cortex.digest()),
  );
  server.registerResource(
    "agents",
    "cortex://agents",
    {
      title: "Cortex agent team",
      description: "The specialist agents that share this memory.",
      mimeType: RESOURCE_MIME,
    },
    async (uri: any) => resource(uri.href, AGENTS),
  );
  server.registerResource(
    "tasks",
    "cortex://tasks",
    {
      title: "Cortex task board",
      description: "The team's durable tasks (latest revision of each).",
      mimeType: RESOURCE_MIME,
    },
    async (uri: any) => resource(uri.href, await listTasks(c, cfg)),
  );

  // ---- prompts ----
  server.registerPrompt(
    "summarize_memory",
    {
      title: "Summarize recent memory",
      description: "Pull recent memories into a summarization prompt.",
      argsSchema: { limit: z.string().optional() },
    },
    async ({ limit }: any) => {
      const n = limit ? Number(limit) : SUMMARY_RECENT_LIMIT;
      const recs = await cortex.recall("", Number.isFinite(n) ? n : SUMMARY_RECENT_LIMIT);
      const lines = recs.map((m) => `- ${m.text}`).join("\n");
      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `Summarize the key themes across these Cortex memories from namespace "${cfg.namespace}":\n\n${lines}`,
            },
          },
        ],
      };
    },
  );
  server.registerPrompt(
    "daily_digest",
    {
      title: "Daily digest",
      description: "Turn the namespace digest into a concise daily briefing.",
      argsSchema: {},
    },
    async () => {
      const digest = await cortex.digest();
      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `Write a concise daily briefing from this Cortex digest:\n\n${JSON.stringify(digest, null, 2)}`,
            },
          },
        ],
      };
    },
  );

    return server;
  };

  const toolSummary =
    `  memory: memory_recall, memory_remember, memory_ingest, memory_forget, ` +
    `memory_verify_stamp, memory_list, memory_timeline, memory_tags, memory_digest, ` +
    `memory_connections, memory_extraction, memory_head, dream_run, verify_memory\n` +
    `  agents: agent_list, task_create, task_list, task_get, task_observe, task_handoff, ` +
    `task_complete, agent_run_step, agent_message_post, agent_message_list\n` +
    `  loops: loop_create, loop_list, loop_get, loop_run_step, loop_stop\n` +
    `  execution: wallet_info, walrus_put_blob, walrus_get_blob, sui_record_pointer, ` +
    `sui_read_pointer, kb_grant_access, kb_renew, memwal_restore\n` +
    `  users: user_profile, user_memory, user_context\n` +
    `  connectors: web_fetch, service_notify, service_export\n` +
    `  resources: cortex://memory, cortex://timeline, cortex://digest, cortex://agents, cortex://tasks\n` +
    `  prompts: summarize_memory, daily_digest`;

  // Hosted transport: a Streamable-HTTP MCP endpoint at /mcp. Each client session
  // gets its own transport + server (the SDK binds one transport per server), keyed
  // by the Mcp-Session-Id header the SDK assigns on initialize.
  const startHttp = async () => {
    const { StreamableHTTPServerTransport } = await importExternal(
      "@modelcontextprotocol/sdk/server/streamableHttp.js",
    );
    const { isInitializeRequest } = await importExternal(
      "@modelcontextprotocol/sdk/types.js",
    );
    const port = Number(process.env.PORT ?? process.env.MCP_PORT ?? HTTP_PORT);
    const sessions = new Map<string, any>();

    const readBody = (req: any): Promise<unknown> =>
      new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          if (!raw) return resolve(undefined);
          try {
            resolve(JSON.parse(raw));
          } catch (err) {
            reject(err);
          }
        });
        req.on("error", reject);
      });
    const sendJson = (res: any, status: number, body: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    // The /token endpoint receives application/x-www-form-urlencoded per OAuth;
    // accept JSON too. Reads the raw body (do not also call readBody on the same req).
    const readParams = (req: any): Promise<Record<string, string>> =>
      new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          const ctype = String(req.headers["content-type"] ?? "");
          if (ctype.includes("application/json")) {
            try {
              resolve(JSON.parse(raw || "{}"));
            } catch {
              resolve({});
            }
            return;
          }
          resolve(Object.fromEntries(new URLSearchParams(raw)));
        });
        req.on("error", reject);
      });

    const httpServer = createServer(async (req: any, res: any) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "content-type, mcp-session-id, mcp-protocol-version, authorization",
      );
      res.setHeader("Access-Control-Expose-Headers", "mcp-session-id");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }
      const path = new URL(req.url ?? "/", "http://localhost").pathname;
      const issuer =
        OAUTH_PUBLIC_URL || `http://${req.headers.host ?? "localhost"}`;
      const resourceUrl = `${issuer}${MCP_PATH}`;

      // ---- OAuth 2.1 endpoints (managed, stateless; see auth.ts) ----
      if (OAUTH_ENABLED) {
        try {
          if (
            req.method === "GET" &&
            path === "/.well-known/oauth-authorization-server"
          ) {
            sendJson(res, 200, authServerMetadata(issuer));
            return;
          }
          if (
            req.method === "GET" &&
            path === "/.well-known/oauth-protected-resource"
          ) {
            sendJson(res, 200, protectedResourceMetadata(resourceUrl, issuer));
            return;
          }
          if (req.method === "POST" && path === "/register") {
            const body = ((await readBody(req)) ?? {}) as Record<string, unknown>;
            sendJson(res, 201, registerClient(body));
            return;
          }
          if (req.method === "GET" && path === "/authorize") {
            // Hand the user to the Cortex web consent page (where the Privy wallet
            // lives), preserving the OAuth request so /connect can complete it.
            const q = new URL(req.url ?? "/", issuer).searchParams;
            const consent = new URL(`${OAUTH_APP_URL}/connect`);
            for (const k of [
              "response_type",
              "client_id",
              "redirect_uri",
              "code_challenge",
              "code_challenge_method",
              "state",
              "scope",
            ]) {
              const v = q.get(k);
              if (v) consent.searchParams.set(k, v);
            }
            consent.searchParams.set("mcp", resourceUrl);
            res.writeHead(302, { location: consent.toString() });
            res.end();
            return;
          }
          if (req.method === "POST" && path === "/oauth/grant") {
            // The consent page calls this after the user signs. The Sui signature
            // is the authentication; on success we mint the auth code + redirect.
            const b = ((await readBody(req)) ?? {}) as Record<string, string>;
            const address = b.address ?? "";
            const codeChallenge = b.code_challenge ?? "";
            const signature = b.signature ?? "";
            const redirectUri = b.redirect_uri ?? "";
            const memwalAccountId = b.memwalAccountId ?? "";
            const connectionId = b.connectionId ?? "";
            if (
              !address ||
              !codeChallenge ||
              !signature ||
              !redirectUri ||
              !connectionId
            ) {
              sendJson(res, 400, { error: "invalid_request" });
              return;
            }
            const ok = await verifySuiConsent(address, codeChallenge, signature);
            if (!ok) {
              sendJson(res, 401, { error: "invalid_consent" });
              return;
            }
            const code = mintAuthCode(
              OAUTH_SECRET,
              {
                address,
                namespace: b.namespace || address,
                memwalAccountId,
                connectionId,
              },
              codeChallenge,
              redirectUri,
            );
            const redirect = new URL(redirectUri);
            redirect.searchParams.set("code", code);
            if (b.state) redirect.searchParams.set("state", b.state);
            sendJson(res, 200, { redirect: redirect.toString() });
            return;
          }
          if (req.method === "POST" && path === "/oauth/personal-token") {
            // The dashboard calls this so the user can copy a static Bearer for MCP
            // clients that don't run the OAuth flow. Same Sui-signature proof as
            // /oauth/grant; we mint a long-lived access token instead of a code.
            const b = ((await readBody(req)) ?? {}) as Record<string, string>;
            const address = b.address ?? "";
            const codeChallenge = b.code_challenge ?? "";
            const signature = b.signature ?? "";
            const connectionId = b.connectionId ?? "";
            if (!address || !codeChallenge || !signature || !connectionId) {
              sendJson(res, 400, { error: "invalid_request" });
              return;
            }
            const ok = await verifySuiConsent(address, codeChallenge, signature);
            if (!ok) {
              sendJson(res, 401, { error: "invalid_consent" });
              return;
            }
            sendJson(
              res,
              200,
              personalAccessToken(OAUTH_SECRET, {
                address,
                namespace: b.namespace || address,
                memwalAccountId: b.memwalAccountId ?? "",
                connectionId,
              }),
            );
            return;
          }
          if (req.method === "POST" && path === "/token") {
            const params = await readParams(req);
            const grant =
              params.grant_type === "refresh_token"
                ? verifyJwt(OAUTH_SECRET, params.refresh_token ?? "")
                : verifyJwt(OAUTH_SECRET, params.code ?? "");
            if (grant?.sub && grant?.cid) {
              const active = await isConnectionActive({
                address: String(grant.sub),
                namespace: String(grant.ns ?? ""),
                memwalAccountId: String(grant.acct ?? ""),
                connectionId: String(grant.cid),
              });
              if (!active) {
                sendJson(res, 400, {
                  error: "invalid_grant",
                  error_description: "Connection has been revoked.",
                });
                return;
              }
            }
            const result = exchangeToken(OAUTH_SECRET, params);
            if (!result.ok) {
              sendJson(res, 400, {
                error: result.error,
                error_description: result.description,
              });
              return;
            }
            sendJson(res, 200, result.tokens);
            return;
          }
        } catch (err) {
          if (!res.headersSent) sendJson(res, 500, { error: String(err) });
          return;
        }
      }

      if (path !== MCP_PATH) {
        sendJson(res, 404, { error: "not found" });
        return;
      }
      // When OAuth is on, every MCP request must carry a valid Bearer; the 401 +
      // WWW-Authenticate points Claude at the protected-resource metadata so it
      // starts the OAuth flow. The resolved user scopes the session's tools.
      let userCtx: UserContext | undefined;
      if (OAUTH_ENABLED) {
        userCtx =
          userFromBearer(OAUTH_SECRET, req.headers["authorization"]) ?? undefined;
        if (!userCtx) {
          res.setHeader(
            "WWW-Authenticate",
            `Bearer resource_metadata="${issuer}/.well-known/oauth-protected-resource"`,
          );
          sendJson(res, 401, { error: "unauthorized" });
          return;
        }
        if (!(await isConnectionActive(userCtx))) {
          sendJson(res, 401, { error: "connection_revoked" });
          return;
        }
      }
      const sid = req.headers["mcp-session-id"] as string | undefined;
      try {
        if (req.method === "POST") {
          const body = await readBody(req);
          let transport = sid ? sessions.get(sid) : undefined;
          if (!transport) {
            if (!isInitializeRequest(body)) {
              sendJson(res, 400, {
                jsonrpc: "2.0",
                error: {
                  code: -32000,
                  message: "No valid session — send an initialize request first.",
                },
                id: null,
              });
              return;
            }
            transport = new StreamableHTTPServerTransport({
              sessionIdGenerator: () => randomUUID(),
              onsessioninitialized: (id: string) => sessions.set(id, transport),
            });
            transport.onclose = () => {
              if (transport.sessionId) sessions.delete(transport.sessionId);
            };
            await buildServer(userCtx).connect(transport);
          }
          await transport.handleRequest(req, res, body);
        } else if (req.method === "GET" || req.method === "DELETE") {
          const transport = sid ? sessions.get(sid) : undefined;
          if (!transport) {
            sendJson(res, 400, { error: "Unknown or missing mcp-session-id" });
            return;
          }
          await transport.handleRequest(req, res);
        } else {
          sendJson(res, 405, { error: "method not allowed" });
        }
      } catch (err) {
        if (!res.headersSent) sendJson(res, 500, { error: String(err) });
      }
    });
    httpServer.listen(port, () =>
      console.error(
        `cortex-mcp HTTP listening on http://localhost:${port}${MCP_PATH} (${live ? "live" : "mock"})\n` +
          toolSummary,
      ),
    );
  };

  if ((process.env.MCP_TRANSPORT ?? "stdio").toLowerCase() === "http") {
    await startHttp();
  } else {
    await buildServer().connect(new StdioServerTransport());
    console.error(`cortex-mcp connected (${live ? "live" : "mock"})\n` + toolSummary);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
