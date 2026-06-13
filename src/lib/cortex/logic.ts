// Cortex memory logic — pure, deterministic, client-side. Ported to TS from the
// verified vanilla app. The Next app uses these via the zustand store.

export interface Memory {
  id: string;
  text: string;
  tags: string[];
  ts: number;
  createdAt: number;
  source: string;
  kept?: boolean;
  noticed?: boolean;
  tombstone?: boolean;
  importance?: "low" | "normal" | "high";
  note?: string;
  // memory model (see lib/cortex/memory-model.ts)
  tier?: 0 | 1 | 2 | 3 | 4;
  facet?: string;
  trust?: "stated" | "inferred" | "system";
  activation?: number;
  lastAccess?: number;
  accessCount?: number;
  accessLog?: number[];
  lock?: "none" | "pinned" | "suppressed" | "forgotten_hard";
  lockedAt?: number;
  decayPenalty?: number;
  edges?: string[];
  supersedes?: string;
  rawRef?: string | null;
  content?: string;
}

export interface CortexEvent {
  id: string;
  ts: number;
  type: string;
  t: string;
  sub?: string;
  warm?: boolean;
}

export interface Cost {
  rawIngestedTokens: number;
  dedupTokens: number;
  retrievalTokens: number;
  asks: number;
}

export const uid = (p: string) =>
  p + "_" + Math.random().toString(36).slice(2, 9);
export const toks = (s: string) => Math.ceil((s || "").length / 4);
export const PRICE_PER_TOKEN = 3 / 1_000_000;
export const TYPICAL_INJECT = 3;

export const fmtTokens = (n: number) =>
  n >= 1000
    ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k"
    : String(Math.round(n));
export function fmtMoney(n: number): string {
  if (n >= 0.01) return "$" + n.toFixed(2);
  if (n <= 0) return "$0";
  return "<$0.01";
}

export function ago(ts: number): string {
  const d = Date.now() - ts,
    m = 60000,
    h = 3600000,
    day = 86400000;
  if (d < m) return "just now";
  if (d < h) return Math.floor(d / m) + "m ago";
  if (new Date(ts).toDateString() === new Date().toDateString()) return "today";
  if (d < 2 * day) return "yesterday";
  if (d < 7 * day) return Math.floor(d / day) + " days ago";
  if (d < 30 * day) return Math.floor(d / (7 * day)) + "w ago";
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

const TAG_MAP: Record<string, RegExp> = {
  work: /\b(work|deploy|merge|pnpm|npm|api|code|ship|bug|release|standup)\b/i,
  travel: /\b(flight|fly|trip|hotel|airport|visa|lisbon|train|travel)\b/i,
  people:
    /\b(birthday|mum|mom|dad|sister|brother|friend|call|meet|wife|husband)\b/i,
  habits: /\b(morning|coffee|routine|sleep|gym|focus|workout|water)\b/i,
  ideas: /\b(idea|maybe|what if|concept|imagine|could build)\b/i,
  reading: /\b(read|book|reading|article|paper|chapter)\b/i,
  money: /\b(buy|paid|cost|price|invoice|subscription|rent)\b/i,
  health: /\b(doctor|sick|medicine|run|stretch|appointment)\b/i,
};
export function autoTags(t: string): string[] {
  const tags = Object.entries(TAG_MAP)
    .filter(([, re]) => re.test(t))
    .map(([k]) => k);
  return tags.length ? tags.slice(0, 3) : ["note"];
}

export function extract(text: string): string[] {
  const parts = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 16 && /[a-z]/i.test(s));
  return parts.length
    ? parts.slice(0, 20)
    : [text.trim()].filter((s) => s.length > 0);
}

const wordsOf = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 3),
  );

