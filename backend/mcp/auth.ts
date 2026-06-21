// Managed OAuth 2.1 for the Cortex MCP, with no datastore.
//
// The model: an access token is a stateless HS256 JWT that only ROUTES a request
// to a user's namespace ({ sub: suiAddress, ns, acct }). The real authority is the
// on-chain delegate the user grants during consent (account::grant_admin +
// authorizeMemoryDelegate). So revoking that delegate from the dashboard makes any
// token inert, because the MCP can no longer act on that user's account. The only
// durable record is the connected-apps list, written to the user's own account.
//
// Consent runs in the Cortex web app (where the Privy wallet lives). On "Allow",
// the user signs a personal message bound to the OAuth request; the MCP verifies
// that Sui signature to mint the authorization code. That signature is the
// authentication, so there is no password or client secret to manage.

import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { verifyPersonalMessageSignature } from "@mysten/sui/verify";

const CODE_TTL_SEC = 300;
const ACCESS_TTL_SEC = 3600;
const REFRESH_TTL_SEC = 60 * 60 * 24 * 30;
// A copy-paste personal access token for MCP clients that authenticate with a
// static Bearer header instead of running the OAuth flow. It is the same routing
// JWT as a normal access token, just long-lived: the real authority is still the
// on-chain delegate, so revoking that (or the connection) makes it inert.
const PAT_TTL_SEC = 60 * 60 * 24 * 365;
const SCOPE = "cortex.memory";

export interface UserContext {
  address: string;
  namespace: string;
  memwalAccountId: string;
  connectionId: string;
}

const nowSec = (): number => Math.floor(Date.now() / 1000);
const enc = (o: unknown): string =>
  Buffer.from(JSON.stringify(o)).toString("base64url");

function sign(secret: string, header: string, payload: string): string {
  return createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64url");
}

export function mintJwt(
  secret: string,
  claims: Record<string, unknown>,
  ttlSec: number,
): string {
  const header = enc({ alg: "HS256", typ: "JWT" });
  const payload = enc({ ...claims, iat: nowSec(), exp: nowSec() + ttlSec });
  return `${header}.${payload}.${sign(secret, header, payload)}`;
}

export function verifyJwt(
  secret: string,
  token: string,
): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  if (!header || !payload || !signature) return null;
  const expected = sign(secret, header, payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof claims.exp === "number" && claims.exp < nowSec()) return null;
    return claims;
  } catch {
    return null;
  }
}

// RFC 7636 S256: BASE64URL(SHA256(verifier)) === challenge.
function pkceMatches(verifier: string, challenge: string): boolean {
  const hashed = createHash("sha256").update(verifier).digest("base64url");
  const a = Buffer.from(hashed);
  const b = Buffer.from(challenge);
  return a.length === b.length && timingSafeEqual(a, b);
}

// The exact message the web app asks the wallet to sign, bound to the request's
// PKCE challenge so a signature cannot be replayed for a different authorization.
export function consentMessage(codeChallenge: string): string {
  return `Authorize Cortex MCP for Claude\nchallenge:${codeChallenge}`;
}

export async function verifySuiConsent(
  address: string,
  codeChallenge: string,
  signature: string,
): Promise<boolean> {
  try {
    const message = new TextEncoder().encode(consentMessage(codeChallenge));
    const publicKey = await verifyPersonalMessageSignature(message, signature);
    return publicKey.toSuiAddress() === address;
  } catch {
    return false;
  }
}

