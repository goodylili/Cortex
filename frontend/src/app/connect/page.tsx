// Managed-OAuth consent page. The MCP server's /authorize redirects here with the
// OAuth request; the user signs in (Privy wallet) and approves once. On approval
// we run the on-chain grant + sign the challenge (wallet.connectMcp), hand the
// proof to the MCP's /oauth/grant, and follow the returned redirect back to the
// client. The wallet stays in the browser; the MCP only ever gets a signature.

"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Providers } from "@/components/providers";
import { useCortexWallet } from "@/lib/cortex/use-wallet";

const PAGE: React.CSSProperties = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  background: "#000000",
  color: "#ffffff",
  padding: 24,
  fontFamily: "var(--sans, system-ui, sans-serif)",
};
const CARD: React.CSSProperties = {
  width: "min(440px, 100%)",
  background: "#0e0e0e",
  border: "1px solid #1f1f1f",
  borderRadius: 16,
  padding: "32px 28px",
  textAlign: "center",
};
const PRIMARY: React.CSSProperties = {
  flex: 1,
  padding: "12px 16px",
  borderRadius: 999,
  background: "#ffffff",
  color: "#000000",
  fontWeight: 600,
  fontSize: 15,
  border: "none",
  cursor: "pointer",
};
const GHOST: React.CSSProperties = {
  flex: 1,
  padding: "12px 16px",
  borderRadius: 999,
  background: "transparent",
  color: "#ffffff",
  fontSize: 15,
  border: "1px solid #2a2a2a",
  cursor: "pointer",
};

// The MCP base is the resource URL with the trailing /mcp stripped, so the grant
// endpoint sits next to it at /oauth/grant.
function mcpBaseFrom(mcp: string): string {
  return mcp.replace(/\/mcp\/?$/, "");
}

function Consent() {
  const params = useSearchParams();
  const { ready, authenticated, provisioning, wallet, login } =
    useCortexWallet();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectUri = params.get("redirect_uri") ?? "";
  const codeChallenge = params.get("code_challenge") ?? "";
  const state = params.get("state") ?? "";
  const mcp = params.get("mcp") ?? "";
  const valid = !!redirectUri && !!codeChallenge && !!mcp;

  async function allow() {
    if (!wallet) return;
    setBusy(true);
    setError(null);
    try {
      const bundle = await wallet.connectMcp(codeChallenge);
      const res = await fetch(`${mcpBaseFrom(mcp)}/oauth/grant`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...bundle,
          code_challenge: codeChallenge,
          redirect_uri: redirectUri,
          state,
        }),
      });
      if (!res.ok) throw new Error(`Authorization failed (${res.status})`);
      const { redirect } = (await res.json()) as { redirect: string };
      window.location.href = redirect;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  function cancel() {
    const url = new URL(redirectUri);
    url.searchParams.set("error", "access_denied");
    if (state) url.searchParams.set("state", state);
    window.location.href = url.toString();
  }

  const mark = (
    <img
      src="/cortex-mark.svg"
      alt="Cortex"
      width={40}
      height={40}
      style={{ margin: "0 auto 18px", display: "block", color: "#ffffff" }}
    />
  );

  let body: React.ReactNode;
  if (!valid) {
    body = (
      <p style={{ color: "#a1a1a1", fontSize: 15 }}>
        This authorization link is invalid or incomplete. Start the connection
        again from your MCP client.
      </p>
    );
  } else if (!ready || provisioning) {
    body = <p style={{ color: "#a1a1a1", fontSize: 15 }}>Loading...</p>;
  } else if (!authenticated || !wallet) {
    body = (
      <>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: "0 0 8px" }}>
          Connect Claude to Cortex
        </h1>
        <p style={{ color: "#a1a1a1", fontSize: 15, margin: "0 0 22px" }}>
          Sign in to connect Claude to your sovereign memory on the Sui stack.
        </p>
        <button style={PRIMARY} onClick={login}>
          Sign in
        </button>
      </>
    );
  } else {
    body = (
      <>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: "0 0 8px" }}>
          Allow Claude to connect?
        </h1>
        <p style={{ color: "#a1a1a1", fontSize: 15, margin: "0 0 22px" }}>
          Claude will be able to read and write your Cortex memories on your
          behalf. You can revoke this anytime from Settings.
        </p>
        {error && (
          <p style={{ color: "#ff6b6b", fontSize: 13, margin: "0 0 14px" }}>
            {error}
          </p>
        )}
        <div style={{ display: "flex", gap: 10 }}>
          <button style={GHOST} onClick={cancel} disabled={busy}>
            Cancel
          </button>
          <button style={PRIMARY} onClick={allow} disabled={busy}>
            {busy ? "Connecting..." : "Allow"}
          </button>
        </div>
      </>
    );
  }

  return (
    <div style={PAGE}>
      <div style={CARD}>
        {mark}
        {body}
      </div>
    </div>
  );
}

export default function ConnectPage() {
  return (
    <Providers>
      <Consent />
    </Providers>
  );
}