export function findClusters(live: Memory[]): Memory[][] {
  const used = new Set<string>(),
    groups: Memory[][] = [];
  for (const a of live) {
    if (used.has(a.id)) continue;
    const wa = wordsOf(a.text),
      g = [a];
    for (const b of live) {
      if (b.id === a.id || used.has(b.id)) continue;
      const wb = wordsOf(b.text);
      const inter = [...wa].filter((w) => wb.has(w)).length;
      if (inter / Math.max(1, Math.min(wa.size, wb.size)) >= 0.4) g.push(b);
    }
    if (g.length > 1) {
      g.forEach((m) => used.add(m.id));
      groups.push(g);
    }
  }
  return groups;
}

export function findPattern(
  live: Memory[],
): { tag: string; count: number } | null {
  const counts: Record<string, number> = {};
  live.forEach((m) =>
    m.tags.forEach((t) => (counts[t] = (counts[t] || 0) + 1)),
  );
  const top = Object.entries(counts)
    .filter(([t]) => t !== "note" && t !== "file")
    .sort((a, b) => b[1] - a[1])[0];
  return top && top[1] >= 3 ? { tag: top[0], count: top[1] } : null;
}

export function retrieve(q: string, live: Memory[]): Memory[] {
  const qw = [
    ...new Set(
      q
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, "")
        .split(/\s+/)
        .filter((w) => w.length > 2),
    ),
  ];
  return live
    .map((m) => {
      const lc = m.text.toLowerCase();
      let s = 0;
      qw.forEach((w) => {
        if (lc.includes(w)) s += 1;
      });
      m.tags.forEach((t) => {
        if (qw.includes(t)) s += 1;
      });
      return { m, s };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 3)
    .map((x) => x.m);
}

export interface Savings {
  storedTok: number;
  raw: number;
  distillTok: number;
  dedupTok: number;
  reductionPct: number;
  realizedTok: number;
  realized$: number;
  per100$: number;
  asks: number;
}
export function computeSavings(live: Memory[], cost: Cost): Savings {
  const storedTok = live.reduce((s, m) => s + toks(m.text), 0);
  const raw = cost.rawIngestedTokens || storedTok;
  const distillTok = Math.max(0, raw - storedTok);
  const dedupTok = cost.dedupTokens || 0;
  const avg = live.length ? storedTok / live.length : 0;
  const typicalSent = Math.min(live.length, TYPICAL_INJECT) * avg;
  const naivePerAsk = Math.max(1, raw),
    cortexPerAsk = Math.max(1, typicalSent);
  const reductionPct = Math.min(
    99,
    Math.round((1 - cortexPerAsk / naivePerAsk) * 100),
  );
  const realizedTok = distillTok + dedupTok + (cost.retrievalTokens || 0);
  return {
    storedTok,
    raw,
    distillTok,
    dedupTok,
    reductionPct,
    realizedTok,
    realized$: realizedTok * PRICE_PER_TOKEN,
    per100$: 100 * (naivePerAsk - cortexPerAsk) * PRICE_PER_TOKEN,
    asks: cost.asks || 0,
  };
}

export interface WebResult {
  type: "web";
  title: string;
  url: string;
  snippet: string;
}
export function webSearch(q: string): WebResult[] {
  const slug =
    q
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, "")
      .trim()
      .split(/\s+/)
      .slice(0, 3)
      .join("-") || "topic";
  return [
    {
      type: "web",
      title:
        q.charAt(0).toUpperCase() +
        q.slice(1).replace(/\?$/, "") +
        ", an overview",
      url: "en.wikipedia.org/wiki/" + slug,
      snippet: "Background from the open web.",
    },
    {
      type: "web",
      title: "Latest on " + q.replace(/\?$/, ""),
      url: "docs." + (slug.split("-")[0] || "ref") + ".org",
      snippet: "A recent reference.",
    },
  ];
}

