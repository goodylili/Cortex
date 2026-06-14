// A small team of specialist agents that collaborate over one shared, durable
// Walrus memory. Pure and deterministic, like the memory model: every constructor
// and transition returns a new immutable value, nothing here touches React or the
// network. The roles split the work — research, curation, planning, critique — and
// hand tasks off to one another. Each agent's system prompt grounds it in the
// shared memories it is given and asks for one concrete next action.

import { uid } from "./logic";

export type AgentRole = "researcher" | "curator" | "planner" | "critic";
export type TaskStatus = "open" | "in_progress" | "blocked" | "done";

export interface AgentDef {
  id: string;
  name: string;
  role: AgentRole;
  blurb: string;
  system: string;
  accent: string;
}

const SHARED_MEMORY_CLAUSE =
  "You and your three teammates (a researcher, a curator, a planner, and a critic) share one durable memory stored on Walrus. Ground every claim in the shared memories supplied to you; never invent facts that aren't supported there. Be concise. End with exactly one concrete next action or a handoff suggestion naming the teammate who should take it.";

const RESEARCHER_ID = "agent_researcher";
const CURATOR_ID = "agent_curator";
const PLANNER_ID = "agent_planner";
const CRITIC_ID = "agent_critic";

const RESEARCHER_NAME = "Atlas";
const CURATOR_NAME = "Vesta";
const PLANNER_NAME = "Orion";
const CRITIC_NAME = "Juno";

const RESEARCHER_ACCENT = "#3b82f6";
const CURATOR_ACCENT = "#10b981";
const PLANNER_ACCENT = "#f59e0b";
const CRITIC_ACCENT = "#ef4444";

export const AGENTS: AgentDef[] = [
  {
    id: RESEARCHER_ID,
    name: RESEARCHER_NAME,
    role: "researcher",
    blurb: "Gathers facts and links, proposes new memories.",
    system: `You are ${RESEARCHER_NAME}, the team's researcher. Your specialty is gathering facts, sources, and links, and proposing new memories worth keeping. ${SHARED_MEMORY_CLAUSE}`,
    accent: RESEARCHER_ACCENT,
  },
  {
    id: CURATOR_ID,
    name: CURATOR_NAME,
    role: "curator",
    blurb: "Organizes, dedupes, and tags memories; decides what to keep.",
    system: `You are ${CURATOR_NAME}, the team's curator. Your specialty is organizing, deduping, and tagging the shared memory, and deciding what is worth keeping versus letting fade. ${SHARED_MEMORY_CLAUSE}`,
    accent: CURATOR_ACCENT,
  },
  {
    id: PLANNER_ID,
    name: PLANNER_NAME,
    role: "planner",
    blurb: "Breaks goals into steps, sequences work, assigns handoffs.",
    system: `You are ${PLANNER_NAME}, the team's planner. Your specialty is breaking a goal into ordered steps, sequencing the work, and assigning handoffs to the right teammate. ${SHARED_MEMORY_CLAUSE}`,
    accent: PLANNER_ACCENT,
  },
  {
    id: CRITIC_ID,
    name: CRITIC_NAME,
    role: "critic",
    blurb: "Reviews outputs, flags gaps and contradictions, validates.",
    system: `You are ${CRITIC_NAME}, the team's critic. Your specialty is reviewing the team's outputs, flagging gaps, contradictions, and unsupported claims, and validating that work matches the shared memory. ${SHARED_MEMORY_CLAUSE}`,
    accent: CRITIC_ACCENT,
  },
];

export const agentById = (id: string): AgentDef | undefined =>
  AGENTS.find((a) => a.id === id);

export const agentByRole = (role: AgentRole): AgentDef => {
  const found = AGENTS.find((a) => a.role === role);
  if (!found) {
    throw new Error(`No agent defined for role "${role}"`);
  }
  return found;
};

export interface AgentObservation {
  id: string;
  agentId: string;
  text: string;
  ts: number;
  memoryRefs?: string[];
}

export type AgentMessageKind = "handoff" | "note" | "result";

export interface AgentMessage {
  id: string;
  from: string;
  to: string;
  taskId: string;
  kind: AgentMessageKind;
  content: string;
  ts: number;
}

export interface AgentTask {
  id: string;
  goal: string;
  status: TaskStatus;
  assignedTo: string;
  createdBy: string;
  observations: AgentObservation[];
  outputs: string[];
  createdAt: number;
  updatedAt: number;
}

export const newTask = (
  goal: string,
  assignedTo: string,
  createdBy: string,
  now: number,
): AgentTask => ({
  id: uid("task"),
  goal,
  status: "open",
  assignedTo,
  createdBy,
  observations: [],
  outputs: [],
  createdAt: now,
  updatedAt: now,
});

export const newObservation = (
  agentId: string,
  text: string,
  now: number,
  memoryRefs?: string[],
): AgentObservation => ({
  id: uid("obs"),
  agentId,
  text,
  ts: now,
  ...(memoryRefs && memoryRefs.length ? { memoryRefs } : {}),
});

export const newMessage = (
  from: string,
  to: string,
  taskId: string,
  kind: AgentMessageKind,
  content: string,
  now: number,
): AgentMessage => ({
  id: uid("amsg"),
  from,
  to,
  taskId,
  kind,
  content,
  ts: now,
});

export const addObservation = (
  task: AgentTask,
  obs: AgentObservation,
  now: number,
): AgentTask => ({
  ...task,
  observations: [...task.observations, obs],
  updatedAt: now,
});

export const addOutput = (
  task: AgentTask,
  output: string,
  now: number,
): AgentTask => ({
  ...task,
  outputs: [...task.outputs, output],
  updatedAt: now,
});

export const setStatus = (
  task: AgentTask,
  status: TaskStatus,
  now: number,
): AgentTask => ({
  ...task,
  status,
  updatedAt: now,
});

export const handoff = (
  task: AgentTask,
  toAgentId: string,
  now: number,
): AgentTask => ({
  ...task,
  assignedTo: toAgentId,
  status: "in_progress",
  updatedAt: now,
});

export const buildAgentStepInput = (args: {
  task: AgentTask;
  memories: { text: string; label?: string; when?: string }[];
}): string => {
  const { task, memories } = args;
  const memoryBlock = memories.length
    ? memories
        .map((m, i) => {
          const meta =
            m.label && m.when
              ? ` (${m.label}, ${m.when})`
              : m.label
                ? ` (${m.label})`
                : m.when
                  ? ` (${m.when})`
                  : "";
          return `[${i + 1}] ${m.text}${meta}`;
        })
        .join("\n")
    : "(no shared memories supplied)";
  const observationBlock = task.observations.length
    ? task.observations.map((o, i) => `(${i + 1}) ${o.text}`).join("\n")
    : "(none yet)";
  return [
    `Goal: ${task.goal}`,
    "",
    "Shared memories:",
    memoryBlock,
    "",
    "Prior observations:",
    observationBlock,
  ].join("\n");
};
