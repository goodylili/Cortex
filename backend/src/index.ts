// @cortex/backend — public surface. Local-first: desktop & mobile embed the
// Cortex facade directly. The only server is the MCP connector (mcp.ts).
export * from "./cortex.js";
export * from "./models.js";
export * from "./crypto.js";
export * from "./config.js";
export * from "./db.js";
export * from "./manifest.js";
export * from "./extractor.js";
export * from "./agent.js";
export * from "./sync.js";
export * from "./watcher.js";
export * from "./demo.js";
export { buildTags } from "./artifacts/tags.js";
export { buildDigest } from "./artifacts/digest.js";
export { buildConnections } from "./artifacts/connections.js";
export { changesFromDiff } from "./artifacts/changes.js";
