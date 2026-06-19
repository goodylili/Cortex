// Dreams (V1) — the offline pass that surfaces insights you didn't ask for:
// connections, summaries and emerging patterns across your memories. Uses the
// Anthropic API when ANTHROPIC_API_KEY is set; otherwise a deterministic
// fallback so reflection always returns something.

import type { Memory } from "@/lib/cortex/logic";
import { DEFAULT_MODEL } from "@/lib/llm/models";
import { complete } from "@/lib/llm/complete";

interface Dream {
  title: string;
  body: string;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function fallbackDreams(memories: Memory[]): Dream[] {
  const counts: Record<string, number> = {};
  memories.forEach((m) =>
    (m.tags || []).forEach((t) => (counts[t] = (counts[t] || 0) + 1)),
  );
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const out: Dream[] = [];
  if (top[0])
    out.push({
      title: `${cap(top[0][0])} keeps coming up`,
      body: `${top[0][1]} of your memories touch ${top[0][0]}. It's becoming a theme worth its own space.`,
    });
  if (top[0] && top[1])
    out.push({
      title: `A thread between ${top[0][0]} and ${top[1][0]}`,
      body: `Your ${top[0][0]} and ${top[1][0]} memories keep surfacing in the same stretches — there may be a connection there.`,
    });
  const kept = memories.filter((m) => m.kept);
  if (kept.length)
    out.push({
      title: "What you hold closest",
      body: `You've kept ${kept.length} memories close. They centre on ${
        Array.from(new Set(kept.map((m) => m.tags?.[0]).filter(Boolean)))
          .slice(0, 3)
          .join(", ") || "a few themes"
      }.`,
    });
  return out.slice(0, 4);
}

export async function POST(req: Request) {
  let memories: Memory[] = [];
  try {
    const body = (await req.json()) as { memories?: Memory[] };
    memories = body.memories ?? [];
  } catch {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  const fallback = fallbackDreams(memories);
  if (memories.length < 2) {
    return Response.json({ dreams: fallback, ai: false });
  }

  const list = memories
    .map(
      (m) =>
        `- ${m.text}${m.kept ? " (kept close)" : ""} [${(m.tags || []).join(", ")}]`,
    )
    .join("\n");
  const system =
    'You are the dreaming layer of Cortex, a personal memory system. While the user is away you look across their memories and surface insights they did NOT explicitly ask for: genuine connections between memories, emerging patterns, and short summaries. Be specific and grounded only in the memories given — never invent facts. Return STRICT JSON only: an array of 2 to 4 objects, each {"title": short, "body": one or two sentences}. No prose outside the JSON.';
  const result = await complete({
    model: DEFAULT_MODEL,
    system,
    user: `My memories:\n${list}\n\nSurface insights now as JSON.`,
    maxTokens: 900,
  });
  if (!result.ok) return Response.json({ dreams: fallback, ai: false });
  const match = result.text.match(/\[[\s\S]*\]/);
  let parsed: Dream[] | null = null;
  try {
    parsed = match ? (JSON.parse(match[0]) as Dream[]) : null;
  } catch {
    parsed = null;
  }
  const dreams =
    Array.isArray(parsed) && parsed.length
      ? parsed
          .filter((d) => d && d.title && d.body)
          .slice(0, 4)
          .map((d) => ({ title: String(d.title), body: String(d.body) }))
      : fallback;
  return Response.json({ dreams, ai: dreams !== fallback });
}
