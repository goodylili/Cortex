// The collaboration layer for the MCP hub. A small team of specialist agents work
// over the same Walrus-backed memory plane the rest of Cortex uses. Their shared
// task board and message bus live in one on-chain Workspace object — a single
// Seal-encrypted blob per scope — so the MCP hub and the browser app read and
// extend the exact same state. Mirrors the browser roster in
// src/lib/cortex/agents.ts (separate runtime, same ids and prompts).

import { randomUUID } from "node:crypto";
import type { Config } from "./config";
import type { Clients } from "../../sui/app/clients";
import {
  readWorkspaceBus,
  readWorkspaceTasks,
  writeWorkspaceBus,
  writeWorkspaceTasks,
} from "./workspace";

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
  ts: number;
  memoryRefs?: string[];
}

export interface AgentTaskRecord {
  id: string;
  goal: string;
  status: TaskStatus;
  assignedTo: string;
  createdBy: string;
  observations: AgentObservation[];
  outputs: string[];
  createdAt: number;
  updatedAt: number;
  rev?: number;
}

export interface AgentMessageRecord {
  id: string;
  from: string;
  to: string;
  taskId: string;
  kind: AgentMessageKind;
  content: string;
  ts: number;
}

const DEFAULT_RECALL_LIMIT = 6;
const STEP_MAX_TOKENS = 700;
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

function rid(prefix: string): string {
  return prefix + "_" + randomUUID().slice(0, 8);
}

function requireWorkspace(cfg: Config): string {
  if (!cfg.workspaceId)
    throw new Error(
      "agent task board needs CORTEX_WORKSPACE_ID (the user's Workspace object id)",
    );
  return cfg.workspaceId;
}

export async function listTasks(
  c: Clients,
  cfg: Config,
): Promise<AgentTaskRecord[]> {
  const workspaceId = requireWorkspace(cfg);
  return (await readWorkspaceTasks(c, cfg, workspaceId)) ?? [];
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
  const workspaceId = requireWorkspace(cfg);
  const goal = args.goal.trim();
  if (!goal) throw new Error("createTask: goal must not be empty");
  const agent = agentById(args.assignTo);
  if (!agent)
    throw new Error(
      `createTask: unknown agent "${args.assignTo}". Known: ${AGENTS.map((a) => a.id).join(", ")}`,
    );
  const at = Date.now();
  const task: AgentTaskRecord = {
    id: rid("task"),
    goal,
    status: "open",
    assignedTo: agent.id,
    createdBy: args.createdBy ?? "mcp-client",
    observations: [],
    outputs: [],
    createdAt: at,
    updatedAt: at,
  };
  const tasks = (await readWorkspaceTasks(c, cfg, workspaceId)) ?? [];
  await writeWorkspaceTasks(c, cfg, workspaceId, [...tasks, task]);
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
  const workspaceId = requireWorkspace(cfg);
  const tasks = (await readWorkspaceTasks(c, cfg, workspaceId)) ?? [];
  const target = tasks.find((t) => t.id === taskId);
  if (!target) throw new Error(`task "${taskId}" not found`);
  const updated: AgentTaskRecord = { ...fn(target), updatedAt: Date.now() };
  const next = tasks.map((t) => (t.id === taskId ? updated : t));
  await writeWorkspaceTasks(c, cfg, workspaceId, next);
  return updated;
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
    ts: Date.now(),
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
  const workspaceId = requireWorkspace(cfg);
  const msg: AgentMessageRecord = {
    id: rid("amsg"),
    from: args.from,
    to: args.to,
    taskId: args.taskId,
    kind: args.kind,
    content: args.content,
    ts: Date.now(),
  };
  const bus = (await readWorkspaceBus(c, cfg, workspaceId)) ?? [];
  await writeWorkspaceBus(c, cfg, workspaceId, [...bus, msg]);
  return msg;
}

export async function listMessages(
  c: Clients,
  cfg: Config,
  args?: { taskId?: string; limit?: number },
): Promise<AgentMessageRecord[]> {
  const workspaceId = requireWorkspace(cfg);
  const bus = (await readWorkspaceBus(c, cfg, workspaceId)) ?? [];
  const msgs: AgentMessageRecord[] = [];
  for (const m of bus) {
    if (!args?.taskId || m.taskId === args.taskId) msgs.push(m);
  }
  msgs.sort((a, b) => b.ts - a.ts);
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

// Anthropic fallbacks used to give the critic a model distinct from the builder's
// cfg.models.chat, so adversarial verification is never the same model grading itself.
const CRITIC_MODEL_PRIMARY = "claude-opus-4-8";
const CRITIC_MODEL_ALTERNATE = "claude-sonnet-4-6";

function criticModelId(cfg: Config): string {
  return cfg.models.chat === CRITIC_MODEL_PRIMARY
    ? CRITIC_MODEL_ALTERNATE
    : CRITIC_MODEL_PRIMARY;
}

async function callModel(
  cfg: Config,
  system: string,
  user: string,
  modelId: string = cfg.models.chat,
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
      model: modelId,
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

const CRITIC_PASS_PREFIX = /^\s*pass\b/i;
const CRITIC_SYSTEM =
  "You are an adversarial verifier. You did NOT build the work under review. " +
  "Judge strictly whether the iteration output meets the goal against every rubric " +
  "criterion supplied. Begin your reply with PASS or FAIL on its own, then one " +
  "sentence of concrete evidence citing the rubric. Reward nothing you cannot verify.";

// Adversarial verification step: run the critic against an iteration's output and an
// explicit rubric using a DIFFERENT model id than the builder's cfg.models.chat, so
// the verifier never grades its own work. Returns the verdict plus the raw review.
export async function runCriticStep(
  cfg: Config,
  args: { goal: string; output: string; rubric: string[] },
): Promise<{ ok: boolean; verdict: "pass" | "fail"; review: string; reason?: string }> {
  const rubricBlock = args.rubric.length
    ? args.rubric.map((c, i) => `(${i + 1}) ${c}`).join("\n")
    : "(no explicit rubric supplied; judge against the goal alone)";
  const user = [
    `Goal: ${args.goal}`,
    "",
    "Rubric criteria:",
    rubricBlock,
    "",
    "Iteration output under review:",
    args.output || "(no output produced)",
  ].join("\n");
  const res = await callModel(cfg, CRITIC_SYSTEM, user, criticModelId(cfg));
  if (!res.ok)
    return { ok: false, verdict: "fail", review: "", reason: res.reason };
  const verdict = CRITIC_PASS_PREFIX.test(res.text) ? "pass" : "fail";
  return { ok: true, verdict, review: res.text };
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
