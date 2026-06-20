// Server-side (MCP / executor) loop runtime. Drives the five-step sense→decide→act→
// gather→verify cycle by wrapping runAndRecordStep under the ExecutorCap, persisting
// LoopRun state to the Workspace via readWorkspaceLoops/writeWorkspaceLoops. Unlike the
// browser driver (which can only escalate a command/invariant gate to a human), this
// runtime executes the REAL gate command via node:child_process and decides "done" from
// the exit code. It respects the spec's budget, give-up, and error policy, fires loops
// on schedule/event triggers, and  -  for composition  -  lets a monitor/coordinator loop
// spawn worker loops (sequential by default; parallel only when no board conflict).

import { spawn } from "node:child_process";
import type { Config } from "./config";
import type { Clients } from "../../sui/app/clients";
import {
  AGENTS,
  agentById,
  createTask,
  runAndRecordStep,
  runCriticStep,
} from "./agents";
import {
  readWorkspaceLoops,
  resolveWorkspaceId,
  writeWorkspaceLoops,
} from "./workspace";
import {
  budgetExceeded,
  commandGateVerdict,
  ensureRunRubric,
  hasBoardConflict,
  linkChild,
  newIteration,
  newRun,
  recordIteration,
  refineRubric,
  setRunStatus,
  skeletonSpec,
  spawnChildSpec,
  triggerShouldFire,
  LOOP_TEMPLATES,
  type LoopRubric,
  type LoopRun,
  type LoopSpec,
  type VerificationGate,
} from "../lib/cortex/loops";

const COMMAND_TIMEOUT_MS = 10 * 60 * 1000;
const COMMAND_SHELL = "/bin/sh";
const COMMAND_KILL_EXIT_CODE = 124;
const ERROR_EXIT_CODE = 1;
const RETRY_BACKOFF_MS = 1500;
const GIVE_UP_STREAK = 3;
const TOKENS_PER_CHAR = 0.25;

async function requireWorkspace(cfg: Config): Promise<string> {
  const workspaceId = await resolveWorkspaceId(cfg);
  if (!workspaceId)
    throw new Error(
      "loop runtime needs a Workspace: set CORTEX_WORKSPACE_ID, or set CORTEX_USER_ADDRESS so the id created from the app (account setting) can be read back",
    );
  return workspaceId;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length * TOKENS_PER_CHAR);
}

interface CommandResult {
  exitCode: number;
  output: string;
}

// Run a gate's command in a shell and resolve with its exit code + captured output.
// A non-zero (or killed) process is a failed gate, never a thrown error, so the loop
// keeps control and applies its own error policy.
function runGateCommand(command: string): Promise<CommandResult> {
  return new Promise<CommandResult>((resolve) => {
    const child = spawn(COMMAND_SHELL, ["-c", command], {
      timeout: COMMAND_TIMEOUT_MS,
    });
    let output = "";
    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.on("error", (err: Error) => {
      resolve({ exitCode: ERROR_EXIT_CODE, output: err.message });
    });
    child.on("close", (code: number | null, signal: NodeJS.Signals | null) => {
      const exitCode =
        code !== null ? code : signal ? COMMAND_KILL_EXIT_CODE : ERROR_EXIT_CODE;
      resolve({ exitCode, output });
    });
  });
}

