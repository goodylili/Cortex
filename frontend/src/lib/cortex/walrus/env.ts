// Browser-side configuration for the live Walrus/Seal/Sui/MemWal path. Read from
// NEXT_PUBLIC_* env (statically inlined by Next). The app runs fully on the local
// mock store with none of these set; these wire the live, signed-in path.

"use client";

export type CortexNetwork = "testnet" | "mainnet";

const DEFAULT_RPC: Record<CortexNetwork, string> = {
  testnet: "https://fullnode.testnet.sui.io:443",
  mainnet: "https://fullnode.mainnet.sui.io:443",
};
const DEFAULT_GRAPHQL: Record<CortexNetwork, string> = {
  testnet: "https://graphql.testnet.sui.io/graphql",
  mainnet: "https://graphql.mainnet.sui.io/graphql",
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
const DEFAULT_WAL_COIN_TYPE: Record<CortexNetwork, string> = {
  testnet:
    "0x8270feb7375eee355e64fdb69c50abb6b5f9393a722883c1cf45f8e26048810a::wal::WAL",
  mainnet:
    "0x356a26eb9e012a68958082340d4c4116e7f55615cf27affcff209cf0ae544f59::wal::WAL",
};
const SUI_COIN_TYPE = "0x2::sui::SUI";
const DEFAULT_SUINS_PARENT = "cortex.sui";

export interface CortexEnv {
  privyAppId: string;
  network: CortexNetwork;
  suiRpc: string;
  suiGraphql: string;
  packageId: string;
  registryId: string;
  accessRegistryId: string;
  executorCapId: string;
  mcpAddress: string;
  mcpMemwalPubkey: string;
  walrusEpochs: number;
  walrusUploadRelay: string;
  walrusAggregator: string;
  suiCoinType: string;
  walCoinType: string;
  seal: { serverObjectIds: string[]; threshold: number };
  memwal: { serverUrl: string; packageId: string; registryId: string };
  suinsParent: string;
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
  suiGraphql: process.env.NEXT_PUBLIC_SUI_GRAPHQL ?? DEFAULT_GRAPHQL[network],
  packageId: process.env.NEXT_PUBLIC_CORTEX_PACKAGE_ID ?? "",
  registryId: process.env.NEXT_PUBLIC_CORTEX_REGISTRY_ID ?? "",
  accessRegistryId: process.env.NEXT_PUBLIC_CORTEX_ACCESS_REGISTRY ?? "",
  executorCapId: process.env.NEXT_PUBLIC_CORTEX_EXECUTOR_CAP ?? "",
  mcpAddress: process.env.NEXT_PUBLIC_CORTEX_MCP_ADDRESS ?? "",
  mcpMemwalPubkey: process.env.NEXT_PUBLIC_CORTEX_MCP_MEMWAL_PUBKEY ?? "",
  walrusEpochs: parseIntOr(
    process.env.NEXT_PUBLIC_WALRUS_EPOCHS,
    DEFAULT_WALRUS_EPOCHS,
  ),
  walrusUploadRelay:
    process.env.NEXT_PUBLIC_WALRUS_UPLOAD_RELAY ??
    DEFAULT_UPLOAD_RELAY[network],
  walrusAggregator:
    process.env.NEXT_PUBLIC_WALRUS_AGGREGATOR ?? DEFAULT_AGGREGATOR[network],
  suiCoinType: SUI_COIN_TYPE,
  walCoinType:
    process.env.NEXT_PUBLIC_WAL_COIN_TYPE ?? DEFAULT_WAL_COIN_TYPE[network],
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
  suinsParent:
    process.env.NEXT_PUBLIC_CORTEX_SUINS_PARENT ?? DEFAULT_SUINS_PARENT,
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

// SuiNS username claiming/resolution is available whenever a parent domain is set.
export function suinsEnabled(): boolean {
  return CORTEX_ENV.suinsParent.length > 0;
}
