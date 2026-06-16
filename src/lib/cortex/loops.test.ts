import { describe, expect, it } from "vitest";
import {
  allGatesPassed,
  budgetExceeded,
  DEFAULT_BUDGET,
  ensureRunRubric,
  LOOP_TEMPLATES,
  newIteration,
  newLoop,
  newRubric,
  newRun,
  recordIteration,
  refineRubric,
  seedRubricCriteria,
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

const LATER = NOW + 1_000;

describe("newRubric", () => {
  it("assigns a generated id with the rubric prefix", () => {
    expect(newRubric(["a"], NOW).id.startsWith("rb_")).toBe(true);
  });

  it("stores the supplied criteria", () => {
    expect(newRubric(["a", "b"], NOW).criteria).toEqual(["a", "b"]);
  });

  it("stamps the update time", () => {
    expect(newRubric(["a"], NOW).updatedAt).toBe(NOW);
  });
});

describe("refineRubric", () => {
  it("appends the human-flagged criterion", () => {
    const rubric = newRubric(["grounded"], NOW);
    expect(refineRubric(rubric, "cites a source", LATER).criteria).toContain(
      "Human-flagged miss: cites a source",
    );
  });

  it("drops a near-duplicate existing criterion", () => {
    const rubric = newRubric(["output must cite a source"], NOW);
    const refined = refineRubric(rubric, "cite a source", LATER);
    expect(refined.criteria).toEqual(["Human-flagged miss: cite a source"]);
  });

  it("ignores a whitespace-only flag and leaves the rubric unchanged", () => {
    const rubric = newRubric(["grounded"], NOW);
    expect(refineRubric(rubric, "   ", LATER)).toBe(rubric);
  });

  it("bumps the update time", () => {
    expect(refineRubric(newRubric(["a"], NOW), "miss", LATER).updatedAt).toBe(
      LATER,
    );
  });
});

describe("seedRubricCriteria", () => {
  it("returns the checks of reviewer gates only", () => {
    const spec = newLoop(
      {
        ...baseSpecArgs,
        gates: [
          { name: "tests", kind: "command", check: "exit 0" },
          { name: "tsc", kind: "invariant", check: "tsc --noEmit" },
          { name: "review", kind: "reviewer", check: "reviewer confirms goal" },
        ],
      },
      NOW,
    );
    expect(seedRubricCriteria(spec)).toEqual(["reviewer confirms goal"]);
  });

  it("is empty when the spec has no reviewer gate", () => {
    const spec = newLoop(
      {
        ...baseSpecArgs,
        gates: [{ name: "tests", kind: "command", check: "exit 0" }],
      },
      NOW,
    );
    expect(seedRubricCriteria(spec)).toEqual([]);
  });
});

describe("ensureRunRubric", () => {
  it("attaches a seeded rubric when none is present", () => {
    const run = newRun(newLoop(baseSpecArgs, NOW), NOW);
    const ensured = ensureRunRubric(run, LATER);
    expect(ensured.rubric?.criteria).toEqual(["ok"]);
    expect(ensured.rubric?.id.startsWith("rb_")).toBe(true);
  });

  it("leaves an existing rubric untouched", () => {
    const existing = newRubric(["already sharpened"], NOW);
    const run = { ...newRun(newLoop(baseSpecArgs, NOW), NOW), rubric: existing };
    expect(ensureRunRubric(run, LATER).rubric).toBe(existing);
  });
});
