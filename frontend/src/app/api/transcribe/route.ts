// Audio -> transcript via Gemini (the free-tier model, so voice matches the rest
// of the free features). The browser sends the audio (or audio extracted from video
// by ffmpeg.wasm) as multipart form data; we hand it to Gemini as inline audio.

const MODEL = "gemini-2.5-flash";
const PROMPT =
  "Transcribe this audio verbatim. Return only the transcript text, with no preamble, labels, or commentary.";

export async function POST(req: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return Response.json({ text: "", ok: false, reason: "no-key" });

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("file");
    if (f instanceof File) file = f;
  } catch {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  if (!file) return Response.json({ error: "no audio" }, { status: 400 });

  try {
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: PROMPT },
                {
                  inline_data: {
                    mime_type: file.type || "audio/webm",
                    data: base64,
                  },
                },
              ],
            },
          ],
        }),
      },
    );
    if (!res.ok) {
      return Response.json({
        text: "",
        ok: false,
        reason: `status ${res.status}`,
      });
    }
    const data = await res.json();
    const text: string = (data?.candidates?.[0]?.content?.parts ?? [])
      .map((p: { text?: string }) => p.text ?? "")
      .join("")
      .trim();
    return text
      ? Response.json({ text, ok: true })
      : Response.json({ text: "", ok: false, reason: "empty" });
  } catch (err) {
    return Response.json({
      text: "",
      ok: false,
      reason: `fetch-failed: ${(err as Error).message}`,
    });
  }
}
