// Fetch a webpage server-side (avoids browser CORS) and reduce it to readable
// text + a title, so the capture layer can distill it into memories. Best-effort
// HTML stripping  -  enough to feed extraction, not a full reader-mode parser.

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_CHARS = 20_000;
const FETCH_TIMEOUT_MS = 12_000;
const IPV4_OCTET_COUNT = 4;
const IPV4_MAX_OCTET = 255;
const IPV4_VERSION = 4;
const IPV6_VERSION = 6;

function ipv4ToOctets(ip: string): number[] | null {
  const parts = ip.split(".");
  if (parts.length !== IPV4_OCTET_COUNT) return null;
  const octets = parts.map((p) => Number(p));
  if (octets.some((o) => !Number.isInteger(o) || o < 0 || o > IPV4_MAX_OCTET)) {
    return null;
  }
  return octets;
}

function isBlockedIpv4(ip: string): boolean {
  const o = ipv4ToOctets(ip);
  if (!o) return true;
  const [a, b] = o;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b! >= 16 && b! <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a! >= 224) return true;
  return false;
}

function isBlockedIpv6(ip: string): boolean {
  const v = ip.toLowerCase().split("%")[0]!;
  if (v === "::1" || v === "::") return true;
  if (v.startsWith("fe80") || v.startsWith("fc") || v.startsWith("fd")) {
    return true;
  }
  const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedIpv4(mapped[1]!);
  return false;
}

function isBlockedAddress(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === IPV4_VERSION) return isBlockedIpv4(ip);
  if (kind === IPV6_VERSION) return isBlockedIpv6(ip);
  return true;
}

async function isSafeTarget(target: URL): Promise<boolean> {
  const host = target.hostname.replace(/^\[|\]$/g, "");
  const lowered = host.toLowerCase();
  if (lowered === "localhost" || lowered.endsWith(".localhost")) return false;
  if (isIP(host)) return !isBlockedAddress(host);
  try {
    const resolved = await lookup(host, { all: true });
    if (resolved.length === 0) return false;
    return resolved.every((r) => !isBlockedAddress(r.address));
  } catch {
    return false;
  }
}

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

  if (!(await isSafeTarget(target))) {
    return Response.json(
      { error: "target host is not allowed" },
      { status: 400 },
    );
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
