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
  isMeaningfulMemory,
  extract,
  retrieve,
  type WebResult,
  emptyState,
  ago,
  MODELS,
} from "./logic";
import {
  type CustomModel,
  providerInfo,
} from "@/lib/llm/byok";
import {
  loadVault as loadByokVault,
  addModel as addByokModel,
  removeModel as removeByokModel,
  unlockVault as unlockByokVault,
  decryptKeys as decryptByokKeys,
  enrollPasskey as enrollByokPasskeyVault,
} from "@/lib/llm/byok-vault";
import { completeByok } from "@/lib/llm/byok-client";
import {
  generateMedia,
  type GenerateEvent,
  type MediaOutput,
} from "@/lib/llm/generate";
import { modelKind, DEFAULT_MODEL } from "@/lib/llm/models";
import { ASK_MAX_TOKENS, askSystem, askUser } from "@/lib/llm/ask-prompt";
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
import type { SessionMeta } from "./walrus/sessions";
import type { RecalledMemory } from "./walrus/memory";
import type { ShareSummary } from "./walrus/sharing";
import { type UserProfile, profileToMemories } from "./profile";
import {
  type AgentTask,
  type AgentMessage,
  type AgentDef,
  type AgentRole,
  type MediaState,
  type AgentObservation,
  roleLabel,
  agentById,
  findAgent,
  makeAgent,
  isBuiltInAgent,
  newTask,
  newObservation,
  newMessage,
  addObservation,
  addOutput,
  setStatus as taskSetStatus,
  handoff as taskHandoff,
} from "./agents";
import {
  type LoopRun,
  type LoopSpec,
  newRun,
  newIteration,
  recordIteration,
  setRunStatus,
  budgetExceeded,
  allGatesPassed,
  skeletonSpec,
  spawnChildSpec,
  linkChild,
  hasBoardConflict,
} from "@/lib/cortex/loops";

const STEP_MEMORY_LIMIT = 6;
const ITERATION_DELAY_MS = 1200;
const REVIEW_PASS_PREFIX = /^\s*pass\b/i;

const mediaNoun = (output: MediaOutput): string =>
  output === "image" ? "an image" : output === "gif" ? "a GIF" : "a video";
const mediaPlural = (output: MediaOutput): string =>
  output === "image" ? "images" : output === "gif" ? "GIFs" : "video";

// Run a reviewer gate through the adversarial /api/loop-verify route, which picks a
// model distinct from the builder so the loop never grades its own work. Degrades to a
// failing verdict (escalate to a human) when the route is unreachable.
async function reviewWork(
  goal: string,
  output: string,
  rubric: string[],
  builderModel: string,
): Promise<{ verdict: "pass" | "fail"; review: string }> {
  try {
    const res = await fetch("/api/loop-verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ goal, output, rubric, builderModel }),
    });
    const d = (await res.json()) as { verdict?: string; review?: string };
    const verdict =
      d.verdict === "pass" || REVIEW_PASS_PREFIX.test(d.review ?? "")
        ? "pass"
        : "fail";
    return { verdict, review: typeof d.review === "string" ? d.review : "" };
  } catch {
    return {
      verdict: "fail",
      review: "Could not reach the verifier; escalating to a human.",
    };
  }
}

async function runAgentMediaStep(
  taskId: string,
  agent: AgentDef,
  goal: string,
  custom: CustomModel,
  get: () => State,
  set: (fn: (s: State) => Partial<State>) => void,
  memoryRefs: string[],
): Promise<void> {
  const output: MediaOutput =
    modelKind(custom) === "image"
      ? "image"
      : get().gifMode
        ? "gif"
        : "video";
  const base =
    output === "image"
      ? ("image" as const)
      : output === "gif"
        ? ("gif" as const)
        : ("video" as const);
  const byokKey = get().byokKeys[custom.id];
  const obsId = uid("obs");
  const now = Date.now();
  const initial: MediaState = byokKey
    ? { kind: base, status: "generating", progress: 0, mime: "", prompt: goal }
    : {
        kind: base,
        status: "error",
        mime: "",
        prompt: goal,
        reason: `Add your ${providerInfo(custom.provider).label} key to generate ${mediaPlural(output)}.`,
      };
  const obs: AgentObservation = {
    id: obsId,
    agentId: agent.id,
    text: `${agent.name} is generating ${mediaNoun(output)} for “${goal}”.`,
    ts: now,
    media: initial,
    ...(memoryRefs.length ? { memoryRefs } : {}),
  };
  set((s) => {
    const tasks = s.tasks.map((t) =>
      t.id === taskId ? addObservation(t, obs, now) : t,
    );
    persist({ memories: s.memories, events: s.events, cost: s.cost, tasks });
    return { tasks };
  });
  const update = (media: MediaState) => {
    set((s) => {
      const tasks = s.tasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              observations: t.observations.map((o) =>
                o.id === obsId ? { ...o, media } : o,
              ),
              updatedAt: Date.now(),
            }
          : t,
      );
      if (media.status !== "generating") {
        persist({ memories: s.memories, events: s.events, cost: s.cost, tasks });
      }
      return { tasks };
    });
  };
  if (!byokKey) return;
  await generateMedia(
    {
      provider: custom.provider,
      apiId: custom.apiId,
      baseUrl: custom.baseUrl,
      apiKey: byokKey,
      prompt: goal,
      output,
    },
    (ev: GenerateEvent) => {
      if (ev.phase === "start") {
        update({ kind: base, status: "generating", progress: 1, mime: "", prompt: goal });
      } else if (ev.phase === "progress") {
        update({ kind: base, status: "generating", progress: ev.progress, mime: "", prompt: goal });
      } else if (ev.phase === "partial") {
        update({
          kind: base,
          status: "generating",
          progress: ev.progress,
          dataUrl: ev.dataUrl,
          mime: ev.mime,
          prompt: goal,
        });
      } else if (ev.phase === "done") {
        update({
          kind: base,
          status: "done",
          progress: 100,
          dataUrl: ev.dataUrl,
          mime: ev.mime,
          prompt: goal,
        });
      } else {
        update({ kind: base, status: "error", mime: "", prompt: goal, reason: ev.reason });
      }
    },
  );
}

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
  rating?: "up" | "down";
  media?: MediaState;
}

type Mode = "remember" | "ask";
type Importance = "low" | "normal" | "high";

