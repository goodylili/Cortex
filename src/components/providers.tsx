"use client";

import type { ReactNode } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { CORTEX_ENV, authEnabled } from "@/lib/cortex/walrus/env";

export function Providers({ children }: { children: ReactNode }) {
  if (!authEnabled()) return <>{children}</>;
  return (
    <PrivyProvider
      appId={CORTEX_ENV.privyAppId}
      config={{
        // No "wallet": Privy only connects external EVM/Solana wallets, never Sui,
        // and the managed embedded wallet already IS the user's Sui wallet.
        loginMethods: [
          "email",
          "sms",
          "google",
          "apple",
          "twitter",
          "discord",
          "github",
          "linkedin",
          "spotify",
          "instagram",
          "tiktok",
          "line",
          "twitch",
          "telegram",
          "passkey",
        ],
        appearance: { theme: "light" },
        embeddedWallets: {
          ethereum: { createOnLogin: "off" },
          solana: { createOnLogin: "off" },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
