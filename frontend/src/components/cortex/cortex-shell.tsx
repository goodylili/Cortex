"use client";

import { Providers } from "@/components/providers";
import { CortexRoot } from "./cortex-root";

export function CortexShell() {
  return (
    <Providers>
      <CortexRoot />
    </Providers>
  );
}
