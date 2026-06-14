// The collaboration layer for the MCP hub. A small team of specialist agents work
// over the same Walrus-backed memory plane the rest of Cortex uses. Their shared
// task board and message bus are themselves durable memories: each lives in a
// dedicated MemWal sub-namespace as an event-sourced JSON record, so any MCP host
// or external agent reads and extends the exact same state. Mirrors the browser
// roster in src/lib/cortex/agents.ts (separate runtime, same ids and prompts).

import { randomUUID } from "node:crypto";
import type { Config } from "./config";
import type { Clients } from "../../sui/app/clients";

export type AgentRole = "researcher" | "curator" | "planner" | "critic";
export type TaskStatus = "open" | "in_progress" | "blocked" | "done";
export type AgentMessageKind = "handoff" | "note" | "result";

export interface AgentDef {
  id: string;
  name: string;
  role: AgentRole;
  blurb: string;
  system: string;
}

const SHARED_CLAUSE =
  "You and your three teammates (a researcher, a curator, a planner, and a critic) share one durable memory stored on Walrus. Ground every claim in the shared memories supplied to you; never invent facts that aren't supported there. Be concise. End with exactly one concrete next action or a handoff suggestion naming the teammate who should take it.";

export const AGENTS: AgentDef[] = [
  {
    id: "agent_researcher",
    name: "Atlas",
    role: "researcher",
    blurb: "Gathers facts and links, proposes new memories.",
    system: `You are Atlas, the team's researcher. Your specialty is gathering facts, sources, and links, and proposing new memories worth keeping. ${SHARED_CLAUSE}`,
  },
  {
    id: "agent_curator",
    name: "Vesta",
    role: "curator",
    blurb: "Organizes, dedupes, and tags memories; decides what to keep.",
    system: `You are Vesta, the team's curator. Your specialty is organizing, deduping, and tagging the shared memory, and deciding what is worth keeping versus letting fade. ${SHARED_CLAUSE}`,
  },
  {
    id: "agent_planner",
    name: "Orion",
    role: "planner",
    blurb: "Breaks goals into steps, sequences work, assigns handoffs.",
    system: `You are Orion, the team's planner. Your specialty is breaking a goal into ordered steps, sequencing the work, and assigning handoffs to the right teammate. ${SHARED_CLAUSE}`,
  },
  {
    id: "agent_critic",
    name: "Juno",
    role: "critic",
    blurb: "Reviews outputs, flags gaps and contradictions, validates.",
    system: `You are Juno, the team's critic. Your specialty is reviewing the team's outputs, flagging gaps, contradictions, and unsupported claims, and validating that work matches the shared memory. ${SHARED_CLAUSE}`,
  },
];

export function agentById(id: string): AgentDef | undefined {
  return AGENTS.find((a) => a.id === id);
}

export function agentByRole(role: AgentRole): AgentDef {
  const found = AGENTS.find((a) => a.role === role);
  if (!found) throw new Error(`No agent defined for role "${role}"`);
  return found;
}

export interface AgentObservation {
  id: string;
  agentId: string;
  text: string;
  ts: string;
  memoryRefs?: string[];
}

const TASK_KIND = "cortex.agent.task.v1";
const MESSAGE_KIND = "cortex.agent.message.v1";

export interface AgentTaskRecord {
  kind: typeof TASK_KIND;
  id: string;
  goal: string;
  status: TaskStatus;
  assignedTo: string;
  createdBy: string;
  observations: AgentObservation[];
  outputs: string[];
  createdAt: string;
  updatedAt: string;
  rev: number;
}

export interface AgentMessageRecord {
  kind: typeof MESSAGE_KIND;
  id: string;
  from: string;
  to: string;
  taskId: string;
  messageKind: AgentMessageKind;
  content: string;
  ts: string;
}

const TASKS_SUFFIX = ":agents:tasks";
const BUS_SUFFIX = ":agents:bus";
const DEFAULT_RECALL_LIMIT = 6;
const STEP_MAX_TOKENS = 700;
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export function tasksNamespace(cfg: Config): string {
  return cfg.namespace + TASKS_SUFFIX;
}

export function busNamespace(cfg: Config): string {
  return cfg.namespace + BUS_SUFFIX;
}

function rid(prefix: string): string {
  return prefix + "_" + randomUUID().slice(0, 8);
}

function now(): string {
  return new Date().toISOString();
}

function parseTask(text: string): AgentTaskRecord | null {
  try {
    const r = JSON.parse(text) as AgentTaskRecord;
    return r && r.kind === TASK_KIND ? r : null;
  } catch {
    return null;
  }
}

