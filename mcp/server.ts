#!/usr/bin/env node
// Cortex MCP server — the all-inclusive connector. Exposes the full Cortex memory
// plane (recall, remember, ingest, list, timeline, tags, digest, connections,
// extraction, head, dream, verify) plus outbound bridges (web_fetch, service_notify,
// service_export) so any MCP host (Claude Desktop, Code, Cursor) or external service
// reaches Cortex's durable memory. Also publishes MCP Resources and Prompts.
// Optional dep: @modelcontextprotocol/sdk. Runs on mock unless config is fully wired.

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
} from "../src/core/index";

const DEFAULT_PERIOD = { from: "0000", to: "9999" };
const SUMMARY_RECENT_LIMIT = 20;
const FETCH_TIMEOUT_MS = 30_000;
const RESOURCE_MIME = "application/json";

const cfg = loadConfig();
const live = isLive(cfg);
const c = createClients(cfg);
const cortex = openCortex(cfg);

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

  if (!live) await seedDemo(c, cfg);
  const server = new McpServer({ name: "cortex-memory", version: "0.2.0" });

  // ---- memory: write / consolidate / verify ----
  server.tool(
    "memory_recall",
    "Recall memories from the namespace (verified-first).",
    { query: z.string().optional(), limit: z.number().optional() },
    async ({ query, limit }: any) => {
      const recs = await c.memwal.recall(cfg.namespace, query ?? "", { limit });
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

  await server.connect(new StdioServerTransport());
  console.error(
    `cortex-mcp connected (${live ? "live" : "mock"})\n` +
      `  tools: memory_recall, memory_remember, memory_ingest, dream_run, verify_memory, ` +
      `memory_list, memory_timeline, memory_tags, memory_digest, memory_connections, ` +
      `memory_extraction, memory_head, web_fetch, service_notify, service_export\n` +
      `  resources: cortex://memory, cortex://timeline, cortex://digest\n` +
      `  prompts: summarize_memory, daily_digest`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
