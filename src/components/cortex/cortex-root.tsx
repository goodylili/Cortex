"use client";

import { useState } from "react";
import { authEnabled } from "@/lib/cortex/walrus/env";
import { useCortexWallet } from "@/lib/cortex/use-wallet";
import { AuthScreen } from "./auth-screen";
import { CortexApp } from "./cortex-app";

function AuthedCortex() {
  const walletState = useCortexWallet();
  const [skipped, setSkipped] = useState(false);

  // Explore-without-account drops into the local mock, same as the unconfigured
  // build, but the user can still sign in later from Settings.
  if (skipped) return <CortexApp />;

  // Gate until there is a usable managed wallet: loading -> sign in -> wallet
  // provisioning -> app.
  if (!walletState.ready || !walletState.authenticated || !walletState.wallet) {
    return <AuthScreen state={walletState} onSkip={() => setSkipped(true)} />;
  }

  return <CortexApp walletState={walletState} />;
}

export function CortexRoot() {
  return authEnabled() ? <AuthedCortex /> : <CortexApp />;
}