// A command/invariant gate's `check` carries the exact command (the generator pulls it
// from memory); the trailing `on \`cmd\`` form is the convention the templates use, so
// extract the backticked command when present, else run the whole check string.
const BACKTICK_COMMAND = /`([^`]+)`/;

function gateCommand(gate: VerificationGate): string {
  const match = gate.check.match(BACKTICK_COMMAND);
  return match ? match[1]!.trim() : gate.check.trim();
}

async function loadRun(
  c: Clients,
  cfg: Config,
  workspaceId: string,
  loopId: string,
): Promise<LoopRun | null> {
  const loops = (await readWorkspaceLoops(c, cfg, workspaceId)) ?? [];
  return loops.find((r) => r.spec.id === loopId) ?? null;
}

async function saveRun(
  c: Clients,
  cfg: Config,
  workspaceId: string,
  run: LoopRun,
): Promise<void> {
  const loops = (await readWorkspaceLoops(c, cfg, workspaceId)) ?? [];
  const next = loops.some((r) => r.spec.id === run.spec.id)
    ? loops.map((r) => (r.spec.id === run.spec.id ? run : r))
    : [run, ...loops];
  await writeWorkspaceLoops(c, cfg, workspaceId, next);
}

export async function registerLoop(
  c: Clients,
  cfg: Config,
  spec: LoopSpec,
): Promise<LoopRun> {
  const workspaceId = await requireWorkspace(cfg);
  const run = newRun(spec, Date.now());
  await saveRun(c, cfg, workspaceId, run);
  return run;
}

// Build a LoopSpec from a goal + assigned agent and register it as a draft run. When a
// templateId names a LOOP_TEMPLATES entry the spec is shaped from that template (the
// deterministic skeleton otherwise), so an MCP host can spawn a loop without hand-writing
// every gate/budget field. Validates the agent against the shared roster the same way
// createTask does, so a loop never references an agent that can't run it.
export async function createLoop(
  c: Clients,
  cfg: Config,
  args: { goal: string; agentId: string; templateId?: string },
): Promise<LoopRun> {
  const goal = args.goal.trim();
  if (!goal) throw new Error("createLoop: goal must not be empty");
  const agent = agentById(args.agentId);
  if (!agent)
    throw new Error(
      `createLoop: unknown agent "${args.agentId}". Known: ${AGENTS.map((a) => a.id).join(", ")}`,
    );
  const now = Date.now();
  let spec: LoopSpec;
  if (args.templateId) {
    const template = LOOP_TEMPLATES.find((t) => t.id === args.templateId);
    if (!template)
      throw new Error(
        `createLoop: unknown template "${args.templateId}". Known: ${LOOP_TEMPLATES.map((t) => t.id).join(", ")}`,
      );
    spec = template.build(goal, agent.id, now);
  } else {
    spec = skeletonSpec({ goal, agentId: agent.id }, now);
  }
  return registerLoop(c, cfg, spec);
}

export async function listLoops(c: Clients, cfg: Config): Promise<LoopRun[]> {
  const workspaceId = await requireWorkspace(cfg);
  return (await readWorkspaceLoops(c, cfg, workspaceId)) ?? [];
}

export async function getLoop(
  c: Clients,
  cfg: Config,
  loopId: string,
): Promise<LoopRun | null> {
  const workspaceId = await requireWorkspace(cfg);
  return loadRun(c, cfg, workspaceId, loopId);
}

// Pause a running loop without giving up on it: a paused loop is skipped by tickLoops
// (which only fires loops that aren't done/gave_up  -  a human resumes it by stepping it
// again). Terminal loops (done/gave_up) are returned unchanged so stop is idempotent.
export async function stopLoop(
  c: Clients,
  cfg: Config,
  loopId: string,
): Promise<LoopRun> {
  const workspaceId = await requireWorkspace(cfg);
  const loaded = await loadRun(c, cfg, workspaceId, loopId);
  if (!loaded) throw new Error(`loop "${loopId}" not found in workspace`);
  if (loaded.status === "done" || loaded.status === "gave_up") return loaded;
  const run = setRunStatus(loaded, "paused", Date.now());
  await saveRun(c, cfg, workspaceId, run);
  return run;
}

// Human-in-the-loop entry point for the self-improving rubric: a person flags a miss the
// reviewer let through, and the flagged criterion is folded into the loop's persisted
// rubric (seeding it first if the loop has never run) so the next run's critic is sharper.
// Returns the refined rubric. The CLI `loop flag` command wires to this.
export async function flagRubricMiss(
  c: Clients,
  cfg: Config,
  loopId: string,
  humanFlag: string,
): Promise<LoopRubric> {
  if (!humanFlag.trim())
    throw new Error(
      "flagRubricMiss needs a non-empty flag describing the miss the reviewer let through",
    );
  const workspaceId = await requireWorkspace(cfg);
  const loaded = await loadRun(c, cfg, workspaceId, loopId);
  if (!loaded) throw new Error(`loop "${loopId}" not found in workspace`);

  const now = Date.now();
  const seeded = ensureRunRubric(loaded, now);
  if (!seeded.rubric)
    throw new Error(`loop "${loopId}" has no rubric after seeding; cannot refine`);
  const rubric = refineRubric(seeded.rubric, humanFlag, now);
  const run: LoopRun = { ...seeded, rubric, updatedAt: now };
  await saveRun(c, cfg, workspaceId, run);
  return rubric;
}

interface GateOutcome {
  verdict: "pass" | "fail" | "pending";
  gate?: string;
  feedback: string;
}

// Run the spec's terminal gate against the latest action. Command/invariant gates run
// the real command and decide from the exit code; reviewer gates run the adversarial
// critic (different model) against the persisted, self-improving rubric  -  the criteria
// the loop has accumulated across runs, not a throwaway built from the gate's check.
async function evaluateGate(
  cfg: Config,
  spec: LoopSpec,
  acted: string,
  rubricCriteria: string[],
): Promise<GateOutcome> {
  const command = spec.gates.find(
    (g) => g.kind === "command" || g.kind === "invariant",
  );
  if (command) {
    const result = await runGateCommand(gateCommand(command));
    return {
      verdict: commandGateVerdict(result.exitCode),
      gate: command.name,
      feedback: `exit ${result.exitCode}: ${result.output.slice(-500)}`.trim(),
    };
  }
  const reviewer = spec.gates.find((g) => g.kind === "reviewer");
  if (reviewer) {
    // Persisted rubric criteria win; fall back to the gate's own check so behaviour
    // never regresses to "no rubric" when a run hasn't seeded any yet.
    const rubric = rubricCriteria.length ? rubricCriteria : [reviewer.check];
    const review = await runCriticStep(cfg, {
      goal: spec.goal,
      output: acted,
      rubric,
    });
    if (!review.ok)
      return {
        verdict: "pending",
        gate: reviewer.name,
        feedback: `reviewer unavailable (${review.reason}); escalating to a human`,
      };
    return { verdict: review.verdict, gate: reviewer.name, feedback: review.review };
  }
  return { verdict: "pending", feedback: "no gate defined; escalating to a human" };
}

function failureStreak(run: LoopRun): number {
  let streak = 0;
  for (let i = run.iterations.length - 1; i >= 0; i--) {
    if (run.iterations[i]!.verdict === "fail") streak++;
    else break;
  }
  return streak;
}

export interface StepResult {
  run: LoopRun;
  status: LoopRun["status"];
  verdict: "pass" | "fail" | "pending";
}

// One iteration of the five-step cycle as the executor: sense+decide+act via
// runAndRecordStep (which records to the task board under the ExecutorCap), gather the
// result, then verify against the real gate. Honours budget, give-up streak, and the
// error policy (retry once with backoff, then pause).
export async function stepLoop(
  c: Clients,
  cfg: Config,
  loopId: string,
): Promise<StepResult> {
  const workspaceId = await requireWorkspace(cfg);
  const loaded = await loadRun(c, cfg, workspaceId, loopId);
  if (!loaded) throw new Error(`loop "${loopId}" not found in workspace`);

  const now = Date.now();
  let run: LoopRun =
    loaded.status === "draft"
      ? { ...setRunStatus(loaded, "running", now), startedAt: loaded.startedAt ?? now }
      : loaded;

  if (budgetExceeded(run, now)) {
    run = setRunStatus(run, "gave_up", now);
    await saveRun(c, cfg, workspaceId, run);
    return { run, status: run.status, verdict: "fail" };
  }

  const agent = agentById(run.spec.agentId);
  if (!agent)
    throw new Error(`loop "${loopId}" references unknown agent "${run.spec.agentId}"`);

  // Seed the rubric before verifying so the critic scores against it and the saveRun at
  // the end of this step persists it alongside the run (no extra blob/contract change).
  run = ensureRunRubric(run, now);

  const stepResult = await runStepWithPolicy(c, cfg, run);
  const acted = stepResult.observation;
  const outcome = await evaluateGate(
    cfg,
    run.spec,
    acted,
    run.rubric?.criteria ?? [],
  );

  const it = newIteration(
    {
      n: run.iterations.length + 1,
      sensed: `${run.spec.stateSource}`,
      decided: `${agent.name} chose the next action`,
      acted,
      feedback: outcome.feedback,
      verdict: outcome.verdict,
      ...(outcome.gate ? { gate: outcome.gate } : {}),
      tokens: estimateTokens(acted) + estimateTokens(outcome.feedback),
    },
    Date.now(),
  );
  run = recordIteration(run, it, Date.now());

  let status: LoopRun["status"];
  if (outcome.verdict === "pending" || outcome.verdict === "pass")
    status = "waiting_human";
  else if (failureStreak(run) >= GIVE_UP_STREAK) status = "gave_up";
  else if (budgetExceeded(run, Date.now())) status = "gave_up";
  else status = "running";

  run = setRunStatus(run, status, Date.now());
  await saveRun(c, cfg, workspaceId, run);
  return { run, status, verdict: outcome.verdict };
}

export const runLoopStep = stepLoop;

// errorPolicy: retry the model step once with backoff, then surface the failure as the
// observation so the gate can record it rather than crashing the run.
async function runStepWithPolicy(
  c: Clients,
  cfg: Config,
  run: LoopRun,
): Promise<{ observation: string; ai: boolean }> {
  const taskId = await ensureTask(c, cfg, run.spec);
  try {
    return await runAndRecordStep(c, cfg, {
      taskId,
      agentId: run.spec.agentId,
    });
  } catch {
    await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS));
    try {
      return await runAndRecordStep(c, cfg, {
        taskId,
        agentId: run.spec.agentId,
      });
    } catch (err) {
      return {
        observation: `step failed after retry (${(err as Error).message}); pausing per error policy. Goal stands: ${run.spec.goal}`,
        ai: false,
      };
    }
  }
}

// A loop's spec.boardEntry is the task it drives; create one on first run so the
// executor has a durable task board row to record observations against.
async function ensureTask(
  c: Clients,
  cfg: Config,
  spec: LoopSpec,
): Promise<string> {
  if (spec.boardEntry) return spec.boardEntry;
  const task = await createTask(c, cfg, {
    goal: spec.goal,
    assignTo: spec.agentId,
    createdBy: `loop:${spec.id}`,
  });
  return task.id;
}

// Drive the loop to a terminal state, one step at a time, until it stops running. Used
// by `loop run`; `loop step` calls stepLoop once.
export async function runLoop(
  c: Clients,
  cfg: Config,
  loopId: string,
): Promise<StepResult> {
  let last = await stepLoop(c, cfg, loopId);
  while (last.status === "running") {
    last = await stepLoop(c, cfg, loopId);
  }
  return last;
}

// Fire any loop whose trigger is due (schedule/event), advancing each one step. Manual
// loops never auto-fire. The executor calls this from a scheduler tick.
export async function tickLoops(
  c: Clients,
  cfg: Config,
  now: number = Date.now(),
): Promise<string[]> {
  const workspaceId = await requireWorkspace(cfg);
  const loops = (await readWorkspaceLoops(c, cfg, workspaceId)) ?? [];
  const fired: string[] = [];
  for (const run of loops) {
    if (run.status === "done" || run.status === "gave_up") continue;
    const lastRunAt =
      run.iterations.length > 0
        ? run.iterations[run.iterations.length - 1]!.ts
        : run.startedAt;
    if (!triggerShouldFire(run.spec.trigger, now, lastRunAt)) continue;
    await stepLoop(c, cfg, run.spec.id);
    fired.push(run.spec.id);
  }
  return fired;
}

// Composition (phase 4): a monitor/coordinator spawns a worker loop. Spawning is
// SEQUENTIAL by default; a worker only runs in parallel with its siblings when no other
// running loop targets the same board entry (hasBoardConflict guards shared state).
export async function spawnWorkerLoop(
  c: Clients,
  cfg: Config,
  args: {
    parentId: string;
    overrides: Parameters<typeof spawnChildSpec>[1];
    parallel?: boolean;
  },
): Promise<LoopRun> {
  const workspaceId = await requireWorkspace(cfg);
  const loops = (await readWorkspaceLoops(c, cfg, workspaceId)) ?? [];
  const parent = loops.find((r) => r.spec.id === args.parentId);
  if (!parent)
    throw new Error(`spawnWorkerLoop: parent loop "${args.parentId}" not found`);
  if (parent.spec.role !== "monitor" && parent.spec.role !== "coordinator")
    throw new Error(
      `spawnWorkerLoop: only a monitor or coordinator may spawn workers (parent role is "${parent.spec.role}")`,
    );

  const now = Date.now();
  const concurrency = args.parallel ? "parallel" : "sequential";
  const child = spawnChildSpec(
    parent.spec,
    { ...args.overrides, concurrency },
    now,
  );

  if (args.parallel && hasBoardConflict(loops, child))
    throw new Error(
      `spawnWorkerLoop: parallel spawn refused  -  another running loop targets board entry "${child.boardEntry}". Run sequentially or pick a distinct board entry.`,
    );

  const childRun = newRun(child, now);
  const linkedParent: LoopRun = {
    ...parent,
    spec: linkChild(parent.spec, child.id, now),
    updatedAt: now,
  };
  const next = loops.map((r) => (r.spec.id === parent.spec.id ? linkedParent : r));
  await writeWorkspaceLoops(c, cfg, workspaceId, [childRun, ...next]);
  return childRun;
}