function parseMessage(text: string): AgentMessageRecord | null {
  try {
    const r = JSON.parse(text) as AgentMessageRecord;
    return r && r.kind === MESSAGE_KIND ? r : null;
  } catch {
    return null;
  }
}

async function persistTask(
  c: Clients,
  cfg: Config,
  task: AgentTaskRecord,
): Promise<AgentTaskRecord> {
  await c.memwal.remember(tasksNamespace(cfg), JSON.stringify(task), {
    agent: task.assignedTo,
    via: "remember",
    tags: ["agent-task", task.id, task.status],
  });
  return task;
}

// Event-sourced read: the namespace holds every snapshot ever written; fold to the
// latest revision per task id.
export async function listTasks(
  c: Clients,
  cfg: Config,
): Promise<AgentTaskRecord[]> {
  const { memories } = await c.memwal.restore(tasksNamespace(cfg));
  const latest = new Map<string, AgentTaskRecord>();
  for (const m of memories) {
    const task = parseTask(m.text);
    if (!task) continue;
    const prior = latest.get(task.id);
    if (!prior || task.rev >= prior.rev) latest.set(task.id, task);
  }
  return [...latest.values()].sort((a, b) => b.rev - a.rev);
}

export async function getTask(
  c: Clients,
  cfg: Config,
  taskId: string,
): Promise<AgentTaskRecord | null> {
  const tasks = await listTasks(c, cfg);
  return tasks.find((t) => t.id === taskId) ?? null;
}

export async function createTask(
  c: Clients,
  cfg: Config,
  args: { goal: string; assignTo: string; createdBy?: string },
): Promise<AgentTaskRecord> {
  const goal = args.goal.trim();
  if (!goal) throw new Error("createTask: goal must not be empty");
  const agent = agentById(args.assignTo);
  if (!agent)
    throw new Error(
      `createTask: unknown agent "${args.assignTo}". Known: ${AGENTS.map((a) => a.id).join(", ")}`,
    );
  const at = now();
  const task: AgentTaskRecord = {
    kind: TASK_KIND,
    id: rid("task"),
    goal,
    status: "open",
    assignedTo: agent.id,
    createdBy: args.createdBy ?? "mcp-client",
    observations: [],
    outputs: [],
    createdAt: at,
    updatedAt: at,
    rev: Date.now(),
  };
  await persistTask(c, cfg, task);
  await postMessage(c, cfg, {
    from: task.createdBy,
    to: agent.id,
    taskId: task.id,
    kind: "handoff",
    content: `New task assigned to ${agent.name}: ${goal}`,
  });
  return task;
}

async function mutateTask(
  c: Clients,
  cfg: Config,
  taskId: string,
  fn: (task: AgentTaskRecord) => AgentTaskRecord,
): Promise<AgentTaskRecord> {
  const task = await getTask(c, cfg, taskId);
  if (!task) throw new Error(`task "${taskId}" not found`);
  const next: AgentTaskRecord = { ...fn(task), updatedAt: now(), rev: Date.now() };
  return persistTask(c, cfg, next);
}

export async function observeTask(
  c: Clients,
  cfg: Config,
  args: { taskId: string; agentId: string; text: string; memoryRefs?: string[] },
): Promise<AgentTaskRecord> {
  const obs: AgentObservation = {
    id: rid("obs"),
    agentId: args.agentId,
    text: args.text,
    ts: now(),
    ...(args.memoryRefs && args.memoryRefs.length
      ? { memoryRefs: args.memoryRefs }
      : {}),
  };
  return mutateTask(c, cfg, args.taskId, (t) => ({
    ...t,
    status: t.status === "done" ? t.status : "in_progress",
    observations: [...t.observations, obs],
  }));
}

export async function handoffTask(
  c: Clients,
  cfg: Config,
  args: { taskId: string; toAgentId: string },
): Promise<AgentTaskRecord> {
  const to = agentById(args.toAgentId);
  if (!to) throw new Error(`handoffTask: unknown agent "${args.toAgentId}"`);
  const before = await getTask(c, cfg, args.taskId);
  if (!before) throw new Error(`task "${args.taskId}" not found`);
  const from = agentById(before.assignedTo);
  const updated = await mutateTask(c, cfg, args.taskId, (t) => ({
    ...t,
    assignedTo: to.id,
    status: "in_progress",
  }));
  await postMessage(c, cfg, {
    from: before.assignedTo,
    to: to.id,
    taskId: args.taskId,
    kind: "handoff",
    content: `${from?.name ?? "A teammate"} handed "${before.goal}" to ${to.name} to continue.`,
  });
  return updated;
}

