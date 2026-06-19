import { describe, expect, it } from "vitest";
import {
  agentById,
  agentByRole,
  buildAgentStepInput,
  handoff,
  newObservation,
  newTask,
  setStatus,
} from "@/lib/cortex/agents";

const NOW = 1_700_000_000_000;

describe("agentById", () => {
  it("finds a defined agent by its id", () => {
    expect(agentById("agent_researcher")?.role).toBe("researcher");
  });

  it("returns undefined for an unknown id", () => {
    expect(agentById("nope")).toBeUndefined();
  });
});

describe("agentByRole", () => {
  it("returns the agent matching the role", () => {
    expect(agentByRole("curator").id).toBe("agent_curator");
  });

  it("throws for an unknown role", () => {
    expect(() => agentByRole("ghost" as never)).toThrow();
  });
});

describe("newTask", () => {
  it("starts in the open status", () => {
    expect(newTask("ship it", "agent_planner", "agent_critic", NOW).status).toBe(
      "open",
    );
  });

  it("assigns the task to the given agent", () => {
    expect(
      newTask("ship it", "agent_planner", "agent_critic", NOW).assignedTo,
    ).toBe("agent_planner");
  });

  it("starts with no observations", () => {
    expect(
      newTask("ship it", "agent_planner", "agent_critic", NOW).observations,
    ).toEqual([]);
  });
});

describe("newObservation", () => {
  it("records the observation text", () => {
    expect(newObservation("agent_researcher", "found a source", NOW).text).toBe(
      "found a source",
    );
  });

  it("omits memory refs when none are supplied", () => {
    expect(
      newObservation("agent_researcher", "noted", NOW).memoryRefs,
    ).toBeUndefined();
  });

  it("keeps memory refs when supplied", () => {
    expect(
      newObservation("agent_researcher", "noted", NOW, ["m1"]).memoryRefs,
    ).toEqual(["m1"]);
  });
});

describe("setStatus", () => {
  it("updates the task status", () => {
    const task = newTask("g", "agent_planner", "agent_critic", NOW);
    expect(setStatus(task, "done", NOW + 1).status).toBe("done");
  });

  it("does not mutate the original task", () => {
    const task = newTask("g", "agent_planner", "agent_critic", NOW);
    setStatus(task, "done", NOW + 1);
    expect(task.status).toBe("open");
  });
});

describe("handoff", () => {
  it("reassigns the task to the target agent", () => {
    const task = newTask("g", "agent_planner", "agent_critic", NOW);
    expect(handoff(task, "agent_curator", NOW + 1).assignedTo).toBe(
      "agent_curator",
    );
  });

  it("moves the task into the in-progress status", () => {
    const task = newTask("g", "agent_planner", "agent_critic", NOW);
    expect(handoff(task, "agent_curator", NOW + 1).status).toBe("in_progress");
  });
});

describe("buildAgentStepInput", () => {
  it("includes the task goal", () => {
    const task = newTask("write the report", "agent_planner", "agent_critic", NOW);
    expect(buildAgentStepInput({ task, memories: [] })).toContain(
      "Goal: write the report",
    );
  });

  it("notes the absence of shared memories", () => {
    const task = newTask("g", "agent_planner", "agent_critic", NOW);
    expect(buildAgentStepInput({ task, memories: [] })).toContain(
      "(no shared memories supplied)",
    );
  });

  it("numbers supplied memories", () => {
    const task = newTask("g", "agent_planner", "agent_critic", NOW);
    expect(
      buildAgentStepInput({ task, memories: [{ text: "fact one" }] }),
    ).toContain("[1] fact one");
  });
});
