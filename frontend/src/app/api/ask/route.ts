// Grounded question answering over the user's recalled memories, using whichever
// model they picked. Guardrails keep it grounded: answer only from the supplied
// memories (plus general knowledge when web is on), cite them inline, and admit
// when nothing relevant was found. Falls back to a deterministic answer when the
// chosen provider has no key.

import { modelByName } from "@/lib/llm/models";
import { complete } from "@/lib/llm/complete";
import {
  ASK_MAX_TOKENS,
  askFallback,
  askSystem,
  askUser,
  splitThinking,
  type AskMemory,
  type AskTurn,
} from "@/lib/llm/ask-prompt";

interface Body {
  question: string;
  memories: AskMemory[];
  history?: AskTurn[];
  web?: boolean;
  model?: string;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  const { question, memories = [], history = [], web, model } = body;
  const fallback = askFallback(question, memories);
  const chosen = modelByName(model);

  const result = await complete({
    model: chosen,
    system: askSystem(web),
    user: askUser(question, memories, history),
    maxTokens: ASK_MAX_TOKENS,
  });
  if (!result.ok) {
    return Response.json({ answer: fallback, ai: false, reason: result.reason });
  }
  const { thinking, answer } = splitThinking(result.text);
  return Response.json({
    answer: answer || fallback,
    thinking,
    ai: true,
    model: chosen.name,
  });
}
