// Audio → transcript via a cheap Whisper-class model. The browser sends the audio
// (or audio extracted from video by ffmpeg.wasm) as multipart form data; we forward
// it to the transcription API and return plain text.

const TRANSCRIBE_MODEL = "whisper-1";

export async function POST(req: Request) {
  const key = process.env.OPENAI_API_KEY;
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

  const out = new FormData();
  out.append("file", file, file.name || "audio");
  out.append("model", TRANSCRIBE_MODEL);

  try {
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { authorization: `Bearer ${key}` },
      body: out,
    });
    if (!res.ok) {
      return Response.json({ text: "", ok: false, reason: `status ${res.status}` });
    }
    const data = await res.json();
    const text: string = data?.text ?? "";
    return text.trim()
      ? Response.json({ text: text.trim(), ok: true })
      : Response.json({ text: "", ok: false, reason: "empty" });
  } catch (err) {
    return Response.json({
      text: "",
      ok: false,
      reason: `fetch-failed: ${(err as Error).message}`,
    });
  }
}
