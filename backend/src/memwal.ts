// MemWal — the live memory plane (@mysten-incubation/memwal). The SDK handles the
// relayer, embeddings and Seal. Cortex reads current state through it and writes
// consolidated memories on apply. Prune is a tombstone convention (no delete).

import type { Config } from "./config.js";
import type { Memory } from "./models.js";
import { isLive } from "./config.js";
import { memoryHead } from "./crypto.js";
import { importExternal } from "./external.js";

export interface MemWriteOpts {
  agent?: string;
  via?: Memory["via"];
  dream?: boolean;
  tags?: string[];
}

export interface MemWalClient {
  remember(namespace: string, text: string, opts?: MemWriteOpts): Promise<{ memoryId: string; suiTxn: string }>;
  recall(namespace: string, query: string, opts?: { limit?: number }): Promise<Memory[]>;
  restore(namespace: string): Promise<{ head: string; memories: Memory[] }>;
  tombstone(namespace: string, memoryId: string, note: string): Promise<void>;
  stampVerified(namespace: string, memoryId: string, at: string): Promise<void>;
}

class MockMemWal implements MemWalClient {
  private mem = new Map<string, Memory[]>();
  private seq = 0;
  private txn = 0;
  private rec(ns: string) {
    if (!this.mem.has(ns)) this.mem.set(ns, []);
    return this.mem.get(ns)!;
  }
  async remember(ns: string, text: string, opts?: MemWriteOpts) {
    const id = "mem_" + ++this.seq;
    const suiTxn = "0xtxn" + String(++this.txn).padStart(4, "0");
    this.rec(ns).unshift({
      id,
      namespace: ns,
      text,
      tags: opts?.tags ?? [],
      when: new Date(0).toISOString(),
      createdAt: new Date(0).toISOString(),
      agent: opts?.agent ?? "agent",
      via: opts?.via ?? "remember",
      dream: opts?.dream,
      confidence: 1,
      suiTxn,
    } as Memory & { suiTxn: string });
    return { memoryId: id, suiTxn };
  }
  async recall(ns: string, _q: string, opts?: { limit?: number }) {
    const live = this.rec(ns).filter((m) => !m.tombstone);
    return opts?.limit ? live.slice(0, opts.limit) : live;
  }
  async restore(ns: string) {
    const all = this.rec(ns);
    return { head: memoryHead(all), memories: all };
  }
  async tombstone(ns: string, id: string, note: string) {
    const m = this.rec(ns).find((x) => x.id === id);
    if (m) {
      m.tombstone = true;
      m.note = note;
    }
  }
  async stampVerified(ns: string, id: string, at: string) {
    const m = this.rec(ns).find((x) => x.id === id);
    if (m) {
      m.verified = true;
      m.note = "verified " + at;
    }
  }
}

/** Live MemWal via @mysten-incubation/memwal. Lazily imported + loosely typed. */
class LiveMemWal implements MemWalClient {
  constructor(private cfg: Config) {}
  private clientP?: Promise<any>;
  private async client(): Promise<any> {
    if (!this.clientP) {
      this.clientP = (async () => {
        const mod: any = await importExternal("@mysten-incubation/memwal");
        return new mod.MemWal({ url: this.cfg.memwal.url, apiKey: this.cfg.memwal.apiKey, delegateKey: this.cfg.delegateKey });
      })();
    }
    return this.clientP;
  }
  async remember(ns: string, text: string, opts?: MemWriteOpts) {
    const c = await this.client();
    const r = await c.remember({ namespace: ns, text, metadata: { agent: opts?.agent, via: opts?.via, tags: opts?.tags } });
    return { memoryId: r.id ?? r.memoryId, suiTxn: r.suiTxn ?? r.txn ?? "" };
  }
  async recall(ns: string, query: string, opts?: { limit?: number }) {
    const c = await this.client();
    const r = await c.recall({ namespace: ns, query, limit: opts?.limit });
    return (r.memories ?? r) as Memory[];
  }
  async restore(ns: string) {
    const c = await this.client();
    const r = await c.restore({ namespace: ns });
    return { head: r.head, memories: (r.memories ?? []) as Memory[] };
  }
  async tombstone(ns: string, id: string, note: string) {
    const c = await this.client();
    await c.remember({ namespace: ns, text: `__tombstone__:${id} ${note}`, metadata: { tombstones: id } });
  }
  async stampVerified(ns: string, id: string, at: string) {
    const c = await this.client();
    await c.remember({ namespace: ns, text: `__verify__:${id}@${at}`, metadata: { verifies: id } });
  }
}

export function createMemWal(cfg: Config): MemWalClient {
  return isLive(cfg) ? new LiveMemWal(cfg) : new MockMemWal();
}
