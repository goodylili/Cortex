import type { NextConfig } from "next";

// Optional Privy integrations we don't use (Stripe fiat onramp, Farcaster Solana).
// Aliasing them to false stops webpack from warning about the missing peers.
const PRIVY_OPTIONAL_PEERS = ["@stripe/crypto", "@farcaster/mini-app-solana"];

const nextConfig: NextConfig = {
  images: {
    // The marketing assets ship pre-sized in /public, so Next's optimizer is
    // not needed and would otherwise require a configured loader at runtime.
    unoptimized: true,
  },
  // Turbopack (dev) equivalent of the webpack tweak below: point the optional
  // Privy peers we don't use at an empty module so they resolve cleanly.
  turbopack: {
    resolveAlias: {
      "@stripe/crypto": "./src/lib/empty-module.ts",
      "@farcaster/mini-app-solana": "./src/lib/empty-module.ts",
    },
  },
  webpack: (config) => {
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      (warning: { message?: string }) =>
        PRIVY_OPTIONAL_PEERS.some((peer) =>
          (warning.message ?? "").includes(peer),
        ),
    ];
    return config;
  },
};

export default nextConfig;
