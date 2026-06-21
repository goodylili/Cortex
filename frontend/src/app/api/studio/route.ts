// Prompt Studio generation. Writes a ready-to-use prompt grounded in the user's
// memories, in the chosen style/type/modality, using whichever model the user
// picked (any of the 8 providers). Falls back to the deterministic template when
// the chosen provider has no key configured, so the studio always returns output.

import {
  buildSpec,
  compilePrompt,
  type PromptStyle,
  type PromptType,
  type PromptModality,
} from "@/lib/cortex/prompt";
import type { Memory } from "@/lib/cortex/logic";
import { modelByName } from "@/lib/llm/models";
import { complete } from "@/lib/llm/complete";

interface Body {
  task: string;
  memories: Memory[];
  style: PromptStyle;
  type: PromptType;
  modality: PromptModality;
  model?: string;
  web?: boolean;
}

const MAX_TOKENS = 1600;

// Models like to wrap the prompt in meta the user did not ask for: a leading
// "Category:" / "Title:" / "Prompt:" label line, a "Here is the prompt" preamble,
// code fences, or surrounding quotes. The Studio output is meant to be pasted
// straight into an AI, so strip that scaffolding and hand back only the prompt.
function sanitizePrompt(text: string): string {
  let out = text.trim();
  const fence = out.match(/^```[^\n]*\n([\s\S]*?)\n```$/);
  if (fence) out = fence[1].trim();
  out = out
    .replace(
      /^(?:category|title|prompt|output|response|here(?:'|’)?s(?: the)?[^\n:]*|here is[^\n:]*)\s*:[^\n]*\n+/i,
      "",
    )
    .trim();
  if (out.length > 1 && out.startsWith('"') && out.endsWith('"')) {
    out = out.slice(1, -1).trim();
  }
  return out;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  const { task, memories = [], style, type, modality, model, web } = body;
  const input = { task, memories, modality };
  const fallback = compilePrompt(style, type, input);
  const spec = buildSpec(style, input);
  const chosen = modelByName(model);

  const system =
    "You are an expert prompt engineer working inside Cortex, a personal memory system. " +
    "Output ONLY the finished prompt, ready to paste into an AI - nothing else. " +
    "Do NOT add a category, title, heading, label, or preamble (never start with lines like 'Category:', 'Title:', 'Prompt:', or 'Here is...'). " +
    "Do NOT wrap the prompt in quotes or markdown code fences, and do NOT explain it afterward. " +
    "Write a genuinely strong, specific prompt: name the role/persona the AI should adopt, state the concrete task, spell out the key requirements, constraints, and any structure or length expectations, and make every instruction actionable rather than a vague description. " +
    "Ground it in the user's stated memories, treat their standing preferences as non-negotiable, and keep their voice. " +
    (web
      ? "Where the memories don't cover something, you may draw on broad general knowledge. "
      : "Do not invent facts beyond the user's memories and the task. ") +
    `Render the prompt in the requested output format (${type}).`;
  const user = [
    `Prompting technique (style): ${style}  -  ${spec.system}`,
    `Output format (type): ${type}`,
    `Target modality: ${modality}`,
    "",
    spec.standing.length
      ? `Standing preferences (honor these exactly):\n${spec.standing.map((s) => `- ${s}`).join("\n")}`
      : "",
    spec.context.length
      ? `Context memories:\n${spec.context.map((s) => `- ${s}`).join("\n")}`
      : "",
    spec.demos.length
      ? `Examples to stay consistent with:\n${spec.demos.map((s) => `- ${s}`).join("\n")}`
      : "",
    spec.instructions.length
      ? `Technique directives:\n${spec.instructions.map((s) => `- ${s}`).join("\n")}`
      : "",
    "",
    `What the user needs a prompt for: ${spec.task}`,
    "",
    `Now write the final ${modality} prompt, formatted as ${type}.`,
  ]
    .filter((l) => l !== "")
    .join("\n");

  const result = await complete({
    model: chosen,
    system,
    user,
    maxTokens: MAX_TOKENS,
  });
  return result.ok
    ? Response.json({
        prompt: sanitizePrompt(result.text),
        ai: true,
        model: chosen.name,
      })
    : Response.json({ prompt: fallback, ai: false, reason: result.reason });
}
