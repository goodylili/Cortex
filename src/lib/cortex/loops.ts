// A loop is a first-class, inspectable contract between what the user wants and what
// the runtime enforces. Like the agent and memory models, everything here is pure and
// deterministic: every constructor and transition returns a new immutable value and
// nothing touches React, the network, or node. A LoopSpec is the structured plan the
// generator fills from memory plus the spawn task; a LoopRun is the durable trace of the
// five-step sense/decide/act/feedback cycle running against it. When no model key is set
// the spec generator falls back to a deterministic skeleton, and templates seed common
// shapes (keep tests green, monitor research) grounded in what the agent already knows.

import { uid } from "./logic";

export type LoopType = "deterministic" | "nondeterministic";
export type LoopStatus =
  | "draft"
  | "running"
  | "paused"
  | "waiting_human"
  | "done"
  | "gave_up";
export type GateKind = "command" | "invariant" | "reviewer";

export interface VerificationGate {
  name: string;
  kind: GateKind;
  check: string;
}

export interface LoopBudget {
  maxIterations: number;
  maxTokens: number;
  maxWallClockMs: number;
  maxItems?: number;
}

export interface LoopTrigger {
  type: "manual" | "schedule" | "event";
  on?: string;
}

export interface LoopSpec {
  id: string;
  agentId: string;
  goal: string;
  loopType: LoopType;
  trigger: LoopTrigger;
  stateSource: string;
  gates: VerificationGate[];
  budget: LoopBudget;
  giveUp: string;
  errorPolicy: string;
  guardrails: string[];
  humanGate: string;
  memoryWrites: string;
  createdAt: number;
  updatedAt: number;
}

export interface LoopIteration {
  n: number;
  sensed: string;
  decided: string;
  acted: string;
  feedback: string;
  verdict: "pass" | "fail" | "pending";
  gate?: string;
  tokens?: number;
  ts: number;
}

export interface LoopRun {
  spec: LoopSpec;
  status: LoopStatus;
  iterations: LoopIteration[];
  tokensUsed: number;
  startedAt?: number;
  updatedAt: number;
}

const DEFAULT_MAX_ITERATIONS = 8;
const DEFAULT_MAX_TOKENS = 400_000;
const DEFAULT_MAX_WALL_CLOCK_MS = 45 * 60 * 1000;

export const DEFAULT_BUDGET: LoopBudget = {
  maxIterations: DEFAULT_MAX_ITERATIONS,
  maxTokens: DEFAULT_MAX_TOKENS,
  maxWallClockMs: DEFAULT_MAX_WALL_CLOCK_MS,
};

const SKELETON_STATE_SOURCE = "the agent's memory + prior run evidence";
const SKELETON_GIVE_UP =
  "the same gate fails 3 times in a row with no new progress → stop and escalate to a human";
const SKELETON_ERROR_POLICY =
  "retry once with backoff, then pause and log the failure for review";
const SKELETON_GUARDRAILS = [
  "no destructive actions",
  "prepare output, don't auto-commit",
];
const SKELETON_HUMAN_GATE = "prepare the result and hand it to a human";
const SKELETON_MEMORY_WRITES =
  "append each iteration summary + final verdict to memory";
const SKELETON_GATE: VerificationGate = {
  name: "goal_met",
  kind: "reviewer",
  check: "a reviewer agent confirms the goal is met",
};

export const newLoop = (
  spec: Omit<LoopSpec, "id" | "createdAt" | "updatedAt">,
  now: number,
): LoopSpec => ({
  ...spec,
  id: uid("lp"),
  createdAt: now,
  updatedAt: now,
});

export const newRun = (spec: LoopSpec, now: number): LoopRun => ({
  spec,
  status: "draft",
  iterations: [],
  tokensUsed: 0,
  updatedAt: now,
});

export const newIteration = (
  args: {
    n: number;
    sensed: string;
    decided: string;
    acted: string;
    feedback: string;
    verdict: "pass" | "fail" | "pending";
    gate?: string;
    tokens?: number;
  },
  now: number,
): LoopIteration => ({
  n: args.n,
  sensed: args.sensed,
  decided: args.decided,
  acted: args.acted,
  feedback: args.feedback,
  verdict: args.verdict,
  ...(args.gate ? { gate: args.gate } : {}),
  ...(args.tokens !== undefined ? { tokens: args.tokens } : {}),
  ts: now,
});

export const recordIteration = (
  run: LoopRun,
  it: LoopIteration,
  now: number,
): LoopRun => ({
  ...run,
  iterations: [...run.iterations, it],
  tokensUsed: run.tokensUsed + (it.tokens ?? 0),
  updatedAt: now,
});

