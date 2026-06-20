// Runs the adversarial critic against an iteration's output and a rubric, mirroring
// the loop-spec generator's shape (zod validation, graceful deterministic fallback
// when no model key is set). The verifier uses a model distinct from the builder's so
// the loop never grades its own work; the reviewer verdict is the spec's reviewer gate.

import { z } from "zod";

import { complete } from "@/lib/llm/complete";
import { LLM_MODELS, modelByName, type ModelSpec } from "@/lib/llm/models";

interface Body {
  goal: string;
  output: string;
  rubric?: string[];
  builderModel?: string;
}

const MAX_TOKENS = 600;
const PASS_PREFIX = /^\s*pass\b/i;

const bodySchema = z.object({
  goal: z.string().min(1),
  output: z.string(),
  rubric: z.array(z.string()).optional(),
  builderModel: z.string().optional(),
});

const SYSTEM =
  "You are an adversarial verifier inside Cortex. You did NOT build the work under " +
  "review. Judge strictly whether the iteration output meets the goal against every " +
  "rubric criterion supplied. Begin your reply with PASS or FAIL on its own line, then " +
  "one sentence of concrete evidence citing the rubric. Reward nothing you cannot verify.";

// Pick a verifier model from a different provider than the builder when possible, so
// the critic's judgement is genuinely independent; fall back to any other model.
function pickCriticModel(builder: ModelSpec): ModelSpec {
  const differentProvider = LLM_MODELS.find(
    (m) => m.provider !== builder.provider,
  );
  if (differentProvider) return differentProvider;
  const differentModel = LLM_MODELS.find((m) => m.id !== builder.id);
  return differentModel ?? builder;
}

function buildUser(goal: string, output: string, rubric: string[]): string {
  const rubricBlock = rubric.length
    ? rubric.map((c, i) => `(${i + 1}) ${c}`).join("\n")
    : "(no explicit rubric supplied; judge against the goal alone)";
  return [
    `Goal: ${goal}`,
    "",
    "Rubric criteria:",
    rubricBlock,
    "",
    "Iteration output under review:",
    output || "(no output produced)",
  ].join("\n");
}

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: "bad request" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const { goal, output, rubric = [], builderModel }: Body = parsed.data;
  const builder = modelByName(builderModel);
  const critic = pickCriticModel(builder);

  const result = await complete({
    model: critic,
    system: SYSTEM,
    user: buildUser(goal, output, rubric),
    maxTokens: MAX_TOKENS,
  });

  if (!result.ok) {
    return Response.json({
      verdict: "fail",
      review:
        "No verifier model available; cannot confirm the goal is met  -  escalating to a human.",
      criticModel: critic.name,
      ai: false,
      reason: result.reason,
    });
  }

  const verdict = PASS_PREFIX.test(result.text) ? "pass" : "fail";
  return Response.json({
    verdict,
    review: result.text,
    criticModel: critic.name,
    ai: true,
  });
}
