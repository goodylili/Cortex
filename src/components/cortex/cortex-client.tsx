"use client";

import dynamic from "next/dynamic";

// The live path pulls Walrus' wasm and Privy's browser SDK, so the whole tree is
// client-only; SSR/prerender would try to evaluate the wasm and fail.
const CortexShell = dynamic(
  () => import("./cortex-shell").then((m) => m.CortexShell),
  { ssr: false, loading: () => null },
);

export function CortexClient() {
  return <CortexShell />;
}
