// Browser-side configuration for the live Walrus/Seal/Sui/MemWal path. Read from
// NEXT_PUBLIC_* env (statically inlined by Next). The app runs fully on the local
// mock store with none of these set; these wire the live, signed-in path.

"use client";

export type CortexNetwork = "testnet" | "mainnet";

const DEFAULT_RPC: Record<CortexNetwork, string> = {
  testnet: "https://fullnode.testnet.sui.io:443",
  mainnet: "https://fullnode.mainnet.sui.io:443",
};
const DEFAULT_WALRUS_EPOCHS = 5;
const DEFAULT_SEAL_THRESHOLD = 1;
const DEFAULT_MEMWAL_SERVER = "https://relayer.memwal.ai";
const DEFAULT_UPLOAD_RELAY: Record<CortexNetwork, string> = {
  testnet: "https://upload-relay.testnet.walrus.space",
  mainnet: "https://upload-relay.mainnet.walrus.space",
};
const DEFAULT_AGGREGATOR: Record<CortexNetwork, string> = {
  testnet: "https://aggregator.walrus-testnet.walrus.space",
  mainnet: "https://aggregator.walrus-mainnet.walrus.space",
};

export interface CortexEnv {
  privyAppId: string;
  network: CortexNetwork;
  suiRpc: string;
  packageId: string;
  registryId: string;
  walrusEpochs: number;
  walrusUploadRelay: string;
  walrusAggregator: string;
  seal: { serverObjectIds: string[]; threshold: number };
  memwal: { serverUrl: string; packageId: string; registryId: string };
}

function parseNetwork(value: string | undefined): CortexNetwork {
  return value === "mainnet" ? "mainnet" : "testnet";
}

function parseIntOr(value: string | undefined, fallback: number): number {
  const n = value ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const network = parseNetwork(process.env.NEXT_PUBLIC_SUI_NETWORK);

export const CORTEX_ENV: CortexEnv = {
  privyAppId: process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "",
  network,
  suiRpc: process.env.NEXT_PUBLIC_SUI_RPC ?? DEFAULT_RPC[network],
  packageId: process.env.NEXT_PUBLIC_CORTEX_PACKAGE_ID ?? "",
  registryId: process.env.NEXT_PUBLIC_CORTEX_REGISTRY_ID ?? "",
  walrusEpochs: parseIntOr(
    process.env.NEXT_PUBLIC_WALRUS_EPOCHS,
    DEFAULT_WALRUS_EPOCHS,
  ),
  walrusUploadRelay:
    process.env.NEXT_PUBLIC_WALRUS_UPLOAD_RELAY ?? DEFAULT_UPLOAD_RELAY[network],
  walrusAggregator:
    process.env.NEXT_PUBLIC_WALRUS_AGGREGATOR ?? DEFAULT_AGGREGATOR[network],
  seal: {
    serverObjectIds: parseList(process.env.NEXT_PUBLIC_SEAL_SERVER_IDS),
    threshold: parseIntOr(
      process.env.NEXT_PUBLIC_SEAL_THRESHOLD,
      DEFAULT_SEAL_THRESHOLD,
    ),
  },
  memwal: {
    serverUrl:
      process.env.NEXT_PUBLIC_MEMWAL_SERVER_URL ?? DEFAULT_MEMWAL_SERVER,
    packageId: process.env.NEXT_PUBLIC_MEMWAL_PACKAGE_ID ?? "",
    registryId: process.env.NEXT_PUBLIC_MEMWAL_REGISTRY_ID ?? "",
  },
};

// Privy login is available whenever an app id is set.
export function authEnabled(): boolean {
  return CORTEX_ENV.privyAppId.length > 0;
}

// Recording files as on-chain KbFile objects needs the deployed cortex package.
export function contractsEnabled(): boolean {
  return CORTEX_ENV.packageId.length > 0 && CORTEX_ENV.registryId.length > 0;
}

// Seal encryption is used only when key servers are configured.
export function sealEnabled(): boolean {
  return CORTEX_ENV.seal.serverObjectIds.length > 0;
}

// Walrus Memory can be auto-provisioned only when its contract ids are configured.
export function memoryConfigured(): boolean {
  return (
    CORTEX_ENV.memwal.packageId.length > 0 &&
    CORTEX_ENV.memwal.registryId.length > 0
  );
}