export function freshMemories(): {
  memories: Memory[];
  events: CortexEvent[];
  cost: Cost;
} {
  const t = Date.now(),
    day = 86400000;
  const mk = (
    text: string,
    tags: string[],
    a: number,
    extra: Partial<Memory> = {},
  ): Memory => ({
    id: uid("mem"),
    text,
    tags,
    ts: t - a,
    createdAt: t - a,
    source: "note",
    ...extra,
  });
  const memories: Memory[] = [
    mk(
      "I think most clearly in the mornings, protect that time for deep work.",
      ["habits"],
      3 * 3600000,
      { kept: true, importance: "high" },
    ),
    mk(
      "My best deep work happens in the mornings, protect those hours.",
      ["habits"],
      2 * day,
    ),
    mk("We use pnpm on this project, not npm.", ["work"], 5 * 3600000, {
      noticed: true,
    }),
    mk(
      "Reminder: this repo is pnpm, not npm, the deploy runs on Tuesdays.",
      ["work"],
      22 * 3600000,
    ),
    mk(
      "Flying to Lisbon on March 3rd. The hotel is near Alfama, bring an EU plug adapter.",
      ["travel"],
      1 * day,
    ),
    mk(
      "Mum's birthday is the 14th. She loved the ceramics from the market last time.",
      ["people"],
      1 * day,
      { kept: true },
    ),
    mk(
      "Standup is at 10am. Coffee black, music off when I'm writing.",
      ["habits"],
      3 * day,
    ),
    mk(
      "The auth refactor is merged. Next: rate-limit the public endpoints.",
      ["work"],
      4 * day,
    ),
    mk(
      "That idea for a quiet, warm notes app, keep it personal, never social.",
      ["ideas"],
      6 * day,
      { noticed: true },
    ),
    mk(
      "Reading 'The Order of Time'. The bit about memory stitching a self together stayed with me.",
      ["reading"],
      6 * day,
    ),
  ];
  const events: CortexEvent[] = [
    {
      id: uid("ev"),
      ts: t - 6 * day,
      type: "start",
      t: "You started keeping memory with Cortex",
      sub: "everything since is yours, and only yours",
    },
    {
      id: uid("ev"),
      ts: t - 3 * day,
      type: "added",
      t: "Learned a few preferences",
      sub: "from a quick note about how you like to work",
    },
    {
      id: uid("ev"),
      ts: t - 1 * day,
      type: "added",
      t: "Kept a travel detail",
      sub: "Lisbon, March 3rd, near Alfama",
    },
  ];
  const raw = memories.reduce((s, m) => s + toks(m.text), 0);
  return {
    memories,
    events,
    cost: {
      rawIngestedTokens: raw,
      dedupTokens: 0,
      retrievalTokens: 0,
      asks: 0,
    },
  };
}

export const MODELS = [
  {
    name: "Claude Opus 4.8",
    prov: "Anthropic",
    price: "$$$",
    desc: "Deepest reasoning for hard questions",
  },
  {
    name: "Claude Sonnet 4.6",
    prov: "Anthropic",
    price: "$$",
    desc: "Balanced, great for everyday recall",
  },
  {
    name: "Claude Haiku 4.5",
    prov: "Anthropic",
    price: "$",
    desc: "Fast and light for quick answers",
  },
  {
    name: "GPT-5.5",
    prov: "OpenAI",
    price: "$$$",
    desc: "General-purpose flagship",
  },
  {
    name: "GPT-5.4",
    prov: "OpenAI",
    price: "$$",
    desc: "Quick everyday chat and tools",
  },
  {
    name: "Gemini 3 Pro",
    prov: "Google",
    price: "$$",
    desc: "Long-context, multimodal",
  },
  {
    name: "Gemini 3 Flash",
    prov: "Google",
    price: "$",
    desc: "Lightning-fast with real capability",
  },
  {
    name: "Llama 4 Maverick",
    prov: "Meta",
    price: "$",
    desc: "Open-weight workhorse",
  },
  {
    name: "Grok 4",
    prov: "xAI",
    price: "$$",
    desc: "Fast, current, conversational",
  },
];
export type Model = (typeof MODELS)[number];
