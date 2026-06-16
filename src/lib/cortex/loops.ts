// A loop is a first-class, inspectable contract between what the user wants and what
// the runtime enforces. Like the agent and memory models, everything here is pure and
// deterministic: every constructor and transition returns a new immutable value and
// nothing touches React, the network, or node. A LoopSpec is the structured plan the
// generator fills from memory plus the spawn task; a LoopRun is the durable trace of the
// five-step sense/decide/act/feedback cycle running against it. When no model key is set
// the spec generator falls back to a deterministic skeleton, and templates seed common
// shapes (keep tests green, monitor research) grounded in what the agent already knows.

const UID_RADIX = 36;
const UID_SLICE_START = 2;
const UID_SLICE_END = 9;

const uid = (prefix: string): string =>
  prefix +
  "_" +
  Math.random().toString(UID_RADIX).slice(UID_SLICE_START, UID_SLICE_END);

export type LoopType = "deterministic" | "nondeterministic";
export type LoopStatus =
  | "draft"
  | "running"
  | "paused"
  | "waiting_human"
  | "done"
  | "gave_up";
export type GateKind = "command" | "invariant" | "reviewer";
export type LoopRole = "monitor" | "worker" | "coordinator" | "standalone";
export type LoopConcurrency = "sequential" | "parallel";

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
  role: LoopRole;
  concurrency: LoopConcurrency;
  parentId?: string;
  childIds?: string[];
  boardEntry?: string;
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
const DEFAULT_ROLE: LoopRole = "standalone";
const DEFAULT_CONCURRENCY: LoopConcurrency = "sequential";
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
      role: DEFAULT_ROLE,
      concurrency: DEFAULT_CONCURRENCY,
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
          role: "worker",
          concurrency: "sequential",
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
          role: "monitor",
          concurrency: "sequential",
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

// === Composition (phase 4) ===
// A monitor or coordinator loop spawns worker/sub-agent loops. The child is linked
// to its parent by id (parentId on the child, childIds on the parent) so the trace
// stays a tree, and it inherits the parent's budget/guardrails unless overridden.

const CHILD_ROLE: LoopRole = "worker";

export const spawnChildSpec = (
  parent: LoopSpec,
  overrides: Partial<Omit<LoopSpec, "id" | "parentId" | "createdAt" | "updatedAt">>,
  now: number,
): LoopSpec =>
  newLoop(
    {
      agentId: overrides.agentId ?? parent.agentId,
      goal: overrides.goal ?? parent.goal,
      loopType: overrides.loopType ?? parent.loopType,
      trigger: overrides.trigger ?? { type: "manual" },
      stateSource: overrides.stateSource ?? parent.stateSource,
      gates: overrides.gates ?? parent.gates,
      budget: overrides.budget ?? parent.budget,
      giveUp: overrides.giveUp ?? parent.giveUp,
      errorPolicy: overrides.errorPolicy ?? parent.errorPolicy,
      guardrails: overrides.guardrails ?? parent.guardrails,
      humanGate: overrides.humanGate ?? parent.humanGate,
      memoryWrites: overrides.memoryWrites ?? parent.memoryWrites,
      role: overrides.role ?? CHILD_ROLE,
      concurrency: overrides.concurrency ?? "sequential",
      parentId: parent.id,
      ...(overrides.childIds ? { childIds: overrides.childIds } : {}),
      ...(overrides.boardEntry !== undefined
        ? { boardEntry: overrides.boardEntry }
        : parent.boardEntry !== undefined
          ? { boardEntry: parent.boardEntry }
          : {}),
    },
    now,
  );

export const linkChild = (
  parent: LoopSpec,
  childId: string,
  now: number,
): LoopSpec => ({
  ...parent,
  childIds: [...(parent.childIds ?? []), childId],
  updatedAt: now,
});

// Two running loops conflict when they target the same board/loop entry, so a
// coordinator only runs children in parallel when this returns false.
export const hasBoardConflict = (
  runs: LoopRun[],
  candidate: LoopSpec,
): boolean => {
  if (candidate.boardEntry === undefined) return false;
  for (const r of runs) {
    if (r.spec.id === candidate.id) continue;
    if (r.status !== "running") continue;
    if (r.spec.boardEntry === candidate.boardEntry) return true;
  }
  return false;
};

// === Triggers (phase 2) ===
// A schedule trigger fires when at least `on` ms have elapsed since the last run; an
// event trigger fires whenever its named event is pending; a manual trigger never
// auto-fires. `on` is parsed as a millisecond count for schedules.

const SCHEDULE_DEFAULT_INTERVAL_MS = 5 * 60 * 1000;

export const triggerShouldFire = (
  trigger: LoopTrigger,
  now: number,
  lastRunAt: number | undefined,
): boolean => {
  switch (trigger.type) {
    case "manual":
      return false;
    case "event":
      return true;
    case "schedule": {
      if (lastRunAt === undefined) return true;
      const parsed = trigger.on ? Number.parseInt(trigger.on, 10) : NaN;
      const interval =
        Number.isFinite(parsed) && parsed > 0
          ? parsed
          : SCHEDULE_DEFAULT_INTERVAL_MS;
      return now - lastRunAt >= interval;
    }
  }
};

// === Command-gate verdict ===
// A command/invariant gate's verdict is decided by the command's exit code: 0 passes,
// anything else fails. Pure so the runtime and tests share one mapping.

const PASS_EXIT_CODE = 0;

export const commandGateVerdict = (
  exitCode: number,
): "pass" | "fail" => (exitCode === PASS_EXIT_CODE ? "pass" : "fail");

// === Self-improving rubric (phase 3) ===
// A reviewer gate scores work against an explicit rubric. When a human flags a miss
// the reviewer let through, the flagged criterion is appended (and any near-duplicate
// dropped) so the next run's verifier is sharper — the loop gets better at judging.

export interface LoopRubric {
  id: string;
  criteria: string[];
  updatedAt: number;
}

const RUBRIC_FLAG_PREFIX = "Human-flagged miss: ";

export const newRubric = (criteria: string[], now: number): LoopRubric => ({
  id: uid("rb"),
  criteria,
  updatedAt: now,
});

export const refineRubric = (
  rubric: LoopRubric,
  humanFlag: string,
  now: number,
): LoopRubric => {
  const flag = humanFlag.trim();
  if (!flag) return rubric;
  const sharpened = `${RUBRIC_FLAG_PREFIX}${flag}`;
  const normalized = flag.toLowerCase();
  const kept = rubric.criteria.filter(
    (c) => !c.toLowerCase().includes(normalized),
  );
  return {
    ...rubric,
    criteria: [...kept, sharpened],
    updatedAt: now,
  };
};
