// Generates a LoopSpec from a task plus the agent's recalled memory, mirroring how
// Studio turns memories into a ready-to-use prompt. The point is grounding: the
// spec's verification gates, state source, guardrails, and human gate are drawn from
// what the agent already knows, not invented. Falls back to a deterministic skeleton
// when the chosen provider has no key or the model returns something that won't
// validate, so this route never 500s on a missing key or bad model output.

import { z } from "zod";

import { AGENTS, agentById } from "@/lib/cortex/agents";
import {
  buildLoopSpecInput,
  skeletonSpec,
  type LoopSpec,
} from "@/lib/cortex/loops";
import { complete } from "@/lib/llm/complete";
import { modelByName } from "@/lib/llm/models";

interface LoopMemory {
  text: string;
  label?: string;
  when?: string;
}

interface Body {
  task: string;
  agentId?: string;
  memories?: LoopMemory[];
  model?: string;
}

const MAX_TOKENS = 1200;
const FENCE_PATTERN = /^```(?:json)?\s*([\s\S]*?)\s*```$/;

const gateSchema = z.object({
  name: z.string(),
  kind: z.enum(["command", "invariant", "reviewer"]),
  check: z.string(),
});

const budgetSchema = z.object({
  maxIterations: z.number().int().positive(),
  maxTokens: z.number().int().positive(),
  maxWallClockMs: z.number().int().positive(),
  maxItems: z.number().int().positive().optional(),
});

const triggerSchema = z.object({
  type: z.enum(["manual", "schedule", "event"]),
  on: z.string().optional(),
});

const loopSpecSchema = z.object({
  id: z.string().optional(),
  agentId: z.string().optional(),
  goal: z.string(),
  loopType: z.enum(["deterministic", "nondeterministic"]),
  trigger: triggerSchema,
  stateSource: z.string(),
  gates: z.array(gateSchema),
  budget: budgetSchema,
  giveUp: z.string(),
  errorPolicy: z.string(),
  guardrails: z.array(z.string()),
  humanGate: z.string(),
  memoryWrites: z.string(),
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
});

const SYSTEM =
  "You are a loop-spec generator inside Cortex, a personal memory system. " +
  "You read the agent's recalled memory and emit ONLY a single JSON LoopSpec object — " +
  "no preamble, no commentary, no markdown code fences. " +
  "The LoopSpec has exactly these fields: " +
  "id (string), agentId (string), goal (string), " +
  'loopType ("deterministic" | "nondeterministic"), ' +
  'trigger ({ type: "manual" | "schedule" | "event", on?: string }), ' +
  "stateSource (string: what the loop senses each iteration), " +
  'gates (array of { name: string, kind: "command" | "invariant" | "reviewer", check: string }), ' +
  "budget ({ maxIterations: number, maxTokens: number, maxWallClockMs: number, maxItems?: number }), " +
  "giveUp (string: the condition that ends the loop unfinished), " +
  "errorPolicy (string: what to do when an action errors), " +
  "guardrails (array of strings), humanGate (string), and memoryWrites (string: what gets written back to memory). " +
  "Ground EVERY field in the supplied memories: set a command gate to the EXACT test or build command the memory shows this project uses; " +
  "set guardrails and the state source from what the agent has touched or been told before; do not invent commands, paths, or conventions absent from the memories. " +
  'Choose loopType "deterministic" when the memories support a machine-checkable definition of done (a test/build command, an invariant) and make that the terminal gate with kind "command" or "invariant"; ' +
  'otherwise choose "nondeterministic" and include a gate with kind "reviewer" as the reviewer gate. ' +
  "Keep budgets sane (small maxIterations, bounded tokens and wall-clock ms). " +
  "The humanGate must respect a human in the loop: prepare the change for review (stage, summarize, open a draft PR) and never auto-commit, auto-merge, or auto-deploy.";

function stripFences(text: string): string {
  const match = text.trim().match(FENCE_PATTERN);
  return match ? match[1]!.trim() : text.trim();
}

function stamp(
  parsed: z.infer<typeof loopSpecSchema>,
  fallbackAgentId: string,
  now: number,
): LoopSpec {
  return {
    ...parsed,
    id: parsed.id ?? `loop_${now.toString(36)}`,
    agentId: parsed.agentId ?? fallbackAgentId,
    createdAt: parsed.createdAt ?? now,
    updatedAt: parsed.updatedAt ?? now,
  };
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "bad request" }, { status: 400 });
  }

  const { task, agentId, memories = [], model } = body;
  const fallbackAgentId =
    agentId && agentById(agentId) ? agentId : AGENTS[0]!.id;
  const now = Date.now();

  const chosen = modelByName(model);
  const user = buildLoopSpecInput({ task, memories });

  const result = await complete({
    model: chosen,
    system: SYSTEM,
    user,
    maxTokens: MAX_TOKENS,
  });

  if (!result.ok) {
    return Response.json({
      spec: skeletonSpec({ goal: task, agentId: fallbackAgentId }, now),
      ai: false,
      reason: result.reason,
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFences(result.text));
  } catch {
    return Response.json({
      spec: skeletonSpec({ goal: task, agentId: fallbackAgentId }, now),
      ai: false,
      reason: "parse-failed",
    });
  }

  const validated = loopSpecSchema.safeParse(parsed);
  if (!validated.success) {
    return Response.json({
      spec: skeletonSpec({ goal: task, agentId: fallbackAgentId }, now),
      ai: false,
      reason: "schema-failed",
    });
  }

  return Response.json({
    spec: stamp(validated.data, fallbackAgentId, now),
    ai: true,
  });
}