export async function completeTask(
  c: Clients,
  cfg: Config,
  taskId: string,
): Promise<AgentTaskRecord> {
  const updated = await mutateTask(c, cfg, taskId, (t) => {
    const last = t.observations[t.observations.length - 1];
    return {
      ...t,
      status: "done",
      outputs: last ? [...t.outputs, last.text] : t.outputs,
    };
  });
  const agent = agentById(updated.assignedTo);
  await postMessage(c, cfg, {
    from: updated.assignedTo,
    to: "team",
    taskId,
    kind: "result",
    content: `Task "${updated.goal}" marked done by ${agent?.name ?? "the team"}.`,
  });
  return updated;
}

export async function postMessage(
  c: Clients,
  cfg: Config,
  args: {
    from: string;
    to: string;
    taskId: string;
    kind: AgentMessageKind;
    content: string;
  },
): Promise<AgentMessageRecord> {
  const msg: AgentMessageRecord = {
    kind: MESSAGE_KIND,
    id: rid("amsg"),
    from: args.from,
    to: args.to,
    taskId: args.taskId,
    messageKind: args.kind,
    content: args.content,
    ts: now(),
  };
  await c.memwal.remember(busNamespace(cfg), JSON.stringify(msg), {
    agent: args.from,
    via: "remember",
    tags: ["agent-message", args.taskId, args.kind],
  });
  return msg;
}

export async function listMessages(
  c: Clients,
  cfg: Config,
  args?: { taskId?: string; limit?: number },
): Promise<AgentMessageRecord[]> {
  const { memories } = await c.memwal.restore(busNamespace(cfg));
  const msgs: AgentMessageRecord[] = [];
  for (const m of memories) {
    const parsed = parseMessage(m.text);
    if (parsed && (!args?.taskId || parsed.taskId === args.taskId))
      msgs.push(parsed);
  }
  msgs.sort((a, b) => b.ts.localeCompare(a.ts));
  return args?.limit ? msgs.slice(0, args.limit) : msgs;
}

function buildStepInput(
  goal: string,
  observations: string[],
  memories: { text: string }[],
): string {
  const memoryBlock = memories.length
    ? memories.map((m, i) => `[${i + 1}] ${m.text}`).join("\n")
    : "(no shared memories matched this goal)";
  const obsBlock = observations.length
    ? observations.map((o, i) => `(${i + 1}) ${o}`).join("\n")
    : "(none yet)";
  return [
    `Goal: ${goal}`,
    "",
    "Shared memories:",
    memoryBlock,
    "",
    "Prior observations:",
    obsBlock,
  ].join("\n");
}

async function callModel(
  cfg: Config,
  system: string,
  user: string,
): Promise<{ ok: boolean; text: string; reason?: string }> {
  if (!cfg.models.anthropicApiKey)
    return { ok: false, text: "", reason: "no anthropic api key configured" };
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": cfg.models.anthropicApiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: cfg.models.chat,
      max_tokens: STEP_MAX_TOKENS,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok)
    return {
      ok: false,
      text: "",
      reason: `anthropic ${res.status} ${res.statusText}`,
    };
  const data = (await res.json()) as { content?: { text?: string }[] };
  return { ok: true, text: (data.content ?? []).map((p) => p.text ?? "").join("") };
}

// Recall shared memory, reason as the agent, then record the result as an
// observation on the task and a message on the bus — one full collaborative step.
export async function runAndRecordStep(
  c: Clients,
  cfg: Config,
  args: { taskId: string; agentId?: string; recallLimit?: number },
): Promise<{ task: AgentTaskRecord; observation: string; ai: boolean }> {
  const task = await getTask(c, cfg, args.taskId);
  if (!task) throw new Error(`task "${args.taskId}" not found`);
  const agentId = args.agentId ?? task.assignedTo;
  const agent = agentById(agentId);
  if (!agent) throw new Error(`runAndRecordStep: unknown agent "${agentId}"`);
  const memories = await c.memwal.recall(cfg.namespace, task.goal, {
    limit: args.recallLimit ?? DEFAULT_RECALL_LIMIT,
  });
  const memoryRefs = memories.map((m) => m.id);
  const user = buildStepInput(
    task.goal,
    task.observations.map((o) => o.text),
    memories,
  );
  const res = await callModel(cfg, agent.system, user);
  const observation = res.ok
    ? res.text
    : `${agent.name} could not reason on this step (${res.reason}). The goal stands: ${task.goal}.`;
  const updated = await observeTask(c, cfg, {
    taskId: args.taskId,
    agentId,
    text: observation,
    memoryRefs,
  });
  await postMessage(c, cfg, {
    from: agentId,
    to: "team",
    taskId: args.taskId,
    kind: "result",
    content: observation,
  });
  return { task: updated, observation, ai: res.ok };
}
