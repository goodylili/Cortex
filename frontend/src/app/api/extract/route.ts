// Distill a source (note, webpage, or document text) into a few durable, self
// contained memory facts. The heuristic splitter chopped a page into many raw
// sentence fragments; this asks the model for a small set of clean, third-person
// statements anchored on the user so each memory makes sense on its own. Runs on
// the default (Gemini) model; the caller falls back to the heuristic with no key.

import { complete } from "@/lib/llm/complete";
import { DEFAULT_MODEL } from "@/lib/llm/models";

const MAX_FACTS = 6;
const MAX_TOKENS = 700;
const MAX_INPUT_CHARS = 12000;

interface Body {
  text: string;
  title?: string;
  subject?: string;
}

const system = (subject?: string): string =>
  "You distill a source into durable memory facts. " +
  "Return as few facts as faithfully capture the key points, ideally one to four; " +
  "merge related points into a single sentence rather than splitting every line. " +
  "Each fact is one concise, self-contained, third-person sentence that stands on its own" +
  (subject
    ? `, written about ${subject} by name (never "I", "we", or "you")`
    : ", with the subject named rather than referred to as 'I' or 'we'") +
  ". Decode any HTML entities, drop navigation, link lists, and boilerplate, and keep only substantive facts. " +
  "Return ONLY a JSON array of strings and nothing else.";

function parseFacts(raw: string): string[] {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed))
      return parsed
        .map((f) => (typeof f === "string" ? f.trim() : ""))
        .filter(Boolean);
  } catch {
    /* fall through to line splitting */
  }
  return cleaned
    .split("\n")
    .map((l) => l.replace(/^[-*\d.\s"]+/, "").trim())
    .filter(Boolean);
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  const text = (body.text ?? "").trim();
  if (!text) return Response.json({ facts: [], ok: false, reason: "empty" });

  const result = await complete({
    model: DEFAULT_MODEL,
    system: system(body.subject?.trim() || undefined),
    user: `Title: ${body.title ?? "Untitled"}\n\n${text.slice(0, MAX_INPUT_CHARS)}`,
    maxTokens: MAX_TOKENS,
  });
  if (!result.ok)
    return Response.json({ facts: [], ok: false, reason: result.reason });
  return Response.json({
    facts: parseFacts(result.text).slice(0, MAX_FACTS),
    ok: true,
  });
}
