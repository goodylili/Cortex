// A global notice that, on testnet, the executor wallet sponsors every user
// transaction (gas + Walrus storage), so users never need SUI or WAL. Rendered at
// the very top of every page from the root layout. Testnet-only and dismissible;
// the dismissal is remembered so it does not nag on every navigation.

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
        padding: "10px 44px",
        textAlign: "center",
        fontSize: 14,
        fontWeight: 600,
        color: "#fff",
        background: "linear-gradient(90deg, #00a8ff 0%, #6c47ff 100%)",
        zIndex: 1000,
      }}
    >
      All transactions are sponsored on testnet, no gas required.
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
          color: "#fff",
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
