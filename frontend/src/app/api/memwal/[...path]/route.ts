// Same-origin proxy for the Walrus Memory (MemWal) relayer. The managed relayer
// only returns CORS headers for its own dashboard origin, so direct browser calls
// from the app are blocked and the SDK throws "Failed to fetch". The browser SDK is
// pointed here (serverUrl = /api/memwal/<network>); we forward the already-signed
// request to the real relayer server-side, where CORS does not apply, and return
// its response verbatim. The delegate private key never reaches the server  -  the
// SDK signs in the browser and ships only SEAL session bytes + signature headers,
// which we pass through untouched. The relayer host is resolved from server config
// per network (never from the caller), so this is not an open proxy.

import { CORTEX_NETWORKS, cortexEnvFor } from "@/lib/cortex/walrus/env";
import type { CortexNetwork } from "@/lib/cortex/walrus/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HOP_BY_HOP = new Set([
  "host",
  "connection",
  "content-length",
  "accept-encoding",
]);

function isNetwork(value: string): value is CortexNetwork {
  return (CORTEX_NETWORKS as string[]).includes(value);
}

function forwardHeaders(src: Headers): Headers {
  const out = new Headers();
  src.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) out.set(key, value);
  });
  return out;
}

async function proxy(req: Request, path: string[]): Promise<Response> {
  const [network, ...rest] = path;
  if (!network || !isNetwork(network)) {
    return new Response(JSON.stringify({ error: "unknown network" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  const relayer = cortexEnvFor(network).memwal.serverUrl.replace(/\/$/, "");
  const search = new URL(req.url).search;
  const target = `${relayer}/${rest.join("/")}${search}`;

  const init: RequestInit = {
    method: req.method,
    headers: forwardHeaders(req.headers),
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.arrayBuffer();
  }

  const upstream = await fetch(target, init);
  const body = await upstream.arrayBuffer();
  const headers = new Headers();
  const contentType = upstream.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  return new Response(body, { status: upstream.status, headers });
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  return proxy(req, (await ctx.params).path);
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  return proxy(req, (await ctx.params).path);
}