export const setRunStatus = (
  run: LoopRun,
  status: LoopStatus,
  now: number,
): LoopRun => ({
  ...run,
  status,
  updatedAt: now,
});

export const budgetExceeded = (run: LoopRun, now: number): boolean => {
  const { budget } = run.spec;
  if (run.iterations.length >= budget.maxIterations) return true;
  if (run.tokensUsed >= budget.maxTokens) return true;
  return (
    run.startedAt !== undefined &&
    now - run.startedAt >= budget.maxWallClockMs
  );
};

// Simple gate check: a run passes when its latest iteration's verdict is "pass".
// Each iteration carries the combined verdict of every gate in the spec, so the
// latest verdict standing in for "all gates passed" keeps this deterministic and
// cheap; richer per-gate tracking layers on without changing this contract.
export const allGatesPassed = (run: LoopRun): boolean => {
  if (!run.spec.gates.length) return false;
  const latest = run.iterations[run.iterations.length - 1];
  return latest !== undefined && latest.verdict === "pass";
};

export const skeletonSpec = (
  args: { goal: string; agentId: string },
  now: number,
): LoopSpec =>
  newLoop(
    {
      agentId: args.agentId,
      goal: args.goal,
      loopType: "deterministic",
      trigger: { type: "manual" },
      stateSource: SKELETON_STATE_SOURCE,
      gates: [SKELETON_GATE],
      budget: DEFAULT_BUDGET,
      giveUp: SKELETON_GIVE_UP,
      errorPolicy: SKELETON_ERROR_POLICY,
      guardrails: SKELETON_GUARDRAILS,
      humanGate: SKELETON_HUMAN_GATE,
      memoryWrites: SKELETON_MEMORY_WRITES,
    },
    now,
  );

export const LOOP_TEMPLATES: {
  id: string;
  name: string;
  blurb: string;
  build(goal: string, agentId: string, now: number): LoopSpec;
}[] = [
  {
    id: "keep-tests-green",
    name: "Keep tests green",
    blurb:
      "Runs the project's tests and typecheck on each iteration, fixes failures, and opens a PR for review.",
    build: (goal, agentId, now) =>
      newLoop(
        {
          agentId,
          goal,
          loopType: "deterministic",
          trigger: { type: "manual" },
          stateSource: "the project's test command output and typecheck result",
          gates: [
            {
              name: "tests_pass",
              kind: "command",
              check: "exit_code == 0 on the project's test command",
            },
            {
              name: "typecheck",
              kind: "invariant",
              check: "tsc --noEmit returns 0",
            },
          ],
          budget: DEFAULT_BUDGET,
          giveUp:
            "the same test fails 3 times in a row with no progress → stop and escalate",
          errorPolicy:
            "retry once with backoff, then pause and log the failure for review",
          guardrails: [
            "edits limited to /src and /tests",
            "no force-push",
            "no deploy",
          ],
          humanGate: "open a PR, do not merge",
          memoryWrites:
            "append each iteration summary + final verdict to memory",
        },
        now,
      ),
  },
  {
    id: "research-monitor",
    name: "Research monitor",
    blurb:
      "Periodically gathers new findings on a topic, distills them to memory, and flags what's worth a human's attention.",
    build: (goal, agentId, now) =>
      newLoop(
        {
          agentId,
          goal,
          loopType: "nondeterministic",
          trigger: { type: "schedule" },
          stateSource: "the agent's memory + newly gathered findings",
          gates: [
            {
              name: "findings_reviewed",
              kind: "reviewer",
              check:
                "a reviewer agent confirms new findings are relevant, grounded, and non-duplicate before they are kept",
            },
          ],
          budget: DEFAULT_BUDGET,
          giveUp:
            "no new relevant findings across 3 iterations → pause and report the current summary",
          errorPolicy:
            "retry once with backoff, then pause and log the failure for review",
          guardrails: [
            "no destructive actions",
            "prepare a digest, don't notify externally",
          ],
          humanGate: "prepare a digest and hand it to a human",
          memoryWrites:
            "append each iteration summary + final verdict to memory",
        },
        now,
      ),
  },
];

export const buildLoopSpecInput = (args: {
  task: string;
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
    : "(no grounding memories supplied)";
  return [
    `Task: ${task}`,
    "",
    "Grounding memories:",
    memoryBlock,
    "",
    "Write the loop spec grounded in what the agent already knows from the memories above; never invent facts that aren't supported there.",
  ].join("\n");
};
