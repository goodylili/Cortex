// MemWal  -  the live memory plane (@mysten-incubation/memwal). The SDK handles the
// relayer, embeddings and Seal. Cortex reads current state through it and writes
// consolidated memories on apply. Prune is a tombstone convention (no delete).

import type { Config } from "../../src/core/config";
import type { Memory } from "../../src/core/models";
import { isLive } from "../../src/core/config";
import { memoryHead } from "../../src/core/crypto";
import { importExternal } from "../../src/core/external";

export interface MemWriteOpts {
  agent?: string;
  via?: Memory["via"];
  dream?: boolean;
  tags?: string[];
}

export interface MemWalClient {
  remember(
    namespace: string,
    text: string,
    opts?: MemWriteOpts,
  ): Promise<{ memoryId: string; suiTxn: string }>;
  recall(
    namespace: string,
    query: string,
    opts?: { limit?: number },
  ): Promise<Memory[]>;
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
        return mod.MemWal.create({
          key: this.cfg.memwal.key,
          accountId: this.cfg.memwal.accountId,
          serverUrl: this.cfg.memwal.url,
          namespace: this.cfg.namespace,
        });
      })();
    }
    return this.clientP;
  }
  // RecallMemory ({ blob_id, text, distance }) -> Cortex Memory. The relayer does
  // not carry tags/agent/timestamps, so those default; confidence is 1 - distance.
  private toMemory(ns: string, m: any): Memory {
    const distance = typeof m?.distance === "number" ? m.distance : 0;
    return {
      id: String(m?.blob_id ?? m?.id ?? ""),
      namespace: ns,
      text: String(m?.text ?? ""),
      tags: [],
      when: "",
      createdAt: "",
      agent: "memwal",
      via: "remember",
      confidence: Math.max(0, Math.min(1, 1 - distance)),
    } as Memory;
  }
  async remember(ns: string, text: string, _opts?: MemWriteOpts) {
    const c = await this.client();
    const r = await c.rememberAndWait(text, ns);
    return {
      memoryId: String(r?.id ?? r?.job_id ?? ""),
      suiTxn: String(r?.blob_id ?? ""),
    };
  }
  async recall(ns: string, query: string, opts?: { limit?: number }) {
    const c = await this.client();
    // The relayer rejects an empty query ("Query cannot be empty"), so a blank
    // query (recall everything / no specific question) becomes a broad " " search,
    // mirroring restore().
    const q = query.trim() ? query : " ";
    const r = await c.recall(q, opts?.limit ?? 10, ns);
    return ((r?.results ?? []) as any[]).map((m) => this.toMemory(ns, m));
  }
  async restore(ns: string) {
    // The relayer exposes no enumerate API; approximate the full set with a broad
    // recall. Bounded by the limit, so this is best-effort, not an exhaustive list.
    const c = await this.client();
    const r = await c
      .recall(" ", 100, ns)
      .catch(() => ({ results: [] as any[] }));
    const memories = ((r?.results ?? []) as any[]).map((m) =>
      this.toMemory(ns, m),
    );
    return { head: memoryHead(memories), memories };
  }
  async tombstone(ns: string, id: string, note: string) {
    const c = await this.client();
    await c.rememberAndWait(`__tombstone__:${id} ${note}`, ns);
  }
  async stampVerified(ns: string, id: string, at: string) {
    const c = await this.client();
    await c.rememberAndWait(`__verify__:${id}@${at}`, ns);
  }
}

export function createMemWal(cfg: Config): MemWalClient {
  return isLive(cfg) ? new LiveMemWal(cfg) : new MockMemWal();
}
