// Image → factual context for memory. Picks the cheapest available vision-capable
// model (Gemini Flash → Claude Haiku → GPT-5 mini) so cost stays low without
// degrading quality. Returns plain text describing what's actually in the image.

import { LLM_MODELS } from "@/lib/llm/models";
import { complete, hasProviderKey, type ImageInput } from "@/lib/llm/complete";

const VISION_PREFERENCE = ["gemini-2.5-flash", "claude-haiku-4-5", "gpt-5-mini"];
const MAX_TOKENS = 500;

function pickVisionModel() {
  for (const id of VISION_PREFERENCE) {
    const model = LLM_MODELS.find((m) => m.id === id);
    if (model && hasProviderKey(model.provider)) return model;
  }
  return null;
}

export async function POST(req: Request) {
  let body: { images: ImageInput[]; prompt?: string };
  try {
    body = (await req.json()) as { images: ImageInput[]; prompt?: string };
  } catch {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  if (!body.images?.length) {
    return Response.json({ error: "no images" }, { status: 400 });
  }
  const model = pickVisionModel();
  if (!model) {
    return Response.json({ text: "", ok: false, reason: "no-key" });
  }

  const system =
    "You extract concise, factual context from images for a personal memory system. " +
    "Describe what is actually shown  -  visible text, objects, people, scene, charts, any readable details  -  " +
    "in a few plain sentences. Never speculate or invent; if something is unclear, say so.";

  const result = await complete({
    model,
    system,
    user: body.prompt || "Describe this image's content so it can be remembered.",
    images: body.images,
    maxTokens: MAX_TOKENS,
  });
  return Response.json({
    text: result.text,
    ok: result.ok,
    model: model.name,
    reason: result.reason,
  });
}
