// Same-origin proxy for the Walrus Memory (MemWal) relayer. The managed relayer
// only returns CORS headers for its own dashboard origin, so direct browser calls
// from the app are blocked and the SDK throws "Failed to fetch". The browser SDK is
// pointed here (serverUrl = /api/memwal/<network>); we forward the already-signed
// request to the real relayer server-side, where CORS does not apply, and return
// its response verbatim. The delegate private key never reaches the server  -  the
// SDK signs in the browser and ships only SEAL session bytes + signature headers,
// which we pass through untouched. The relayer host is resolved here from server
// env per network (never from the caller), so this is not an open proxy. NOTE: the
// per-network URL is read with STATIC literal keys and the env module is NOT
// imported  -  that module is "use client", so importing it into this server route
// would yield client-reference stubs that throw when used server-side.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_RELAYER = "https://relayer.memory.walrus.xyz";
const RELAYERS: Record<string, string> = {
  testnet:
    process.env.NEXT_PUBLIC_MEMWAL_SERVER_URL_TESTNET || DEFAULT_RELAYER,
  mainnet:
    process.env.NEXT_PUBLIC_MEMWAL_SERVER_URL_MAINNET || DEFAULT_RELAYER,
};

const HOP_BY_HOP = new Set([
  "host",
  "connection",
  "content-length",
  "accept-encoding",
]);

function forwardHeaders(src: Headers): Headers {
  const out = new Headers();
  src.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) out.set(key, value);
  });
  return out;
}

async function proxy(req: Request, path: string[]): Promise<Response> {
  const [network, ...rest] = path;
  const relayer = network ? RELAYERS[network] : undefined;
  if (!relayer) {
    return new Response(JSON.stringify({ error: "unknown network" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  const search = new URL(req.url).search;
  const target = `${relayer.replace(/\/$/, "")}/${rest.join("/")}${search}`;

  const init: RequestInit = {
    method: req.method,
    headers: forwardHeaders(req.headers),
    cache: "no-store",
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
