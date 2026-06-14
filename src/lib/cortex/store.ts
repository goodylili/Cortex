"use client";
import { create } from "zustand";
import {
  type Memory,
  type CortexEvent,
  type Cost,
  type Model,
  uid,
  toks,
  autoTags,
  extract,
  retrieve,
  webSearch,
  emptyState,
  ago,
  MODELS,
} from "./logic";
import {
  type MemoryConfig,
  DEFAULT_CONFIG,
  normalizeConfig,
  serializeConfig,
  ensureModel,
  newMemory,
  isCorrection,
  consolidate,
  onAccess,
  like as mLike,
  dislike as mDislike,
  rememberPin as mRemember,
  forget as mForget,
  restore as mRestore,
  isRetrievable,
  type SweepSummary,
} from "./memory-model";

const KEY = "cortex.db.v3";

export interface ChatSource {
  type: "memory" | "web";
  label?: string;
  text?: string;
  when?: string;
  title?: string;
  url?: string;
  snippet?: string;
}
export interface ChatMsg {
  q: string;
  a: string;
  sources: ChatSource[];
  model: string;
  web: boolean;
  savedNote: string;
  docs: string[];
  streaming?: boolean;
}

type Mode = "remember" | "ask";
type Importance = "low" | "normal" | "high";

interface Persisted {
  memories: Memory[];
  events: CortexEvent[];
  cost: Cost;
  config?: Partial<MemoryConfig>;
  lastSweep?: number;
}

interface State {
  memories: Memory[];
  events: CortexEvent[];
  cost: Cost;
  config: MemoryConfig;
  lastSweep: number;
  // ephemeral UI
  mode: Mode;
  importance: Importance;
  model: Model;
  web: boolean;
  docs: string[];
  chat: ChatMsg[];
  ready: boolean;
  // actions
  hydrate: () => void;
  live: () => Memory[];
  remember: (text: string, importance: Importance) => void;
  ingestText: (text: string, source: string) => number;
  syncFiles: (
    files: {
      id: string;
      name: string;
      mime: string;
      blobId: string;
      url: string;
    }[],
  ) => void;
  setMode: (m: Mode) => void;
  setImportance: (i: Importance) => void;
  setModel: (name: string) => void;
  toggleWeb: () => void;
  attachDoc: (name: string) => void;
  removeDoc: (i: number) => void;
  ask: (q: string) => void;
  appendChatToken: (text: string) => void;
  keepClose: (id: string) => void;
  unkeep: (id: string) => void;
  setAside: (id: string) => void;
  reflectKeep: (
    kind: string,
    ids: string[],
    keepId?: string,
    tag?: string,
  ) => void;
  // memory model
  likeMem: (id: string) => void;
  dislikeMem: (id: string) => void;
  rememberMem: (id: string, core?: boolean) => void;
  forgetMem: (id: string, hard?: boolean) => void;
  restoreMem: (id: string) => void;
  runSweep: () => SweepSummary;
  setConfig: (c: Partial<MemoryConfig>) => void;
  resetConfig: () => void;
  resetMemory: () => void;
}

function persist(s: {
  memories: Memory[];
  events: CortexEvent[];
  cost: Cost;
  config?: MemoryConfig;
  lastSweep?: number;
}) {
  try {
    const cur = (() => {
      try {
        return JSON.parse(localStorage.getItem(KEY) || "{}");
      } catch {
        return {};
      }
    })();
    const config = s.config ? serializeConfig(s.config) : cur.config;
    const lastSweep = s.lastSweep ?? cur.lastSweep;
    localStorage.setItem(
      KEY,
      JSON.stringify({
        memories: s.memories,
        events: s.events,
        cost: s.cost,
        config,
        lastSweep,
      }),
    );
  } catch {}
}
function logEvent(
  events: CortexEvent[],
  type: string,
  t: string,
  sub?: string,
  warm?: boolean,
): CortexEvent[] {
  return [{ id: uid("ev"), ts: Date.now(), type, t, sub, warm }, ...events];
}

