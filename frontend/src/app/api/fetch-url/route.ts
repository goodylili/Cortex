// Fetch a webpage server-side (avoids browser CORS) and reduce it to readable
// text + a title, so the capture layer can distill it into memories. Best-effort
// HTML stripping  -  enough to feed extraction, not a full reader-mode parser.

const MAX_CHARS = 20_000;
const FETCH_TIMEOUT_MS = 12_000;

function extractTitle(html: string, fallback: string): string {
  const og = html.match(
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
  );
  if (og?.[1]) return og[1].trim();
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return t?.[1]?.trim() || fallback;
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(req: Request) {
  let url: string;
  try {
    ({ url } = (await req.json()) as { url: string });
  } catch {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  let target: URL;
  try {
    target = new URL(url);
    if (target.protocol !== "http:" && target.protocol !== "https:") {
      throw new Error("unsupported protocol");
    }
  } catch {
    return Response.json({ error: "invalid url" }, { status: 400 });
  }

  try {
    const res = await fetch(target, {
      headers: { "user-agent": "CortexBot/1.0 (+memory ingestion)" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      return Response.json(
        { error: `fetch failed: ${res.status}` },
        { status: 502 },
      );
    }
    const html = await res.text();
    const title = extractTitle(html, target.hostname);
    const text = htmlToText(html).slice(0, MAX_CHARS);
    return Response.json({ title, text, url: target.toString() });
  } catch (err) {
    return Response.json(
      { error: `fetch failed: ${(err as Error).message}` },
      { status: 502 },
    );
  }
}