// A source document memories were distilled from  -  note, file or webpage. Tracks
// provenance (where it's from) and the memories it produced.
export interface CortexDocument {
  id: string;
  kind: "note" | "file" | "url";
  title: string;
  origin?: string; // url or filename
  summary: string;
  count: number;
  createdAt: number;
  memoryIds: string[];
  url?: string; // durable copy (Walrus aggregator) when stored
}

interface SessionCache {
  memories: Memory[];
  events: CortexEvent[];
  cost: Cost;
  config?: Partial<MemoryConfig>;
  lastSweep?: number;
  documents?: CortexDocument[];
  sessions?: SessionMeta[];
  activeId?: string;
  chatsById?: Record<string, ChatMsg[]>;
  tasks?: AgentTask[];
  agentMessages?: AgentMessage[];
  agents?: AgentDef[];
  loops?: LoopRun[];
}

interface State {
  memories: Memory[];
  events: CortexEvent[];
  cost: Cost;
  config: MemoryConfig;
  lastSweep: number;
  documents: CortexDocument[];
  sessions: SessionMeta[];
  activeId: string;
  tasks: AgentTask[];
  agentMessages: AgentMessage[];
  agents: AgentDef[];
  loops: LoopRun[];
  // memories other users have shared with me (cortex::sharing). Decrypted from each
  // active share on sign-in, shown in the brain tagged "shared" with the owner's
  // handle. Remote-sourced: re-loaded each session, never persisted or swept, so they
  // never mingle with my own memories' retention model.
  sharedMemories: Memory[];
  // shares I have created and granted to others (display + management).
  shares: ShareSummary[];
  // ephemeral UI
  mode: Mode;
  importance: Importance;
  model: Model;
  web: boolean;
  gifMode: boolean;
  docs: string[];
  chat: ChatMsg[];
  ready: boolean;
  // bring-your-own-key models (keys stay encrypted on-device)
  customModels: CustomModel[];
  byokUnlocked: boolean;
  byokKeys: Record<string, string>;
  byokError: string;
  // first-run profile (collected at sign-up, editable in settings)
  profile: UserProfile;
  onboarded: boolean;
  // actions
  hydrate: () => void;
  live: () => Memory[];
  remember: (text: string, importance: Importance) => void;
  ingestText: (text: string, source: string) => number;
  ingestSource: (input: {
    kind: "note" | "file" | "url";
    title: string;
    text: string;
    origin?: string;
    url?: string;
    facts?: string[];
  }) => { docId: string; facts: string[] };
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
  loadCustomModels: () => void;
  addCustomModel: (model: CustomModel, apiKey: string) => Promise<void>;
  removeCustomModel: (id: string) => void;
  unlockByok: () => Promise<boolean>;
  enrollByokPasskey: () => Promise<boolean>;
  toggleWeb: () => void;
  toggleGifMode: () => void;
  attachDoc: (name: string) => void;
  removeDoc: (i: number) => void;
  ask: (q: string, recalled?: RecalledMemory[]) => void;
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
  setChat: (chat: ChatMsg[]) => void;
  rateChat: (index: number, rating: "up" | "down") => void;
  setChatMediaBlob: (index: number, blobId: string) => void;
  setObsMediaBlob: (taskId: string, obsId: string, blobId: string) => void;
  setEvents: (events: CortexEvent[]) => void;
  setDocuments: (documents: CortexDocument[]) => void;
  newSession: () => void;
  switchSession: (id: string) => void;
  renameSession: (id: string, title: string) => void;
  setSessions: (sessions: SessionMeta[]) => void;
  // multi-agent collaboration
  createTask: (goal: string, assignTo: string) => string;
  runAgentStep: (
    taskId: string,
    recalled?: RecalledMemory[],
  ) => Promise<void>;
  handoffTask: (taskId: string, toAgentId: string) => void;
  completeTask: (taskId: string) => void;
  saveObservationAsMemory: (taskId: string, obsId: string) => string | null;
  setTasks: (tasks: AgentTask[]) => void;
  setAgentMessages: (messages: AgentMessage[]) => void;
  addAgent: (input: {
    name: string;
    role: AgentRole;
    accent: string;
    blurb?: string;
  }) => string;
  renameAgent: (id: string, name: string) => void;
  removeAgent: (id: string) => void;
  setAgents: (agents: AgentDef[]) => void;
  // agentic loops
  generateLoop: (task: string, assignTo: string) => Promise<string>;
  updateLoopSpec: (loopId: string, patch: Partial<LoopSpec>) => void;
  startLoop: (loopId: string) => void;
  stopLoop: (loopId: string) => void;
  discardLoop: (loopId: string) => void;
  spawnWorkerLoop: (parentId: string, workerGoal: string) => string;
  setLoops: (loops: LoopRun[]) => void;
  // memory sharing (cortex::sharing)
  setSharedMemories: (memories: Memory[]) => void;
  setShares: (shares: ShareSummary[]) => void;
  // hydrate the store's memories from a MemWal recall on sign-in (display + brain)
  loadMemoriesFromRecall: (recalled: RecalledMemory[]) => void;
  // replace the store's memories with the durable set restored from Sui on sign-in
  setMemories: (memories: Memory[]) => void;
  // profile + onboarding
  saveProfile: (profile: UserProfile) => void;
  setOnboarded: (flag: boolean) => void;
  seedProfileMemories: (profile: UserProfile) => string[];
}

const sessionCache: SessionCache = {
  memories: [],
  events: [],
  cost: { rawIngestedTokens: 0, dedupTokens: 0, retrievalTokens: 0, asks: 0 },
  chatsById: {},
};

function persist(s: {
  memories: Memory[];
  events: CortexEvent[];
  cost: Cost;
  config?: MemoryConfig;
  lastSweep?: number;
  documents?: CortexDocument[];
  chat?: ChatMsg[];
  sessions?: SessionMeta[];
  activeId?: string;
  tasks?: AgentTask[];
  agentMessages?: AgentMessage[];
  agents?: AgentDef[];
  loops?: LoopRun[];
}) {
  sessionCache.memories = s.memories;
  sessionCache.events = s.events;
  sessionCache.cost = s.cost;
  if (s.config) sessionCache.config = serializeConfig(s.config);
  if (s.lastSweep !== undefined) sessionCache.lastSweep = s.lastSweep;
  if (s.documents !== undefined) sessionCache.documents = s.documents;
  if (s.sessions !== undefined) sessionCache.sessions = s.sessions;
  if (s.activeId !== undefined) sessionCache.activeId = s.activeId;
  if (s.tasks !== undefined) sessionCache.tasks = s.tasks;
  if (s.agentMessages !== undefined) sessionCache.agentMessages = s.agentMessages;
  if (s.agents !== undefined) sessionCache.agents = s.agents;
  if (s.loops !== undefined) sessionCache.loops = s.loops;
  const activeId = sessionCache.activeId ?? "";
  if (s.chat !== undefined && activeId) {
    const chatsById = sessionCache.chatsById ?? {};
    chatsById[activeId] = s.chat;
    sessionCache.chatsById = chatsById;
  }
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

const PROFILE_KEY = "cortex-profile";
const ONBOARDED_KEY = "cortex-onboarded";

// Profile + onboarded start empty and are hydrated from the Sui stack on sign-in
// (see use-wallet loadProfile / loadHandle); they are never read from the browser.
function loadProfile(): UserProfile {
  return {};
}

function loadOnboarded(): boolean {
  return false;
}

export function clearLocalProfile(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PROFILE_KEY);
    window.localStorage.removeItem(ONBOARDED_KEY);
  } catch {}
}