export const useCortex = create<State>((set, get) => ({
  memories: [],
  events: [],
  cost: { rawIngestedTokens: 0, dedupTokens: 0, retrievalTokens: 0, asks: 0 },
  config: DEFAULT_CONFIG,
  lastSweep: 0,
  mode: "remember",
  importance: "normal",
  model: MODELS[1]!,
  web: false,
  docs: [],
  chat: [],
  ready: false,

  hydrate: () => {
    let data: Persisted | null = null;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) data = JSON.parse(raw);
    } catch {}
    if (!data || !data.memories?.length) {
      data = emptyState();
    }
    if (!data.cost)
      data.cost = {
        rawIngestedTokens: data.memories.reduce((s, m) => s + toks(m.text), 0),
        dedupTokens: 0,
        retrievalTokens: 0,
        asks: 0,
      };
    const config = normalizeConfig(data.config);
    const now = Date.now();
    // backfill the memory model onto any legacy / seed memory
    let memories = data.memories.map((m) => ensureModel(m));
    let events = data.events;
    let lastSweep = data.lastSweep || 0;
    // run consolidation if a sweep is due (the "sleep" pass)
    if (now - lastSweep > config.sweepHours * 3600000) {
      const { memories: swept, summary } = consolidate(memories, now, config);
      memories = swept;
      lastSweep = now;
      if (summary.deindexed || summary.merged || summary.promoted) {
        events = logEvent(
          events,
          "reflect",
          "Cortex consolidated overnight",
          `${summary.deindexed} faded, ${summary.merged} folded, ${summary.promoted} promoted`,
          true,
        );
      }
    }
    persist({ memories, events, cost: data.cost, config, lastSweep });
    set({ memories, events, cost: data.cost, config, lastSweep, ready: true });
  },

  live: () =>
    get()
      .memories.filter((m) => !m.tombstone && m.lock !== "forgotten_hard")
      .sort((a, b) => b.ts - a.ts),

  remember: (text, importance) => {
    const t = text.trim();
    if (!t) return;
    const now = Date.now();
    const base: Memory = {
      id: uid("mem"),
      text: t,
      tags: autoTags(t),
      ts: now,
      createdAt: now,
      source: "note",
      importance,
      kept: importance === "high",
    };
    const m = newMemory(base, importance, "stated");
    set((s) => {
      let memories = [m, ...s.memories];
      // corrections overwrite what they contradict (newest stated correction wins)
      if (isCorrection(t)) {
        const target = s.memories.find(
          (x) =>
            x.lock !== "forgotten_hard" && !x.tombstone && x.facet === m.facet,
        );
        if (target) {
          m.supersedes = target.id;
          memories = memories.map((x) =>
            x.id === target.id
              ? { ...x, lock: "suppressed", note: "superseded by a correction" }
              : x,
          );
        }
      }
      const cost = {
        ...s.cost,
        rawIngestedTokens: s.cost.rawIngestedTokens + toks(t),
      };
      const events = logEvent(
        s.events,
        "added",
        importance === "high"
          ? "Kept something close"
          : "Remembered a new thought",
        t.length > 60 ? t.slice(0, 60) + "…" : t,
      );
      const next = { memories, events, cost, config: s.config };
      persist(next);
      return next;
    });
  },

  ingestText: (text, source) => {
    const parts = extract(text);
    const now = Date.now();
    set((s) => {
      const mems = parts.map((p) =>
        newMemory(
          {
            id: uid("mem"),
            text: p,
            tags: autoTags(p),
            ts: now,
            createdAt: now,
            source,
          } as Memory,
          "normal",
          "inferred",
        ),
      );
      const cost = {
        ...s.cost,
        rawIngestedTokens: s.cost.rawIngestedTokens + toks(text),
      };
      const events = logEvent(
        s.events,
        "imported",
        `Read “${source}”`,
        `kept ${mems.length} ${mems.length === 1 ? "memory" : "memories"}`,
      );
      const next = {
        memories: [...mems, ...s.memories],
        events,
        cost,
        config: s.config,
      };
      persist(next);
      return next;
    });
    return parts.length;
  },

  // Mirror on-chain KbFiles as "file" memory nodes so they show in the Knowledge
  // view and the brain map. Replaces the previous kb_* set each call.
  syncFiles: (files) =>
    set((s) => {
      const KB = "kb_";
      const now = Date.now();
      const nodes: Memory[] = files.map((f) => ({
        id: KB + f.id,
        text: f.name,
        tags: ["file"],
        ts: now,
        createdAt: now,
        source: f.name,
        kept: true,
        blobId: f.blobId,
        url: f.url,
        mime: f.mime,
      }));
      const memories = [
        ...nodes,
        ...s.memories.filter((m) => !m.id.startsWith(KB)),
      ];
      persist({ memories, events: s.events, cost: s.cost, config: s.config });
      return { memories };
    }),

  setMode: (mode) => set({ mode }),
  setImportance: (importance) => set({ importance }),
  setModel: (name) =>
    set({ model: MODELS.find((m) => m.name === name) || get().model }),
  toggleWeb: () => set((s) => ({ web: !s.web })),
  attachDoc: (name) => set((s) => ({ docs: [...s.docs, name] })),
  removeDoc: (i) => set((s) => ({ docs: s.docs.filter((_, j) => j !== i) })),

  ask: (q) => {
    q = q.trim();
    if (!q) return;
    const now = Date.now();
    const cfg = get().config;
    const live = get()
      .live()
      .filter((m) => isRetrievable(m, now, cfg));
    const cites = retrieve(q, live);
    // rehearsal: accessing a memory strengthens its trace
    if (cites.length) {
      const citeIds = new Set(cites.map((c) => c.id));
      set((s) => {
        const memories = s.memories.map((m) =>
          citeIds.has(m.id) ? onAccess(m, now, cfg) : m,
        );
        persist({ memories, events: s.events, cost: s.cost, config: s.config });
        return { memories };
      });
    }
    const web = get().web ? webSearch(q) : [];
    const sources: ChatSource[] = [
      ...cites.map((c) => ({
        type: "memory" as const,
        label: c.tags[0] || "note",
        text: c.text,
        when: ago(c.ts),
      })),
      ...web,
    ];
    const allTok = live.reduce((s, m) => s + toks(m.text), 0);
    const sentTok = cites.reduce((s, m) => s + toks(m.text), 0);
    const savedTok = Math.max(0, allTok - sentTok);
    const savedNote =
      cites.length && live.length > cites.length
        ? `sent ${cites.length} of ${live.length} memories`
        : "";
    // Deterministic answer used when no model key is configured or the call fails.
    let fallback: string;
    if (!sources.length) {
      fallback =
        "I don't have a memory or source that touches on that yet. Keep a note about it, or turn on web search, and I'll be able to answer.";
    } else {
      const parts: string[] = [];
      if (cites[0]) parts.push(`From what you've kept, ${cites[0].text} [1]`);
      if (cites[1])
        parts.push(
          `you also noted ${cites[1].text.charAt(0).toLowerCase()}${cites[1].text.slice(1)} [2]`,
        );
      if (web.length)
        parts.push(
          `on the web, ${web[0]!.title.toLowerCase()} adds context [${cites.length + 1}]`,
        );
      fallback = parts.join(". ") + ".";
    }
    const msg: ChatMsg = {
      q,
      a: "",
      sources,
      model: get().model.name,
      web: get().web,
      savedNote,
      docs: get().docs,
      streaming: true,
    };
    set((s) => ({
      chat: [...s.chat, msg],
      docs: [],
      cost: {
        ...s.cost,
        retrievalTokens: s.cost.retrievalTokens + savedTok,
        asks: s.cost.asks + 1,
      },
    }));
    persist({
      memories: get().memories,
      events: get().events,
      cost: get().cost,
    });

    const stream = (text: string) => {
      const words = text.split(" ");
      let i = 0;
      const tick = setInterval(() => {
        if (i >= words.length) {
          clearInterval(tick);
          set((s) => {
            const chat = [...s.chat];
            const last = chat[chat.length - 1];
            if (last) {
              last.a = text;
              last.streaming = false;
            }
            return { chat };
          });
          return;
        }
        const tokWord = words[i++];
        set((s) => {
          const chat = [...s.chat];
          const last = chat[chat.length - 1];
          if (last) last.a = (last.a ? last.a + " " : "") + tokWord;
          return { chat };
        });
      }, 30);
    };

    // Answer with the selected model, grounded in the retrieved memories.
    fetch("/api/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question: q,
        memories: cites.map((c) => ({
          text: c.text,
          label: c.tags[0] || "note",
          when: ago(c.ts),
        })),
        web: get().web,
        model: get().model.name,
      }),
    })
      .then((r) => r.json())
      .then((d) =>
        stream(typeof d.answer === "string" && d.answer ? d.answer : fallback),
      )
      .catch(() => stream(fallback));
  },
  appendChatToken: () => {},

  keepClose: (id) =>
    set((s) => {
      const memories = s.memories.map((m) =>
        m.id === id ? { ...m, kept: true } : m,
      );
      const next = { ...s, memories };
      persist(next);
      return { memories };
    }),
  unkeep: (id) =>
    set((s) => {
      const memories = s.memories.map((m) =>
        m.id === id ? { ...m, kept: false } : m,
      );
      persist({ ...s, memories });
      return { memories };
    }),
  setAside: (id) =>
    set((s) => {
      const memories = s.memories.map((m) =>
        m.id === id ? { ...m, tombstone: true, note: "set aside" } : m,
      );
      const events = logEvent(
        s.events,
        "tidy",
        "Set a memory aside",
        "still kept, just out of the way",
      );
      const next = { memories, events, cost: s.cost };
      persist(next);
      return next;
    }),

  reflectKeep: (kind, ids, keepId, tag) =>
    set((s) => {
      let memories = [...s.memories];
      let events = s.events;
      let cost = { ...s.cost };
      if (kind === "merge") {
        let removed = 0;
        memories = memories.map((m) => {
          if (ids.includes(m.id) && m.id !== keepId) {
            removed += toks(m.text);
            return { ...m, tombstone: true, note: "folded in" };
          }
          return m.id === keepId ? { ...m, kept: true, noticed: true } : m;
        });
        cost = { ...cost, dedupTokens: cost.dedupTokens + removed };
        events = logEvent(
          events,
          "merge",
          `Tidied ${ids.length} notes into one`,
          "folded near-identical memories together",
          true,
        );
      } else if (kind === "pattern" && tag) {
        const nm: Memory = {
          id: uid("mem"),
          text: `A thread in my life: ${tag}.`,
          tags: [tag],
          ts: Date.now(),
          createdAt: Date.now(),
          source: "reflection",
          kept: true,
          noticed: true,
        };
        memories = [nm, ...memories];
        events = logEvent(
          events,
          "reflect",
          `Saved an insight about ${tag}`,
          "a pattern Cortex noticed",
          true,
        );
      } else if (kind === "tidy") {
        memories = memories.map((m) =>
          ids.includes(m.id)
            ? { ...m, tombstone: true, note: "set aside in reflection" }
            : m,
        );
        events = logEvent(
          events,
          "tidy",
          "Set an old memory aside",
          "still kept, just out of the way",
          true,
        );
      }
      const next = { memories, events, cost };
      persist(next);
      return next;
    }),

  // ---- memory model controls ----
  likeMem: (id) =>
    set((s) => {
      const now = Date.now();
      const memories = s.memories.map((m) => (m.id === id ? mLike(m, now) : m));
      const events = logEvent(
        s.events,
        "added",
        "Marked a memory as mattering more",
        "promoted a tier, pinned",
      );
      const next = { memories, events, cost: s.cost, config: s.config };
      persist(next);
      return next;
    }),
  dislikeMem: (id) =>
    set((s) => {
      const now = Date.now();
      const memories = s.memories.map((m) =>
        m.id === id ? mDislike(m, now) : m,
      );
      const events = logEvent(
        s.events,
        "tidy",
        "Turned a memory down",
        "demoted a tier, fades faster",
      );
      const next = { memories, events, cost: s.cost, config: s.config };
      persist(next);
      return next;
    }),
  rememberMem: (id, core) =>
    set((s) => {
      const now = Date.now();
      const memories = s.memories.map((m) =>
        m.id === id ? mRemember(m, now, core) : m,
      );
      const events = logEvent(
        s.events,
        "added",
        core ? "Kept a memory as core" : "Pinned a memory to keep",
        "exempt from fading",
      );
      const next = { memories, events, cost: s.cost, config: s.config };
      persist(next);
      return next;
    }),
  forgetMem: (id, hard) =>
    set((s) => {
      const now = Date.now();
      const memories = s.memories.map((m) =>
        m.id === id ? mForget(m, now, hard) : m,
      );
      const events = logEvent(
        s.events,
        "tidy",
        hard ? "Forgot a memory for good" : "Set a memory out of mind",
        hard
          ? "purged from index and storage"
          : "de-indexed, raw record kept on Walrus",
      );
      const next = { memories, events, cost: s.cost, config: s.config };
      persist(next);
      return next;
    }),
  restoreMem: (id) =>
    set((s) => {
      const now = Date.now();
      const memories = s.memories.map((m) =>
        m.id === id ? mRestore(m, now) : m,
      );
      const next = {
        memories,
        events: s.events,
        cost: s.cost,
        config: s.config,
      };
      persist(next);
      return next;
    }),
  runSweep: () => {
    const now = Date.now();
    const cfg = get().config;
    const { memories, summary } = consolidate(get().memories, now, cfg);
    const events = logEvent(
      get().events,
      "reflect",
      "Ran a consolidation sweep",
      `${summary.deindexed} faded, ${summary.merged} folded, ${summary.promoted} promoted, ${summary.demoted} eased`,
      true,
    );
    persist({
      memories,
      events,
      cost: get().cost,
      config: cfg,
      lastSweep: now,
    });
    set({ memories, events, lastSweep: now });
    return summary;
  },
  setConfig: (patch) =>
    set((s) => {
      const config = normalizeConfig({ ...s.config, ...patch });
      persist({ memories: s.memories, events: s.events, cost: s.cost, config });
      return { config };
    }),
  resetConfig: () =>
    set((s) => {
      persist({
        memories: s.memories,
        events: s.events,
        cost: s.cost,
        config: DEFAULT_CONFIG,
      });
      return { config: DEFAULT_CONFIG };
    }),
  // Wipe the local working index back to a blank slate. The durable record on
  // Walrus Memory is untouched; this only clears what this browser mirrors.
  resetMemory: () =>
    set((s) => {
      const fresh = emptyState();
      const next = {
        memories: fresh.memories,
        events: fresh.events,
        cost: fresh.cost,
        config: s.config,
        lastSweep: 0,
      };
      persist(next);
      return { ...next, chat: [] };
    }),
}));