export function authServerMetadata(issuer: string): Record<string, unknown> {
  return {
    issuer,
    authorization_endpoint: `${issuer}/authorize`,
    token_endpoint: `${issuer}/token`,
    registration_endpoint: `${issuer}/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: [SCOPE],
  };
}

export function protectedResourceMetadata(
  resource: string,
  issuer: string,
): Record<string, unknown> {
  return {
    resource,
    authorization_servers: [issuer],
    scopes_supported: [SCOPE],
  };
}

// Dynamic Client Registration (RFC 7591). Public PKCE clients need no secret, so
// registration is stateless: hand back a client id and echo the metadata. The
// authorization is enforced by PKCE + the signed consent, not by the client id.
export function registerClient(
  body: Record<string, unknown>,
): Record<string, unknown> {
  const redirectUris = Array.isArray(body.redirect_uris)
    ? (body.redirect_uris as string[])
    : [];
  return {
    client_id: `cortex-${randomUUID()}`,
    client_id_issued_at: nowSec(),
    redirect_uris: redirectUris,
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    client_name:
      typeof body.client_name === "string" ? body.client_name : "MCP Client",
  };
}

// Mint an authorization code (a short-lived JWT) once the user's Sui signature is
// verified during consent. The code carries the user context + the PKCE challenge.
export function mintAuthCode(
  secret: string,
  user: UserContext,
  codeChallenge: string,
  redirectUri: string,
): string {
  return mintJwt(
    secret,
    {
      typ: "code",
      sub: user.address,
      ns: user.namespace,
      acct: user.memwalAccountId,
      cid: user.connectionId,
      cc: codeChallenge,
      ru: redirectUri,
    },
    CODE_TTL_SEC,
  );
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: "Bearer";
  expires_in: number;
  scope: string;
}

function accessTokens(secret: string, user: UserContext): TokenResponse {
  const claims = {
    sub: user.address,
    ns: user.namespace,
    acct: user.memwalAccountId,
    cid: user.connectionId,
  };
  return {
    access_token: mintJwt(secret, { ...claims, typ: "access" }, ACCESS_TTL_SEC),
    refresh_token: mintJwt(
      secret,
      { ...claims, typ: "refresh" },
      REFRESH_TTL_SEC,
    ),
    token_type: "Bearer",
    expires_in: ACCESS_TTL_SEC,
    scope: SCOPE,
  };
}

export interface PersonalTokenResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  scope: string;
}

// Mint a long-lived Bearer the user copies into an MCP client. Caller must have
// already verified the user's Sui signature (verifySuiConsent).
export function personalAccessToken(
  secret: string,
  user: UserContext,
): PersonalTokenResponse {
  const claims = {
    sub: user.address,
    ns: user.namespace,
    acct: user.memwalAccountId,
    cid: user.connectionId,
  };
  return {
    access_token: mintJwt(secret, { ...claims, typ: "access" }, PAT_TTL_SEC),
    token_type: "Bearer",
    expires_in: PAT_TTL_SEC,
    scope: SCOPE,
  };
}

type TokenResult =
  | { ok: true; tokens: TokenResponse }
  | { ok: false; error: string; description: string };

// The /token exchange. Supports authorization_code (with PKCE) and refresh_token.
export function exchangeToken(
  secret: string,
  params: Record<string, string>,
): TokenResult {
  const fail = (error: string, description: string): TokenResult => ({
    ok: false,
    error,
    description,
  });
  const grant = params.grant_type;
  if (grant === "authorization_code") {
    const claims = verifyJwt(secret, params.code ?? "");
    if (!claims || claims.typ !== "code")
      return fail("invalid_grant", "Authorization code is invalid or expired.");
    const verifier = params.code_verifier ?? "";
    if (!verifier || !pkceMatches(verifier, String(claims.cc)))
      return fail("invalid_grant", "PKCE verification failed.");
    if (params.redirect_uri && params.redirect_uri !== claims.ru)
      return fail("invalid_grant", "redirect_uri mismatch.");
    return {
      ok: true,
      tokens: accessTokens(secret, {
        address: String(claims.sub),
        namespace: String(claims.ns),
        memwalAccountId: String(claims.acct),
        connectionId: String(claims.cid ?? ""),
      }),
    };
  }
  if (grant === "refresh_token") {
    const claims = verifyJwt(secret, params.refresh_token ?? "");
    if (!claims || claims.typ !== "refresh")
      return fail("invalid_grant", "Refresh token is invalid or expired.");
    return {
      ok: true,
      tokens: accessTokens(secret, {
        address: String(claims.sub),
        namespace: String(claims.ns),
        memwalAccountId: String(claims.acct),
        connectionId: String(claims.cid ?? ""),
      }),
    };
  }
  return fail("unsupported_grant_type", `Unsupported grant_type: ${grant}.`);
}

// Resolve a Bearer access token to the calling user, or null if missing/invalid.
export function userFromBearer(
  secret: string,
  authorization: string | undefined,
): UserContext | null {
  const match = /^Bearer (.+)$/.exec(authorization ?? "");
  if (!match || !match[1]) return null;
  const claims = verifyJwt(secret, match[1]);
  if (!claims || claims.typ !== "access") return null;
  return {
    address: String(claims.sub),
    namespace: String(claims.ns),
    memwalAccountId: String(claims.acct),
    connectionId: String(claims.cid ?? ""),
  };
}
