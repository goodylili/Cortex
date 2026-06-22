// A global notice that, on testnet, each wallet pays for its own writes (gas +
// Walrus storage), so users fund themselves from the suilearn faucet. The executor
// tops wallets up when it can, but that is best effort; the faucet is the reliable
// path and the fallback when the executor runs dry. Rendered at the very top of
// every page from the root layout. Testnet-only and dismissible; the dismissal is
// remembered so it does not nag on every navigation.

"use client";

import { useEffect, useState } from "react";
import { CORTEX_ENV } from "@/lib/cortex/walrus/env";

const DISMISS_KEY = "cortex-sponsor-banner";

export function SponsoredBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (CORTEX_ENV.network !== "testnet") return;
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {}
    setShow(true);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    setShow(false);
  };

  return (
    <div
      role="status"
      style={{
        position: "relative",
        width: "100%",
        padding: "10px 38px",
        textAlign: "center",
        fontSize: "clamp(12px, 3.4vw, 14px)",
        lineHeight: 1.45,
        fontWeight: 600,
        color: "var(--paper, var(--canvas, #000))",
        background: "var(--ink)",
        zIndex: 1000,
      }}
    >
      Cortex is currently on Testnet. Please head to your profile, copy your
      address, and request WAL and SUI test tokens at{" "}
      <a
        href="https://faucet.suilearn.io"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          color: "var(--paper, var(--canvas, #000))",
          textDecoration: "underline",
        }}
      >
        faucet.suilearn.io
      </a>
      .
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        style={{
          position: "absolute",
          right: 12,
          top: "50%",
          transform: "translateY(-50%)",
          background: "transparent",
          border: "none",
          color: "var(--paper, var(--canvas, #000))",
          fontSize: 18,
          lineHeight: 1,
          cursor: "pointer",
          opacity: 0.85,
        }}
      >
        ×
      </button>
    </div>
  );
}
