// Cortex Memory Model  -  human-like retention.
// Two orthogonal axes: tier (importance floor) and activation (usage signal).
// Forgetting is de-indexing, never deletion. The raw record lives on Walrus/Seal;
// hard forget is the single audited exception that purges it.
// Pure and deterministic, so the same store always sweeps the same way.

import type { Memory } from "./logic";

export type Tier = 0 | 1 | 2 | 3 | 4;
export type Facet =
  | "health"
  | "identity"
  | "work"
  | "finance"
  | "relationships"
  | "studying"
  | "creative"
  | "home"
  | "travel"
  | "hobbies"
  | "casual"
  | "ephemeral_task";
export type Trust = "stated" | "inferred" | "system";
export type Lock = "none" | "pinned" | "suppressed" | "forgotten_hard";

export const DAY = 86_400_000;
// Infinity does not survive JSON. We persist it as null and normalize on load.
export const INF = Infinity;

export interface MemoryConfig {
  halfLife: Record<Tier, number>; // days; Infinity = never decays
  floor: Record<Tier, number>;
  ttl: Record<Tier, number>; // days; Infinity = never auto-forgotten
  theta: number; // retrieval threshold
  accessBump: number; // activation gained per access (rehearsal)
  dislikePenalty: number; // decay multiplier after a dislike
  inferredPenalty: number; // decay multiplier for model-derived memories
  sweepHours: number; // consolidation cadence
  promoteAccesses: number; // accesses within window to earn a promotion
  promoteWindowDays: number;
}

export const DEFAULT_CONFIG: MemoryConfig = {
  halfLife: { 0: 1, 1: 7, 2: 45, 3: 365, 4: INF },
  floor: { 0: 0, 1: 0.05, 2: 0.25, 3: 0.55, 4: 1.0 },
  ttl: { 0: 0, 1: 30, 2: 180, 3: INF, 4: INF },
  theta: 0.2,
  accessBump: 0.15,
  dislikePenalty: 2.0,
  inferredPenalty: 1.4,
  sweepHours: 24,
  promoteAccesses: 5,
  promoteWindowDays: 14,
};

// Facets set a minimum tier a memory is not allowed to fall below.
export const FACET_MIN: Record<Facet, Tier> = {
  health: 3,
  identity: 3,
  work: 2,
  finance: 2,
  relationships: 2,
  studying: 2,
  creative: 2,
  home: 2,
  travel: 1,
  hobbies: 1,
  casual: 0,
  ephemeral_task: 0,
};

export const TIER_NAME: Record<Tier, string> = {
  0: "Ephemeral",
  1: "Temporary",
  2: "Standard",
  3: "Durable",
  4: "Core",
};
export const FACETS: Facet[] = [
  "health",
  "identity",
  "work",
  "finance",
  "relationships",
  "studying",
  "creative",
  "home",
  "travel",
  "hobbies",
  "casual",
  "ephemeral_task",
];

// JSON turns Infinity into null. Bring it back so the engine stays exact.
export function normalizeConfig(
  c: Partial<MemoryConfig> | null | undefined,
): MemoryConfig {
  const base = { ...DEFAULT_CONFIG, ...(c || {}) };
  const fix = (r: Record<Tier, number>, d: Record<Tier, number>) => {
    const out = { ...d } as Record<Tier, number>;
    ([0, 1, 2, 3, 4] as Tier[]).forEach((t) => {
      const v = r?.[t];
      out[t] = v == null ? d[t]! : v;
    });
    return out;
  };
  return {
    ...base,
    halfLife: fix(base.halfLife, DEFAULT_CONFIG.halfLife),
    floor: fix(base.floor, DEFAULT_CONFIG.floor),
    ttl: fix(base.ttl, DEFAULT_CONFIG.ttl),
  };
}
// For persistence: Infinity -> null so it round-trips.
export function serializeConfig(c: MemoryConfig): Record<string, unknown> {
  const strip = (r: Record<Tier, number>) => {
    const o: Record<number, number | null> = {};
    ([0, 1, 2, 3, 4] as Tier[]).forEach((t) => {
      o[t] = r[t] === INF ? null : r[t];
    });
    return o;
  };
  return { ...c, halfLife: strip(c.halfLife), ttl: strip(c.ttl) };
}

// ---- classification on write ----

