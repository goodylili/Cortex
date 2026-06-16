"use client";

import { authEnabled } from "@/lib/cortex/walrus/env";
import { useCortexWallet } from "@/lib/cortex/use-wallet";
import { CortexApp } from "./cortex-app";

// Auth-enabled builds drop straight into the app in explore mode; sign-in and
// wallet provisioning happen seamlessly from the top-bar profile menu.
function AuthedCortex() {
  const walletState = useCortexWallet();
  return <CortexApp walletState={walletState} />;
}

export function CortexRoot() {
  return authEnabled() ? <AuthedCortex /> : <CortexApp />;
}
