"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { Providers } from "@/components/providers";

// The consent UI pulls the wallet -> Walrus wasm + Privy SDK, so render it
// client-only; SSR/prerender would try to evaluate the wasm and fail. Suspense
// covers the useSearchParams() it reads.
const Consent = dynamic(
  () => import("./consent").then((m) => m.Consent),
  { ssr: false, loading: () => null },
);

export function ConnectClient() {
  return (
    <Providers>
      <Suspense fallback={null}>
        <Consent />
      </Suspense>
    </Providers>
  );
}
