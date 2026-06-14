// Grounded question answering over the user's recalled memories, using whichever
// model they picked. Guardrails keep it grounded: answer only from the supplied
// memories (plus general knowledge when web is on), cite them inline, and admit
// when nothing relevant was found. Falls back to a deterministic answer when the
// chosen provider has no key.

import { modelByName } from "@/lib/llm/models";
import { complete } from "@/lib/llm/complete";

interface AskMemory {
  text: string;
  label?: string;
  when?: string;
}

interface Body {
  question: string;
  memories: AskMemory[];
  web?: boolean;
  model?: string;
}

const MAX_TOKENS = 700;

function fallbackAnswer(question: string, memories: AskMemory[]): string {
  if (!memories.length) {
    return "I don't have a memory or source that touches on that yet. Keep a note about it, or turn on web search, and I'll be able to answer.";
  }
  const parts: string[] = [];
  if (memories[0]) parts.push(`From what you've kept, ${memories[0].text} [1]`);
  if (memories[1]) {
    const t = memories[1].text;
    parts.push(`you also noted ${t.charAt(0).toLowerCase()}${t.slice(1)} [2]`);
  }
  return parts.join(". ") + ".";
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  const { question, memories = [], web, model } = body;
  const fallback = fallbackAnswer(question, memories);
  const chosen = modelByName(model);

  const system =
    "You are Cortex, a calm personal memory assistant. Answer the user's question using ONLY the memories provided" +
    (web ? ", drawing on general knowledge to fill gaps" : "") +
    ". Cite the memories you use inline as [1], [2], matching their numbers. " +
    "If the memories don't cover the question" +
    (web ? " and you are unsure" : "") +
    ", say so plainly rather than inventing an answer. Keep it concise, warm, and in the user's voice.";

  const context = memories.length
    ? memories
        .map(
          (m, i) =>
            `[${i + 1}] ${m.text}${m.label ? ` (${m.label}` : ""}${
              m.when ? `, ${m.when})` : m.label ? ")" : ""
            }`,
        )
        .join("\n")
    : "(no memories matched this question)";

  const result = await complete({
    model: chosen,
    system,
    user: `My memories:\n${context}\n\nQuestion: ${question}`,
    maxTokens: MAX_TOKENS,
  });
  return result.ok
    ? Response.json({ answer: result.text, ai: true, model: chosen.name })
    : Response.json({ answer: fallback, ai: false, reason: result.reason });
}
