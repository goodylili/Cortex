import { describe, expect, it } from "vitest";
import {
  allGatesPassed,
  budgetExceeded,
  DEFAULT_BUDGET,
  LOOP_TEMPLATES,
  newIteration,
  newLoop,
  newRun,
  recordIteration,
  setRunStatus,
  skeletonSpec,
  type LoopSpec,
} from "@/lib/cortex/loops";

const NOW = 1_700_000_000_000;

const baseSpecArgs: Omit<LoopSpec, "id" | "createdAt" | "updatedAt"> = {
  agentId: "agent_planner",
  goal: "ship",
  loopType: "deterministic",
  trigger: { type: "manual" },
  stateSource: "memory",
  gates: [{ name: "g", kind: "reviewer", check: "ok" }],
  budget: DEFAULT_BUDGET,
  giveUp: "stop",
  errorPolicy: "retry",
  guardrails: [],
  humanGate: "review",
  memoryWrites: "append",
  role: "standalone",
  concurrency: "sequential",
};

const iteration = (verdict: "pass" | "fail" | "pending", tokens?: number) =>
  newIteration(
    { n: 1, sensed: "s", decided: "d", acted: "a", feedback: "f", verdict, tokens },
    NOW,
  );

describe("newLoop", () => {
  it("assigns a generated id with the loop prefix", () => {
    expect(newLoop(baseSpecArgs, NOW).id.startsWith("lp_")).toBe(true);
  });

  it("stamps the creation time", () => {
    expect(newLoop(baseSpecArgs, NOW).createdAt).toBe(NOW);
  });
});

describe("newRun", () => {
  it("starts in the draft status", () => {
    expect(newRun(newLoop(baseSpecArgs, NOW), NOW).status).toBe("draft");
  });

  it("starts with zero tokens used", () => {
    expect(newRun(newLoop(baseSpecArgs, NOW), NOW).tokensUsed).toBe(0);
  });
});

describe("newIteration", () => {
  it("records the verdict", () => {
    expect(iteration("pass").verdict).toBe("pass");
  });

  it("omits tokens when not supplied", () => {
    expect(iteration("pending").tokens).toBeUndefined();
  });
});

describe("recordIteration", () => {
  it("appends the iteration to the run", () => {
    const run = newRun(newLoop(baseSpecArgs, NOW), NOW);
    expect(recordIteration(run, iteration("pass"), NOW).iterations).toHaveLength(
      1,
    );
  });

  it("accumulates token usage", () => {
    const run = newRun(newLoop(baseSpecArgs, NOW), NOW);
    expect(recordIteration(run, iteration("pass", 50), NOW).tokensUsed).toBe(50);
  });
});

describe("setRunStatus", () => {
  it("updates the run status", () => {
    const run = newRun(newLoop(baseSpecArgs, NOW), NOW);
    expect(setRunStatus(run, "running", NOW).status).toBe("running");
  });
});

describe("budgetExceeded", () => {
  it("is true once the iteration cap is reached", () => {
    let run = newRun(
      newLoop({ ...baseSpecArgs, budget: { ...DEFAULT_BUDGET, maxIterations: 1 } }, NOW),
      NOW,
    );
    run = recordIteration(run, iteration("pass"), NOW);
    expect(budgetExceeded(run, NOW)).toBe(true);
  });

  it("is false for a fresh run within budget", () => {
    const run = newRun(newLoop(baseSpecArgs, NOW), NOW);
    expect(budgetExceeded(run, NOW)).toBe(false);
  });
});

describe("allGatesPassed", () => {
  it("is true when the latest iteration verdict is pass", () => {
    let run = newRun(newLoop(baseSpecArgs, NOW), NOW);
    run = recordIteration(run, iteration("pass"), NOW);
    expect(allGatesPassed(run)).toBe(true);
  });

  it("is false when the spec has no gates", () => {
    const run = newRun(newLoop({ ...baseSpecArgs, gates: [] }, NOW), NOW);
    expect(allGatesPassed(run)).toBe(false);
  });

  it("is false when there are no iterations", () => {
    const run = newRun(newLoop(baseSpecArgs, NOW), NOW);
    expect(allGatesPassed(run)).toBe(false);
  });
});

describe("skeletonSpec", () => {
  it("carries the supplied goal", () => {
    expect(skeletonSpec({ goal: "watch", agentId: "a" }, NOW).goal).toBe("watch");
  });

  it("defaults to the deterministic loop type", () => {
    expect(skeletonSpec({ goal: "watch", agentId: "a" }, NOW).loopType).toBe(
      "deterministic",
    );
  });
});

describe("LOOP_TEMPLATES", () => {
  it("builds a spec carrying the supplied goal", () => {
    const built = LOOP_TEMPLATES[0]!.build("keep green", "agent_planner", NOW);
    expect(built.goal).toBe("keep green");
  });

  it("builds the research monitor as a scheduled trigger", () => {
    const monitor = LOOP_TEMPLATES.find((t) => t.id === "research-monitor")!;
    expect(monitor.build("watch", "a", NOW).trigger.type).toBe("schedule");
  });
});
