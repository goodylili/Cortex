// Cortex — the local-first facade. Desktop and mobile embed this directly; there
// is no HTTP backend. The only server in the system is the MCP connector (mcp.ts),
// which lets external agents reach the same memory through this same facade.

import { type Config, isLive, loadConfig } from "./config.js";
import { type Clients, createClients, getArtifact } from "./db.js";
import { loadManifest } from "./manifest.js";
import {
  applyDiff,
  getExtraction,
  type IngestInput,
  ingestSource,
  runDream,
  verify,
} from "./sync.js";
import type { Memory, MemoryDiff } from "./models.js";
import { buildTags } from "./artifacts/tags.js";
import { buildDigest } from "./artifacts/digest.js";
import { buildConnections } from "./artifacts/connections.js";
import { startWatcher } from "./watcher.js";
import { seedDemo } from "./demo.js";

export class Cortex {
  readonly cfg: Config;
  readonly clients: Clients;

  constructor(cfg: Config = loadConfig()) {
    this.cfg = cfg;
    this.clients = createClients(cfg);
  }

  get namespace() {
    return this.cfg.namespace;
  }

  get live() {
    return isLive(this.cfg);
  }

  // ---- ingest & memory ----
  ingest(input: IngestInput) {
    return ingestSource(this.clients, this.cfg, input);
  }

  ingestText(text: string, title?: string) {
    return this.ingest({
      type: "note",
      uri: "inline://" + (title ?? "note"),
      title,
      text,
      hint: title,
    });
  }

  recall(query = "", limit?: number): Promise<Memory[]> {
    return this.clients.memwal.recall(this.namespace, query, { limit });
  }

  async memories(): Promise<Memory[]> {
    return (await this.clients.memwal.restore(this.namespace)).memories;
  }

  async head(): Promise<string> {
    return (await this.clients.memwal.restore(this.namespace)).head;
  }

  // ---- consolidation ----
  dream() {
    return runDream(this.clients, this.cfg);
  }

  apply(diff: MemoryDiff) {
    return applyDiff(this.clients, diff);
  }

  async dreamAndApply() {
    const { diff } = await this.dream();
    return this.apply(diff);
  }

  // ---- derived views ----
  async tags() {
    return buildTags(this.namespace, await this.memories());
  }

  async digest(
    period: { from: string; to: string } = { from: "0000", to: "9999" },
  ) {
    return buildDigest(this.namespace, await this.memories(), period);
  }

  async connections() {
    return buildConnections(this.namespace, await this.memories());
  }

  async timeline() {
    return (await loadManifest(this.clients, this.namespace)).versions;
  }

  extraction(blobId: string) {
    return getExtraction(this.clients, blobId);
  }

  // ---- trust (developer layer) ----
  verify() {
    return verify(this.clients, this.cfg);
  }

  diff(blobId: string) {
    return getArtifact<MemoryDiff>(this.clients, blobId, "cortex.diff.v1");
  }

  // ---- live folder ingest ----
  watch(onIngest?: (uri: string) => void) {
    return startWatcher(this.clients, this.cfg, onIngest);
  }

  // ---- demo ----
  seedDemo() {
    return seedDemo(this.clients, this.cfg);
  }
}

export function openCortex(cfg?: Config): Cortex {
  return new Cortex(cfg);
}