export const useCortex = create<State>((set, get) => ({
  memories: [],
  events: [],
  cost: { rawIngestedTokens: 0, dedupTokens: 0, retrievalTokens: 0, asks: 0 },
  config: DEFAULT_CONFIG,
  lastSweep: 0,
  documents: [],
  sessions: [],
  activeId: "",
  tasks: [],
  agentMessages: [],
  agents: [],
  loops: [],
  sharedMemories: [],
  shares: [],
  mode: "ask",
  importance: "normal",
  model: MODELS.find((m) => m.name === DEFAULT_MODEL.name) ?? MODELS[1]!,
  web: false,
  gifMode: false,
  docs: [],
  chat: [],
  ready: false,
  customModels: [],
  byokUnlocked: false,
  byokKeys: {},
  byokError: "",
  profile: {},
  onboarded: false,

  hydrate: () => {
    const data: SessionCache =
      sessionCache.memories.length > 0 ? sessionCache : emptyState();
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
    const documents = data.documents ?? [];
    let sessions: SessionMeta[] = data.sessions ?? [];
    let activeId = data.activeId ?? "";
    const chatsById: Record<string, ChatMsg[]> = data.chatsById ?? {};
    if (!sessions.length) {
      const id = uid("ses");
      sessions = [{ id, title: "New chat", updatedAt: now }];
      activeId = id;
    }
    if (!sessions.some((x) => x.id === activeId)) activeId = sessions[0]!.id;
    const chat = chatsById[activeId] ?? [];
    const tasks = data.tasks ?? [];
    const agentMessages = data.agentMessages ?? [];
    const agents = data.agents ?? [];
    const loops = (data.loops ?? []).map((r) =>
      r.status === "running" ? setRunStatus(r, "paused", now) : r,
    );
    persist({
      memories,
      events,
      cost: data.cost,
      config,
      lastSweep,
      documents,
      chat,
      sessions,
      activeId,
      tasks,
      agentMessages,
      agents,
      loops,
    });
    set({
      memories,
      events,
      cost: data.cost,
      config,
      lastSweep,
      documents,
      chat,
      sessions,
      activeId,
      tasks,
      agentMessages,
      agents,
      loops,
      profile: loadProfile(),
      onboarded: loadOnboarded(),
      ready: true,
    });
  },

  live: () =>
    get()
      .memories.filter((m) => !m.tombstone && m.lock !== "forgotten_hard")
      .sort((a, b) => b.ts - a.ts),

  remember: (text, importance) => {
    const t = text.trim();
    if (!t || !isMeaningfulMemory(t)) return;
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
    const parts = extract(text).filter(isMeaningfulMemory);
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

  // Build memory from a source (note / file / webpage): distill it into fact
  // memories and record the source document for provenance. The caller pushes the
  // returned facts to Walrus Memory (memwal) when signed in.
  ingestSource: (input) => {
    const docId = uid("doc");
    const now = Date.now();
    // Prefer clean LLM-extracted facts (subject-anchored, consolidated) when the
    // caller supplies them; otherwise fall back to the heuristic splitter, then to
    // the whole text as a single memory.
    const provided = (input.facts ?? []).map((f) => f.trim()).filter(Boolean);
    const extracted = provided.length ? provided : extract(input.text);
    const facts = (
      extracted.length ? extracted : [input.text.trim()]
    ).filter(isMeaningfulMemory);
    if (!facts.length) return { docId, facts: [] };
    let createdFacts: string[] = [];
    set((s) => {
      const mems = facts.map((p) =>
        newMemory(
          {
            id: uid("mem"),
            text: p,
            tags: autoTags(p),
            ts: now,
            createdAt: now,
            source: input.title,
            docId,
            origin: input.origin,
          } as Memory,
          "normal",
          input.kind === "note" ? "stated" : "inferred",
        ),
      );
      createdFacts = mems.map((m) => m.text);
      const doc: CortexDocument = {
        id: docId,
        kind: input.kind,
        title: input.title,
        origin: input.origin,
        summary:
          input.text.trim().slice(0, 240) +
          (input.text.trim().length > 240 ? "…" : ""),
        count: mems.length,
        createdAt: now,
        memoryIds: mems.map((m) => m.id),
        url: input.url,
      };
      const cost = {
        ...s.cost,
        rawIngestedTokens: s.cost.rawIngestedTokens + toks(input.text),
      };
      const label =
        input.kind === "url"
          ? "Saved a link"
          : input.kind === "file"
            ? `Read “${input.title}”`
            : "Wrote a note";
      const events = logEvent(
        s.events,
        "imported",
        label,
        `${mems.length} ${mems.length === 1 ? "memory" : "memories"} from ${input.title}`,
      );
      const documents = [doc, ...s.documents];
      const next = {
        memories: [...mems, ...s.memories],
        events,
        cost,
        config: s.config,
        documents,
      };
      persist(next);
      return next;
    });
    return { docId, facts: createdFacts };
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
    set((s) => {
      const builtin = MODELS.find((m) => m.name === name);
      if (builtin) return { model: builtin };
      const custom = s.customModels.find((m) => m.label === name);
      if (!custom) return {};
      const label = providerInfo(custom.provider).label;
      return {
        model: {
          name: custom.label,
          prov: label,
          price: "BYOK",
          desc: `${label} · your key`,
        },
      };
    }),
  loadCustomModels: () => set({ customModels: loadByokVault().models }),
  addCustomModel: async (model, apiKey) => {
    try {
      await addByokModel(model, apiKey);
    } catch (err) {
      if ((err as Error).message !== "vault-locked") throw err;
      await unlockByokVault();
      await addByokModel(model, apiKey);
    }
    set((s) => ({
      customModels: [
        ...s.customModels.filter((m) => m.id !== model.id),
        model,
      ],
      byokKeys: { ...s.byokKeys, [model.id]: apiKey },
      byokUnlocked: true,
    }));
  },
  removeCustomModel: (id) => {
    removeByokModel(id);
    set((s) => {
      const byokKeys = { ...s.byokKeys };
      delete byokKeys[id];
      return {
        customModels: s.customModels.filter((m) => m.id !== id),
        byokKeys,
      };
    });
  },
  unlockByok: async () => {
    try {
      await unlockByokVault();
      const keys = await decryptByokKeys();
      set({ byokKeys: keys, byokUnlocked: true, byokError: "" });
      return true;
    } catch (err) {
      set({ byokError: (err as Error).message });
      return false;
    }
  },
  enrollByokPasskey: async () => {
    try {
      if (!get().byokUnlocked) await unlockByokVault();
      await enrollByokPasskeyVault();
      const keys = await decryptByokKeys();
      set({ byokKeys: keys, byokUnlocked: true, byokError: "" });
      return true;
    } catch (err) {
      set({ byokError: (err as Error).message });
      return false;
    }
  },
  toggleWeb: () => set((s) => ({ web: !s.web })),
  toggleGifMode: () => set((s) => ({ gifMode: !s.gifMode })),
  attachDoc: (name) => set((s) => ({ docs: [...s.docs, name] })),
  removeDoc: (i) => set((s) => ({ docs: s.docs.filter((_, j) => j !== i) })),

  ask: (q, recalled) => {
    q = q.trim();
    if (!q) return;
    const now = Date.now();
    const cfg = get().config;
    const live = get()
      .live()
      .filter((m) => isRetrievable(m, now, cfg));
    // Prefer the durable MemWal recall (passed in when signed in); otherwise fall
    // back to the local heuristic retrieve over the in-app store.
    const fromMemwal = !!(recalled && recalled.length);
    const memCites = fromMemwal
      ? recalled!.map((m) => ({
          id: m.blobId,
          text: m.text,
          tags: [] as string[],
          ts: now,
        }))
      : retrieve(q, live);
    // rehearsal: accessing a local memory strengthens its trace. MemWal-recalled
    // items aren't in the in-app store, so there's nothing to strengthen.
    if (!fromMemwal && memCites.length) {
      const citeIds = new Set(memCites.map((c) => c.id));
      set((s) => {
        const memories = s.memories.map((m) =>
          citeIds.has(m.id) ? onAccess(m, now, cfg) : m,
        );
        persist({ memories, events: s.events, cost: s.cost, config: s.config });
        return { memories };
      });
    }
    const web: WebResult[] = [];
    const sources: ChatSource[] = [
      ...memCites.map((c) => ({
        type: "memory" as const,
        label: c.tags[0] || "memory",
        text: c.text,
        when: c.ts ? ago(c.ts) : "",
      })),
      ...web,
    ];
    const allTok = live.reduce((s, m) => s + toks(m.text), 0);
    const sentTok = memCites.reduce((s, m) => s + toks(m.text), 0);
    const savedTok = Math.max(0, allTok - sentTok);
    const savedNote =
      !fromMemwal && memCites.length && live.length > memCites.length
        ? `sent ${memCites.length} of ${live.length} memories`
        : "";
    // Deterministic answer used when no model key is configured or the call fails.
    let fallback: string;
    if (!sources.length) {
      fallback =
        "I don't have a memory or source that touches on that yet. Keep a note about it, or turn on web search, and I'll be able to answer.";
    } else {
      const parts: string[] = [];
      if (memCites[0])
        parts.push(`From what you've kept, ${memCites[0].text} [1]`);
      if (memCites[1])
        parts.push(
          `you also noted ${memCites[1].text.charAt(0).toLowerCase()}${memCites[1].text.slice(1)} [2]`,
        );
      if (web.length)
        parts.push(
          `on the web, ${web[0]!.title.toLowerCase()} adds context [${memCites.length + 1}]`,
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
    set((s) => {
      const sessions = s.sessions.map((se) =>
        se.id === s.activeId
          ? {
              ...se,
              title:
                se.title === "New chat" ? q.slice(0, 40) || "New chat" : se.title,
              updatedAt: Date.now(),
            }
          : se,
      );
      return {
        chat: [...s.chat, msg],
        docs: [],
        sessions,
        cost: {
          ...s.cost,
          retrievalTokens: s.cost.retrievalTokens + savedTok,
          asks: s.cost.asks + 1,
        },
      };
    });
    persist({
      memories: get().memories,
      events: get().events,
      cost: get().cost,
      chat: get().chat,
      sessions: get().sessions,
      activeId: get().activeId,
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
          persist({
            memories: get().memories,
            events: get().events,
            cost: get().cost,
            chat: get().chat,
            sessions: get().sessions,
            activeId: get().activeId,
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
    const askMems = memCites.map((c) => ({
      text: c.text,
      label: c.tags[0] || "note",
      when: ago(c.ts),
    }));
    // Carry the prior turns (every chat msg except the empty one just pushed for
    // this question) so follow-ups like "how did you know?" have the conversation.
    const askHist = get()
      .chat.slice(0, -1)
      .map((m) => ({ q: m.q, a: m.a }));
    const selected = get().model;
    const custom = get().customModels.find((m) => m.label === selected.name);
    const byokKey = custom ? get().byokKeys[custom.id] : undefined;
    const kind = custom ? modelKind(custom) : "text";
    if (custom && kind !== "text") {
      const output: MediaOutput =
        kind === "image" ? "image" : get().gifMode ? "gif" : "video";
      const base =
        output === "image"
          ? ("image" as const)
          : output === "gif"
            ? ("gif" as const)
            : ("video" as const);
      const setMedia = (media: MediaState) => {
        set((s) => {
          const chat = [...s.chat];
          const last = chat[chat.length - 1];
          if (last) {
            last.media = media;
            last.streaming = media.status === "generating";
            if (media.status !== "generating") last.a = "";
          }
          return { chat };
        });
        if (media.status !== "generating") {
          persist({
            memories: get().memories,
            events: get().events,
            cost: get().cost,
            chat: get().chat,
            sessions: get().sessions,
            activeId: get().activeId,
          });
        }
      };
      if (!byokKey) {
        setMedia({
          kind: base,
          status: "error",
          mime: "",
          prompt: q,
          reason: `Add your ${providerInfo(custom.provider).label} key to generate ${mediaPlural(output)}.`,
        });
        return;
      }
      setMedia({
        kind: base,
        status: "generating",
        progress: 0,
        mime: "",
        prompt: q,
      });
      void generateMedia(
        {
          provider: custom.provider,
          apiId: custom.apiId,
          baseUrl: custom.baseUrl,
          apiKey: byokKey,
          prompt: q,
          output,
        },
        (ev: GenerateEvent) => {
          if (ev.phase === "start") {
            setMedia({ kind: base, status: "generating", progress: 1, mime: "", prompt: q });
          } else if (ev.phase === "progress") {
            setMedia({ kind: base, status: "generating", progress: ev.progress, mime: "", prompt: q });
          } else if (ev.phase === "partial") {
            setMedia({
              kind: base,
              status: "generating",
              progress: ev.progress,
              dataUrl: ev.dataUrl,
              mime: ev.mime,
              prompt: q,
            });
          } else if (ev.phase === "done") {
            setMedia({
              kind: base,
              status: "done",
              progress: 100,
              dataUrl: ev.dataUrl,
              mime: ev.mime,
              prompt: q,
            });
          } else {
            setMedia({ kind: base, status: "error", mime: "", prompt: q, reason: ev.reason });
          }
        },
      );
      return;
    }
    if (custom && byokKey) {
      completeByok({
        provider: custom.provider,
        apiId: custom.apiId,
        baseUrl: custom.baseUrl,
        apiKey: byokKey,
        system: askSystem(get().web),
        user: askUser(q, askMems, askHist),
        maxTokens: ASK_MAX_TOKENS,
      })
        .then((r) => stream(r.ok ? r.text : fallback))
        .catch(() => stream(fallback));
      return;
    }
    fetch("/api/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question: q,
        memories: askMems,
        history: askHist,
        web: get().web,
        model: selected.name,
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
  // Restore a session (e.g. from the durable Walrus/Sui copy) into the local view.
  setChat: (chat) =>
    set(() => {
      persist({
        memories: get().memories,
        events: get().events,
        cost: get().cost,
        chat,
      });
      return { chat };
    }),
  rateChat: (index, rating) =>
    set((s) => {
      const chat = s.chat.map((m, i) =>
        i === index
          ? { ...m, rating: m.rating === rating ? undefined : rating }
          : m,
      );
      persist({
        memories: s.memories,
        events: s.events,
        cost: s.cost,
        chat,
      });
      return { chat };
    }),
  setChatMediaBlob: (index, blobId) =>
    set((s) => {
      const chat = s.chat.map((m, i) =>
        i === index && m.media
          ? { ...m, media: { ...m.media, blobId } }
          : m,
      );
      persist({ memories: s.memories, events: s.events, cost: s.cost, chat });
      return { chat };
    }),
  setObsMediaBlob: (taskId, obsId, blobId) =>
    set((s) => {
      const tasks = s.tasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              observations: t.observations.map((o) =>
                o.id === obsId && o.media
                  ? { ...o, media: { ...o.media, blobId } }
                  : o,
              ),
            }
          : t,
      );
      persist({ memories: s.memories, events: s.events, cost: s.cost, tasks });
      return { tasks };
    }),
  // Restore the durable timeline / documents into the local view.
  setEvents: (events) =>
    set((s) => {
      persist({ memories: s.memories, events, cost: s.cost });
      return { events };
    }),
  setDocuments: (documents) =>
    set((s) => {
      persist({ memories: s.memories, events: s.events, cost: s.cost, documents });
      return { documents };
    }),
  setSessions: (sessions) =>
    set((s) => {
      persist({ memories: s.memories, events: s.events, cost: s.cost, sessions });
      return { sessions };
    }),
  newSession: () =>
    set((s) => {
      // Already on a fresh, empty chat: don't spawn another one.
      if (s.chat.length === 0 && s.activeId) return {};
      const id = uid("ses");
      persist({
        memories: s.memories,
        events: s.events,
        cost: s.cost,
        chat: s.chat,
      });
      const sessions = [
        { id, title: "New chat", updatedAt: Date.now() },
        ...s.sessions,
      ];
      persist({
        memories: s.memories,
        events: s.events,
        cost: s.cost,
        sessions,
        activeId: id,
        chat: [],
      });
      return { sessions, activeId: id, chat: [] };
    }),
  switchSession: (id) =>
    set((s) => {
      if (id === s.activeId) return {};
      persist({
        memories: s.memories,
        events: s.events,
        cost: s.cost,
        chat: s.chat,
      });
      const chat: ChatMsg[] = sessionCache.chatsById?.[id] ?? [];
      persist({
        memories: s.memories,
        events: s.events,
        cost: s.cost,
        activeId: id,
        chat,
      });
      return { activeId: id, chat };
    }),
  renameSession: (id, title) =>
    set((s) => {
      const sessions = s.sessions.map((se) =>
        se.id === id ? { ...se, title: title || se.title } : se,
      );
      persist({ memories: s.memories, events: s.events, cost: s.cost, sessions });
      return { sessions };
    }),
  // ---- multi-agent collaboration ----
  // A small team of specialist agents share this same memory store. Tasks and the
  // agent message bus live in the in-session store and sync to Walrus/Sui
  // (agents:tasks, agents:bus) exactly like sessions/timeline/documents.
  createTask: (goal, assignTo) => {
    const g = goal.trim();
    if (!g) return "";
    const now = Date.now();
    const agent = findAgent(get().agents, assignTo) ?? get().agents[0];
    if (!agent) return "";
    const task = newTask(g, agent.id, "user", now);
    const msg = newMessage(
      "user",
      agent.id,
      task.id,
      "handoff",
      `New task assigned to ${agent.name}: ${g}`,
      now,
    );
    set((s) => {
      const tasks = [task, ...s.tasks];
      const agentMessages = [msg, ...s.agentMessages];
      const events = logEvent(
        s.events,
        "agent",
        `Opened a task for ${agent.name}`,
        g.length > 60 ? g.slice(0, 60) + "…" : g,
      );
      persist({
        memories: s.memories,
        events,
        cost: s.cost,
        tasks,
        agentMessages,
      });
      return { tasks, agentMessages, events };
    });
    return task.id;
  },
  runAgentStep: async (taskId, recalled) => {
    const state = get();
    const task = state.tasks.find((t) => t.id === taskId);
    if (!task) return;
    const agent = findAgent(state.agents, task.assignedTo) ?? state.agents[0];
    if (!agent) return;
    const now = Date.now();
    const cfg = state.config;
    const live = state.live().filter((m) => isRetrievable(m, now, cfg));
    // Smart memory: prefer the durable MemWal recall (passed in from the wallet,
    // semantically matched to the goal); fall back to the local heuristic retrieve
    // so the agent still has context when signed out.
    const cites =
      recalled && recalled.length
        ? recalled.slice(0, STEP_MEMORY_LIMIT).map((r) => ({
            id: r.blobId,
            text: r.text,
            tags: [] as string[],
            ts: now,
          }))
        : retrieve(task.goal, live).slice(0, STEP_MEMORY_LIMIT);
    const memoryRefs = cites.map((c) => c.id);
    // Carry the room thread for this task (oldest first), so the agent sees the
    // user's @mentions, handoffs and prior results - the conversation, not just
    // its own observations.
    const thread = state.agentMessages
      .filter((m) => m.taskId === taskId)
      .slice()
      .reverse()
      .map((m) => ({
        from:
          m.from === "user"
            ? "You"
            : (findAgent(state.agents, m.from)?.name ?? m.from),
        text: m.content,
      }));
    set((s) => {
      const tasks = s.tasks.map((t) =>
        t.id === taskId ? taskSetStatus(t, "in_progress", now) : t,
      );
      persist({ memories: s.memories, events: s.events, cost: s.cost, tasks });
      return { tasks };
    });
    const selected = state.model;
    const custom = state.customModels.find((m) => m.label === selected.name);
    const kind = custom ? modelKind(custom) : "text";
    if (custom && kind !== "text") {
      await runAgentMediaStep(taskId, agent, task.goal, custom, get, set, memoryRefs);
      return;
    }
    let observationText: string;
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          agentId: agent.id,
          system: agent.system,
          goal: task.goal,
          observations: task.observations.map((o) => o.text),
          memories: cites.map((c) => ({
            text: c.text,
            label: c.tags[0] || "note",
            when: ago(c.ts),
          })),
          thread,
          model: get().model.name,
        }),
      });
      const data = (await res.json()) as { observation?: string };
      observationText =
        typeof data.observation === "string" && data.observation
          ? data.observation
          : `${agent.name} reviewed “${task.goal}” but produced no output.`;
    } catch {
      observationText = `${agent.name} could not reach the model for “${task.goal}”.`;
    }
    const after = Date.now();
    const obs = newObservation(agent.id, observationText, after, memoryRefs);
    const message = newMessage(
      agent.id,
      "team",
      taskId,
      "result",
      observationText,
      after,
    );
    set((s) => {
      const tasks = s.tasks.map((t) =>
        t.id === taskId ? addObservation(t, obs, after) : t,
      );
      const agentMessages = [message, ...s.agentMessages];
      const events = logEvent(
        s.events,
        "agent",
        `${agent.name} worked the task`,
        observationText.length > 60
          ? observationText.slice(0, 60) + "…"
          : observationText,
      );
      persist({
        memories: s.memories,
        events,
        cost: s.cost,
        tasks,
        agentMessages,
      });
      return { tasks, agentMessages, events };
    });
  },
  handoffTask: (taskId, toAgentId) =>
    set((s) => {
      const now = Date.now();
      const task = s.tasks.find((t) => t.id === taskId);
      const to = findAgent(s.agents, toAgentId);
      if (!task || !to) return {};
      const from = findAgent(s.agents, task.assignedTo);
      const tasks = s.tasks.map((t) =>
        t.id === taskId ? taskHandoff(t, toAgentId, now) : t,
      );
      const msg = newMessage(
        task.assignedTo,
        toAgentId,
        taskId,
        "handoff",
        `${from?.name ?? "Someone"} handed “${task.goal}” to ${to.name} to continue.`,
        now,
      );
      const agentMessages = [msg, ...s.agentMessages];
      const events = logEvent(
        s.events,
        "agent",
        `Handoff to ${to.name}`,
        task.goal.length > 60 ? task.goal.slice(0, 60) + "…" : task.goal,
      );
      persist({
        memories: s.memories,
        events,
        cost: s.cost,
        tasks,
        agentMessages,
      });
      return { tasks, agentMessages, events };
    }),
  completeTask: (taskId) =>
    set((s) => {
      const now = Date.now();
      const task = s.tasks.find((t) => t.id === taskId);
      if (!task) return {};
      const agent = findAgent(s.agents, task.assignedTo);
      const lastObs = task.observations[task.observations.length - 1];
      let updated = taskSetStatus(task, "done", now);
      if (lastObs) updated = addOutput(updated, lastObs.text, now);
      const tasks = s.tasks.map((t) => (t.id === taskId ? updated : t));
      const msg = newMessage(
        task.assignedTo,
        "team",
        taskId,
        "result",
        `Task “${task.goal}” marked done by ${agent?.name ?? "the team"}.`,
        now,
      );
      const agentMessages = [msg, ...s.agentMessages];
      const events = logEvent(
        s.events,
        "agent",
        "Closed a task",
        task.goal.length > 60 ? task.goal.slice(0, 60) + "…" : task.goal,
      );
      persist({
        memories: s.memories,
        events,
        cost: s.cost,
        tasks,
        agentMessages,
      });
      return { tasks, agentMessages, events };
    }),
  saveObservationAsMemory: (taskId, obsId) => {
    const state = get();
    const task = state.tasks.find((t) => t.id === taskId);
    const obs = task?.observations.find((o) => o.id === obsId);
    if (!task || !obs) return null;
    const agent = findAgent(state.agents, obs.agentId);
    const now = Date.now();
    const base: Memory = {
      id: uid("mem"),
      text: obs.text,
      tags: autoTags(obs.text),
      ts: now,
      createdAt: now,
      source: agent ? `agent:${agent.name}` : "agent",
    };
    const m = newMemory(base, "normal", "inferred");
    set((s) => {
      const memories = [m, ...s.memories];
      const events = logEvent(
        s.events,
        "agent",
        `${agent?.name ?? "An agent"} saved a finding to memory`,
        obs.text.length > 60 ? obs.text.slice(0, 60) + "…" : obs.text,
      );
      persist({ memories, events, cost: s.cost });
      return { memories, events };
    });
    return obs.text;
  },
  setTasks: (tasks) =>
    set((s) => {
      persist({ memories: s.memories, events: s.events, cost: s.cost, tasks });
      return { tasks };
    }),
  setAgentMessages: (agentMessages) =>
    set((s) => {
      persist({
        memories: s.memories,
        events: s.events,
        cost: s.cost,
        agentMessages,
      });
      return { agentMessages };
    }),
  addAgent: (input) => {
    const name = input.name.trim();
    if (!name) return "";
    const agent = makeAgent(input);
    set((s) => {
      const agents = [...s.agents, agent];
      const events = logEvent(
        s.events,
        "agent",
        `Added agent ${agent.name}`,
        `${roleLabel(agent.role)} · ${agent.blurb}`,
      );
      persist({ memories: s.memories, events, cost: s.cost, agents });
      return { agents, events };
    });
    return agent.id;
  },
  renameAgent: (id, name) =>
    set((s) => {
      const next = name.trim();
      if (!next) return {};
      const agents = s.agents.map((a) =>
        a.id === id ? { ...a, name: next } : a,
      );
      persist({ memories: s.memories, events: s.events, cost: s.cost, agents });
      return { agents };
    }),
  removeAgent: (id) =>
    set((s) => {
      if (isBuiltInAgent(id)) return {};
      const agents = s.agents.filter((a) => a.id !== id);
      persist({ memories: s.memories, events: s.events, cost: s.cost, agents });
      return { agents };
    }),
  setAgents: (agents) =>
    set((s) => {
      persist({ memories: s.memories, events: s.events, cost: s.cost, agents });
      return { agents };
    }),
  // ---- agentic loops ----
  // A loop spec is generated from the agent's memory (same generator as Studio),
  // then run as a self-correcting cycle: each iteration runs the assigned agent
  // (sense→decide→act), then a verification gate decides done. Reviewer gates run
  // in-browser via the critic; command/invariant gates escalate to a human/executor.
  generateLoop: async (task, assignTo) => {
    const goal = task.trim();
    if (!goal) return "";
    const agent =
      findAgent(get().agents, assignTo) ?? agentById(assignTo) ?? get().agents[0];
    if (!agent) return "";
    const now = Date.now();
    const cfg = get().config;
    const live = get()
      .live()
      .filter((m) => isRetrievable(m, now, cfg));
    const cites = retrieve(goal, live).slice(0, STEP_MEMORY_LIMIT);
    let spec: LoopSpec;
    try {
      const res = await fetch("/api/loop-spec", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          task: goal,
          agentId: agent.id,
          memories: cites.map((c) => ({
            text: c.text,
            label: c.tags[0] || "note",
            when: ago(c.ts),
          })),
          model: get().model.name,
        }),
      });
      const data = (await res.json()) as { spec?: LoopSpec };
      spec = data.spec ?? skeletonSpec({ goal, agentId: agent.id }, Date.now());
    } catch {
      spec = skeletonSpec({ goal, agentId: agent.id }, Date.now());
    }
    const run = newRun(spec, Date.now());
    set((s) => {
      const loops = [run, ...s.loops];
      const events = logEvent(
        s.events,
        "agent",
        `Drafted a loop for ${agent.name}`,
        goal.length > 60 ? goal.slice(0, 60) + "…" : goal,
      );
      persist({ memories: s.memories, events, cost: s.cost, loops });
      return { loops, events };
    });
    return run.spec.id;
  },
  // Edit a draft loop's spec from the "edit advanced" affordance before it starts.
  // Only the spec is patched; the run's trace and status are untouched.
  updateLoopSpec: (loopId, patch) =>
    set((s) => {
      const now = Date.now();
      const loops = s.loops.map((r) =>
        r.spec.id === loopId
          ? { ...r, spec: { ...r.spec, ...patch, updatedAt: now }, updatedAt: now }
          : r,
      );
      persist({ memories: s.memories, events: s.events, cost: s.cost, loops });
      return { loops };
    }),
  startLoop: (loopId) => {
    set((s) => {
      const at = Date.now();
      const loops = s.loops.map((r) =>
        r.spec.id === loopId
          ? { ...setRunStatus(r, "running", at), startedAt: r.startedAt ?? at }
          : r,
      );
      persist({ memories: s.memories, events: s.events, cost: s.cost, loops });
      return { loops };
    });
    const finish = (status: LoopRun["status"]) =>
      set((s) => {
        const loops = s.loops.map((r) =>
          r.spec.id === loopId ? setRunStatus(r, status, Date.now()) : r,
        );
        persist({ memories: s.memories, events: s.events, cost: s.cost, loops });
        return { loops };
      });
    const askAgent = async (
      agentId: string,
      goal: string,
      observations: string[],
      cites: Memory[],
    ): Promise<string> => {
      try {
        const res = await fetch("/api/agent", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            agentId,
            goal,
            observations,
            memories: cites.map((c) => ({
              text: c.text,
              label: c.tags[0] || "note",
              when: ago(c.ts),
            })),
            model: get().model.name,
          }),
        });
        const d = (await res.json()) as { observation?: string };
        return typeof d.observation === "string" ? d.observation : "";
      } catch {
        return "";
      }
    };
    const drive = async () => {
      for (;;) {
        const run = get().loops.find((r) => r.spec.id === loopId);
        if (!run || run.status !== "running") return;
        if (budgetExceeded(run, Date.now())) {
          finish("gave_up");
          return;
        }
        const agent =
          findAgent(get().agents, run.spec.agentId) ??
          agentById(run.spec.agentId) ??
          get().agents[0];
        if (!agent) {
          finish("gave_up");
          return;
        }
        const now = Date.now();
        const cfg = get().config;
        const live = get()
          .live()
          .filter((m) => isRetrievable(m, now, cfg));
        const cites = retrieve(run.spec.goal, live).slice(0, STEP_MEMORY_LIMIT);
        const priorObs = run.iterations.map((it) => it.acted);
        const acted = await askAgent(
          agent.id,
          run.spec.goal,
          priorObs,
          cites,
        );
        const reviewer = run.spec.gates.find((g) => g.kind === "reviewer");
        const command = run.spec.gates.find((g) => g.kind !== "reviewer");
        let verdict: "pass" | "fail" | "pending" = "pending";
        let gate: string | undefined;
        let feedback = "";
        if (reviewer) {
          const judgment = await reviewWork(
            run.spec.goal,
            acted,
            [reviewer.check],
            get().model.name,
          );
          feedback = judgment.review;
          verdict = judgment.verdict;
          gate = reviewer.name;
        } else if (command) {
          verdict = "pending";
          gate = command.name;
          feedback = `Gate "${command.check}" needs a server/MCP executor to run; escalating to you.`;
        }
        const it = newIteration(
          {
            n: run.iterations.length + 1,
            sensed: `goal + ${cites.length} memories`,
            decided: `${agent.name} chose the next action`,
            acted,
            feedback,
            verdict,
            gate,
            tokens: toks(acted) + toks(feedback),
          },
          Date.now(),
        );
        set((s) => {
          const loops = s.loops.map((r) =>
            r.spec.id === loopId ? recordIteration(r, it, Date.now()) : r,
          );
          persist({
            memories: s.memories,
            events: s.events,
            cost: s.cost,
            loops,
          });
          return { loops };
        });
        const updated = get().loops.find((r) => r.spec.id === loopId);
        if (!updated || updated.status !== "running") return;
        if (verdict === "pending") {
          finish("waiting_human");
          return;
        }
        if (verdict === "pass" && allGatesPassed(updated)) {
          finish("waiting_human");
          return;
        }
        if (budgetExceeded(updated, Date.now())) {
          finish("gave_up");
          return;
        }
        await new Promise((r) => setTimeout(r, ITERATION_DELAY_MS));
      }
    };
    void drive();
  },
  stopLoop: (loopId) =>
    set((s) => {
      const loops = s.loops.map((r) =>
        r.spec.id === loopId && r.status === "running"
          ? setRunStatus(r, "paused", Date.now())
          : r,
      );
      persist({ memories: s.memories, events: s.events, cost: s.cost, loops });
      return { loops };
    }),
  // Drop a loop the user never confirmed (or no longer wants). Removes it and any
  // worker loops it spawned so a discarded draft leaves no orphans behind.
  discardLoop: (loopId) =>
    set((s) => {
      const loops = s.loops.filter(
        (r) => r.spec.id !== loopId && r.spec.parentId !== loopId,
      );
      persist({ memories: s.memories, events: s.events, cost: s.cost, loops });
      return { loops };
    }),
  // Composition: a monitor/coordinator loop spawns a worker loop for one task. The
  // child links to its parent and runs sequentially; a parallel spawn would be refused
  // when another running loop targets the same board entry (hasBoardConflict guard).
  spawnWorkerLoop: (parentId, workerGoal) => {
    const goal = workerGoal.trim();
    const parent = get().loops.find((r) => r.spec.id === parentId);
    if (!parent || !goal) return "";
    if (parent.spec.role !== "monitor" && parent.spec.role !== "coordinator")
      return "";
    const now = Date.now();
    const child = spawnChildSpec(
      parent.spec,
      { goal, role: "worker", concurrency: "sequential" },
      now,
    );
    if (
      child.concurrency === "parallel" &&
      hasBoardConflict(get().loops, child)
    )
      return "";
    const childRun = newRun(child, now);
    set((s) => {
      const loops = [
        childRun,
        ...s.loops.map((r) =>
          r.spec.id === parentId
            ? { ...r, spec: linkChild(r.spec, child.id, now), updatedAt: now }
            : r,
        ),
      ];
      const parentAgent = agentById(parent.spec.agentId);
      const events = logEvent(
        s.events,
        "agent",
        `${parentAgent?.name ?? "A monitor loop"} spawned a worker loop`,
        goal.length > 60 ? goal.slice(0, 60) + "…" : goal,
      );
      persist({ memories: s.memories, events, cost: s.cost, loops });
      return { loops, events };
    });
    return child.id;
  },
  setLoops: (loops) =>
    set((s) => {
      persist({ memories: s.memories, events: s.events, cost: s.cost, loops });
      return { loops };
    }),
  setSharedMemories: (sharedMemories) => set({ sharedMemories }),
  setShares: (shares) => set({ shares }),
  loadMemoriesFromRecall: (recalled) =>
    set((s) => {
      const now = Date.now();
      const have = new Set(s.memories.map((m) => m.id));
      // Skip internal markers (tombstones, verify stamps) the relayer stores as
      // rows, and anything already in the store.
      const fresh = recalled
        .filter(
          (r) =>
            r.text.trim() &&
            !r.text.startsWith("__") &&
            isMeaningfulMemory(r.text) &&
            !have.has(r.blobId),
        )
        .map((r) =>
          newMemory(
            {
              id: r.blobId,
              text: r.text,
              tags: autoTags(r.text),
              ts: now,
              createdAt: now,
              source: "memwal",
              blobId: r.blobId,
            },
            "normal",
            "stated",
          ),
        );
      if (!fresh.length) return {};
      const memories = [...fresh, ...s.memories];
      persist({ memories, events: s.events, cost: s.cost, config: s.config });
      return { memories };
    }),
  setMemories: (memories) =>
    set((s) => {
      persist({ memories, events: s.events, cost: s.cost, config: s.config });
      return { memories };
    }),
  // Profile + onboarded are durable on the Sui stack (a Walrus blob pointed to by
  // the account's PROFILE_KEY setting), hydrated on sign-in. Keep them in memory
  // only here; nothing personal is written to the browser.
  saveProfile: (profile) => set({ profile }),
  setOnboarded: (flag) => set({ onboarded: flag }),
  seedProfileMemories: (profile) => {
    const facts = profileToMemories(profile);
    if (!facts.length) return [];
    const now = Date.now();
    const mems = facts.map(({ text, high }) =>
      newMemory(
        {
          id: uid("mem"),
          text,
          tags: autoTags(text),
          ts: now,
          createdAt: now,
          source: "profile",
          importance: high ? "high" : "normal",
          kept: high,
        } as Memory,
        high ? "high" : "normal",
        "stated",
      ),
    );
    set((s) => {
      const memories = [...mems, ...s.memories];
      const cost = {
        ...s.cost,
        rawIngestedTokens:
          s.cost.rawIngestedTokens +
          facts.reduce((n, f) => n + toks(f.text), 0),
      };
      const events = logEvent(
        s.events,
        "added",
        "Seeded memory from your profile",
        `${facts.length} ${facts.length === 1 ? "fact" : "facts"} about you`,
      );
      const next = { memories, events, cost, config: s.config };
      persist(next);
      return next;
    });
    return facts.map((f) => f.text);
  },
  resetMemory: () =>
    set((s) => {
      const fresh = emptyState();
      const next = {
        memories: fresh.memories,
        events: fresh.events,
        cost: fresh.cost,
        config: s.config,
        lastSweep: 0,
        tasks: [],
        agentMessages: [],
        loops: [],
      };
      persist(next);
      return { ...next, chat: [] };
    }),
}));