const FACET_FROM_TAG: Record<string, Facet> = {
  health: "health",
  money: "finance",
  people: "relationships",
  work: "work",
  studying: "studying",
  study: "studying",
  reading: "studying",
  learning: "studying",
  ideas: "creative",
  creative: "creative",
  writing: "creative",
  music: "creative",
  art: "creative",
  travel: "travel",
  home: "home",
  hobby: "hobbies",
  hobbies: "hobbies",
};
const IDENTITY_RE =
  /\b(my name is|i am|i'm|i live|i was born|allergic|allergy|i prefer|i always|i never)\b/i;
const HEALTH_RE =
  /\b(allergic|allergy|asthma|diabet|blood type|medication|doctor|diagnos)\b/i;
const RULE_RE =
  /\b(always|never|from now on|i prefer|please remember|make sure|must|don'?t ever)\b/i;
const CORRECTION_RE =
  /\b(no,? actually|not |i told you|that'?s wrong|correction|it'?s actually|i meant)\b/i;
const TRANSIENT_RE =
  /\b(today|right now|currently|for now|this morning|tired|just |temporarily)\b/i;
const STUDY_RE =
  /\b(study|studying|studied|exam|course|class|homework|assignment|degree|university|college|school|lecture|revision|thesis|certification|learning)\b/i;
const TRAVEL_RE =
  /\b(flight|flying|trip|travel|hotel|vacation|holiday|airport|visa|itinerary|booking)\b/i;
const HOBBY_RE =
  /\b(hobby|hobbies|guitar|piano|painting|gardening|chess|gaming|knitting|photography|hiking|cycling|climbing|baking)\b/i;
const CREATIVE_RE =
  /\b(idea for|design|sketch|song|novel|screenplay|prototype|side project|art project|composing)\b/i;
const HOME_RE =
  /\b(apartment|rent|mortgage|landlord|furniture|move (in|out)|household|my flat|the house)\b/i;

export function facetOf(text: string, tags: string[]): Facet {
  if (HEALTH_RE.test(text)) return "health";
  if (IDENTITY_RE.test(text)) return "identity";
  for (const t of tags) {
    const f = FACET_FROM_TAG[t];
    if (f) return f;
  }
  if (STUDY_RE.test(text)) return "studying";
  if (TRAVEL_RE.test(text)) return "travel";
  if (HOBBY_RE.test(text)) return "hobbies";
  if (CREATIVE_RE.test(text)) return "creative";
  if (HOME_RE.test(text)) return "home";
  if (TRANSIENT_RE.test(text) && tags.includes("note")) return "ephemeral_task";
  return "casual";
}

// Importance score -> initial tier, clamped to [facet floor, T4].
export function scoreTier(
  text: string,
  facet: Facet,
  importance: "low" | "normal" | "high" | undefined,
): Tier {
  let tier: number = importance === "high" ? 3 : importance === "low" ? 1 : 2;
  if (RULE_RE.test(text) || HEALTH_RE.test(text) || IDENTITY_RE.test(text))
    tier = Math.max(tier, 3);
  if (TRANSIENT_RE.test(text) && !RULE_RE.test(text)) tier = Math.min(tier, 1);
  tier = Math.max(FACET_MIN[facet], tier);
  return Math.min(4, Math.max(0, tier)) as Tier;
}

export function isCorrection(text: string): boolean {
  return CORRECTION_RE.test(text);
}

// Backfill model fields onto a legacy memory. Idempotent.
export function ensureModel(m: Memory): Memory {
  if (m.tier != null && m.activation != null && m.lock != null) return m;
  const facet = (m.facet as Facet) ?? facetOf(m.text, m.tags);
  const importance = m.importance;
  let tier = (m.tier as Tier) ?? scoreTier(m.text, facet, importance);
  const lock: Lock =
    (m.lock as Lock) ??
    (m.kept ? "pinned" : m.tombstone ? "suppressed" : "none");
  if (m.kept && tier < 3) tier = 3 as Tier;
  return {
    ...m,
    tier,
    facet,
    lock,
    trust:
      (m.trust as Trust) ??
      (m.source === "note" || m.source === "reflection"
        ? "stated"
        : "inferred"),
    activation: m.activation ?? (m.noticed ? 0.45 : 0.3),
    lastAccess: m.lastAccess ?? m.ts,
    accessCount: m.accessCount ?? 0,
    decayPenalty: m.decayPenalty ?? 1.0,
    edges: m.edges ?? [],
    rawRef: m.rawRef ?? `walrus://local/${m.id}`,
    accessLog: m.accessLog ?? [],
  };
}

export function newMemory(
  base: Memory,
  importance: "low" | "normal" | "high" | undefined,
  trust: Trust,
): Memory {
  const facet = facetOf(base.text, base.tags);
  const tier = scoreTier(base.text, facet, importance);
  const now = base.ts;
  return {
    ...base,
    tier,
    facet,
    trust,
    activation: 0.35,
    lastAccess: now,
    accessCount: 0,
    lock: tier >= 3 && importance === "high" ? "pinned" : "none",
    decayPenalty: trust === "inferred" ? 1.0 : 1.0,
    edges: [],
    rawRef: `walrus://local/${base.id}`,
    accessLog: [],
  };
}

// ---- the retention engine ----

export function decayedActivation(
  m: Memory,
  now: number,
  c: MemoryConfig,
): number {
  const tier = (m.tier ?? 2) as Tier;
  const halfLife = c.halfLife[tier];
  const act = m.activation ?? 0.3;
  if (halfLife === INF) return act;
  const elapsedDays = (now - (m.lastAccess ?? m.ts)) / DAY;
  const penalty =
    (m.decayPenalty ?? 1) * (m.trust === "inferred" ? c.inferredPenalty : 1);
  return act * Math.pow(0.5, (elapsedDays * penalty) / halfLife);
}

export function retention(m: Memory, now: number, c: MemoryConfig): number {
  if (m.lock === "pinned") return 1;
  if (m.lock === "suppressed" || m.lock === "forgotten_hard") return 0;
  const tier = (m.tier ?? 2) as Tier;
  return Math.min(1, c.floor[tier] + decayedActivation(m, now, c));
}

export function isRetrievable(
  m: Memory,
  now: number,
  c: MemoryConfig,
): boolean {
  if (m.lock === "pinned") return true;
  if (m.lock === "suppressed" || m.lock === "forgotten_hard") return false;
  return retention(m, now, c) >= c.theta;
}

export function isForgettable(
  m: Memory,
  now: number,
  c: MemoryConfig,
): boolean {
  if ((m.lock ?? "none") !== "none") return false; // never auto-touch a ruled memory
  const tier = (m.tier ?? 2) as Tier;
  const ttl = c.ttl[tier];
  if (ttl === INF) return false;
  const ageDays = (now - (m.createdAt ?? m.ts)) / DAY;
  return retention(m, now, c) < c.theta && ageDays > ttl;
}

export type MemState =
  | "pinned"
  | "core"
  | "active"
  | "fading"
  | "forgotten"
  | "purged";
export function stateOf(m: Memory, now: number, c: MemoryConfig): MemState {
  if (m.lock === "forgotten_hard") return "purged";
  if (m.lock === "suppressed") return "forgotten";
  if (m.lock === "pinned") return "pinned";
  if ((m.tier ?? 2) === 4) return "core";
  const r = retention(m, now, c);
  if (r < c.theta) return "forgotten";
  if (r < c.theta + 0.18) return "fading";
  return "active";
}

// ---- control operations (immutable, for zustand) ----

export function onAccess(m: Memory, now: number, c: MemoryConfig): Memory {
  const log = [...(m.accessLog ?? []), now]
    .filter((t) => now - t < 30 * DAY)
    .slice(-20);
  return {
    ...m,
    activation: Math.min(1, (m.activation ?? 0.3) + c.accessBump),
    lastAccess: now,
    accessCount: (m.accessCount ?? 0) + 1,
    accessLog: log,
  };
}
export function like(m: Memory, now: number): Memory {
  const tier = Math.min(4, (m.tier ?? 2) + 1) as Tier;
  return {
    ...m,
    tier,
    lock: "pinned",
    lockedAt: now,
    trust: "stated",
    kept: true,
  };
}
export function dislike(m: Memory, now: number): Memory {
  const tier = Math.max(0, (m.tier ?? 2) - 1) as Tier;
  return {
    ...m,
    tier,
    activation: 0,
    decayPenalty: 2.0,
    lock: "none",
    lockedAt: now,
    kept: false,
  };
}
export function rememberPin(m: Memory, now: number, core = false): Memory {
  return {
    ...m,
    tier: (core ? 4 : 3) as Tier,
    lock: "pinned",
    lockedAt: now,
    trust: "stated",
    kept: true,
  };
}
export function forget(m: Memory, now: number, hard = false): Memory {
  if (hard)
    return {
      ...m,
      lock: "forgotten_hard",
      lockedAt: now,
      content: "",
      text: "",
      rawRef: null,
      tombstone: true,
    };
  return { ...m, lock: "suppressed", lockedAt: now, kept: false };
}
export function restore(m: Memory, now: number): Memory {
  if (m.lock === "forgotten_hard") return m; // cannot restore a tombstone
  return {
    ...m,
    lock: "none",
    lockedAt: now,
    activation: Math.max(m.activation ?? 0, 0.35),
    lastAccess: now,
    tombstone: false,
  };
}

// ---- the daily sweep (consolidation) ----

export interface SweepSummary {
  deindexed: number;
  promoted: number;
  demoted: number;
  merged: number;
  linked: number;
  scanned: number;
}

const wordsOf = (s: string) =>
  new Set(
    (s || "")
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 3),
  );
function similar(a: Memory, b: Memory): number {
  const wa = wordsOf(a.text),
    wb = wordsOf(b.text);
  if (!wa.size || !wb.size) return 0;
  const inter = [...wa].filter((w) => wb.has(w)).length;
  return inter / Math.max(1, Math.min(wa.size, wb.size));
}

export function consolidate(
  input: Memory[],
  now: number,
  c: MemoryConfig,
): { memories: Memory[]; summary: SweepSummary } {
  let memories = input.map((m) => ensureModel(m));
  const summary: SweepSummary = {
    deindexed: 0,
    promoted: 0,
    demoted: 0,
    merged: 0,
    linked: 0,
    scanned: memories.length,
  };

  // 1+2. de-index everything forgettable (retention below theta and past TTL)
  memories = memories.map((m) => {
    if (isForgettable(m, now, c)) {
      summary.deindexed++;
      return { ...m, lock: "suppressed" as Lock, note: "faded below recall" };
    }
    return m;
  });

  // 3. dedup near-identical active memories (fold the shorter into the longer)
  const active = memories.filter(
    (m) => (m.lock ?? "none") === "none" && !m.tombstone,
  );
  const folded = new Set<string>();
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i]!,
        b = active[j]!;
      if (folded.has(a.id) || folded.has(b.id)) continue;
      if (similar(a, b) >= 0.6) {
        const keep = a.text.length >= b.text.length ? a : b,
          drop = keep === a ? b : a;
        folded.add(drop.id);
        keep.edges = [...new Set([...(keep.edges ?? []), drop.id])];
        summary.merged++;
      }
    }
  }
  if (folded.size)
    memories = memories.map((m) =>
      folded.has(m.id)
        ? {
            ...m,
            lock: "suppressed" as Lock,
            note: "folded into a near-identical memory",
          }
        : m,
    );

  // 5. promote what earned its keep, demote cold memories (never below facet floor, never against a lock)
  memories = memories.map((m) => {
    if ((m.lock ?? "none") !== "none") return m;
    const recent = (m.accessLog ?? []).filter(
      (t) => now - t < c.promoteWindowDays * DAY,
    ).length;
    const facetMin = FACET_MIN[(m.facet as Facet) ?? "casual"];
    if (recent >= c.promoteAccesses && (m.tier ?? 2) < 4) {
      summary.promoted++;
      return { ...m, tier: Math.min(4, (m.tier ?? 2) + 1) as Tier };
    }
    if (
      recent === 0 &&
      retention(m, now, c) < c.theta + 0.1 &&
      (m.tier ?? 2) > facetMin
    ) {
      summary.demoted++;
      return { ...m, tier: Math.max(facetMin, (m.tier ?? 2) - 1) as Tier };
    }
    return m;
  });

  // 6. rebuild associative edges between related active memories
  const live = memories.filter(
    (m) =>
      (m.lock ?? "none") !== "suppressed" &&
      m.lock !== "forgotten_hard" &&
      !m.tombstone,
  );
  const edgeMap: Record<string, string[]> = {};
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i]!,
        b = live[j]!;
      const sharedTag = a.tags.some((t) => t !== "note" && b.tags.includes(t));
      if (sharedTag || similar(a, b) >= 0.3) {
        (edgeMap[a.id] ||= []).push(b.id);
        (edgeMap[b.id] ||= []).push(a.id);
        summary.linked++;
      }
    }
  }
  memories = memories.map((m) =>
    edgeMap[m.id]
      ? {
          ...m,
          edges: [...new Set([...(m.edges ?? []), ...edgeMap[m.id]!])].slice(
            0,
            8,
          ),
        }
      : m,
  );

  return { memories, summary };
}
