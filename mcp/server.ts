#!/usr/bin/env node
// Cortex MCP server — exposes the memory plane as MCP tools so any MCP host
// (Claude Desktop, Code, Cursor) can recall, remember, ingest, consolidate and
// verify. Optional dep: @modelcontextprotocol/sdk. Runs on mock unless config
// is fully wired.

import {
  loadConfig,
  isLive,
  createClients,
  ingestSource,
  runDream,
  applyDiff,
  verify,
  seedDemo,
  importExternal,
} from "../src/core/index";

const cfg = loadConfig();
const live = isLive(cfg);
const c = createClients(cfg);

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

  if (!live) await seedDemo(c, cfg);
  const server = new McpServer({ name: "cortex-memory", version: "0.1.0" });

  server.tool(
    "memory_recall",
    "Recall memories from the namespace (verified-first).",
    { query: z.string().optional(), limit: z.number().optional() },
    async ({ query, limit }: any) => {
      const recs = await c.memwal.recall(cfg.namespace, query ?? "", { limit });
      return text(JSON.stringify(recs, null, 2));
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

  await server.connect(new StdioServerTransport());
  console.error(
    `cortex-mcp connected (${live ? "live" : "mock"}) — tools: memory_recall, memory_remember, memory_ingest, dream_run, verify_memory`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});