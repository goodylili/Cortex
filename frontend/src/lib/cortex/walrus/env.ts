// Browser-side configuration for the live Walrus/Seal/Sui/MemWal path. Read from
// NEXT_PUBLIC_* env (statically inlined by Next). The app runs fully on the local
// mock store with none of these set; these wire the live, signed-in path.
//
// Dual-network: most values exist per network as _MAINNET / _TESTNET slots; the
// reused wallets (MCP delegate address) are network-agnostic. Next only inlines
// process.env.NEXT_PUBLIC_* for STATIC literal keys, so each slot is referenced
// explicitly below (no dynamic key access). cortexEnvFor(network) returns the
// resolved config for a network; networkAvailable(network) drives the UI's
// network picker (a network shows "coming soon" until fully configured).

"use client";

export type CortexNetwork = "testnet" | "mainnet";
export const CORTEX_NETWORKS: CortexNetwork[] = ["testnet", "mainnet"];

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
  workspaceId: string;
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

// Network-agnostic (reused on both networks).
const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";
const MCP_ADDRESS = process.env.NEXT_PUBLIC_CORTEX_MCP_ADDRESS ?? "";
const WALRUS_EPOCHS = parseIntOr(
  process.env.NEXT_PUBLIC_WALRUS_EPOCHS,
  DEFAULT_WALRUS_EPOCHS,
);

// Per-network raw slots. Each key is a STATIC literal so Next inlines it.
interface NetSlots {
  packageId?: string;
  registryId?: string;
  accessRegistryId?: string;
  executorCapId?: string;
  mcpMemwalPubkey?: string;
  memwalServerUrl?: string;
  memwalPackageId?: string;
  memwalRegistryId?: string;
  sealServerIds?: string;
  sealThreshold?: string;
  suinsParent?: string;
}

const SLOTS: Record<CortexNetwork, NetSlots> = {
  mainnet: {
    packageId: process.env.NEXT_PUBLIC_CORTEX_PACKAGE_ID_MAINNET,
    registryId: process.env.NEXT_PUBLIC_CORTEX_REGISTRY_ID_MAINNET,
    accessRegistryId: process.env.NEXT_PUBLIC_CORTEX_ACCESS_REGISTRY_MAINNET,
    executorCapId: process.env.NEXT_PUBLIC_CORTEX_EXECUTOR_CAP_MAINNET,
    mcpMemwalPubkey: process.env.NEXT_PUBLIC_CORTEX_MCP_MEMWAL_PUBKEY_MAINNET,
    memwalServerUrl: process.env.NEXT_PUBLIC_MEMWAL_SERVER_URL_MAINNET,
    memwalPackageId: process.env.NEXT_PUBLIC_MEMWAL_PACKAGE_ID_MAINNET,
    memwalRegistryId: process.env.NEXT_PUBLIC_MEMWAL_REGISTRY_ID_MAINNET,
    sealServerIds: process.env.NEXT_PUBLIC_SEAL_SERVER_IDS_MAINNET,
    sealThreshold: process.env.NEXT_PUBLIC_SEAL_THRESHOLD_MAINNET,
    suinsParent: process.env.NEXT_PUBLIC_CORTEX_SUINS_PARENT_MAINNET,
  },
  testnet: {
    packageId: process.env.NEXT_PUBLIC_CORTEX_PACKAGE_ID_TESTNET,
    registryId: process.env.NEXT_PUBLIC_CORTEX_REGISTRY_ID_TESTNET,
    accessRegistryId: process.env.NEXT_PUBLIC_CORTEX_ACCESS_REGISTRY_TESTNET,
    executorCapId: process.env.NEXT_PUBLIC_CORTEX_EXECUTOR_CAP_TESTNET,
    mcpMemwalPubkey: process.env.NEXT_PUBLIC_CORTEX_MCP_MEMWAL_PUBKEY_TESTNET,
    memwalServerUrl: process.env.NEXT_PUBLIC_MEMWAL_SERVER_URL_TESTNET,
    memwalPackageId: process.env.NEXT_PUBLIC_MEMWAL_PACKAGE_ID_TESTNET,
    memwalRegistryId: process.env.NEXT_PUBLIC_MEMWAL_REGISTRY_ID_TESTNET,
    sealServerIds: process.env.NEXT_PUBLIC_SEAL_SERVER_IDS_TESTNET,
    sealThreshold: process.env.NEXT_PUBLIC_SEAL_THRESHOLD_TESTNET,
    suinsParent: process.env.NEXT_PUBLIC_CORTEX_SUINS_PARENT_TESTNET,
  },
};

function buildEnv(network: CortexNetwork): CortexEnv {
  const s = SLOTS[network];
  return {
    privyAppId: PRIVY_APP_ID,
    network,
    suiRpc: DEFAULT_RPC[network],
    suiGraphql: DEFAULT_GRAPHQL[network],
    packageId: s.packageId ?? "",
    registryId: s.registryId ?? "",
    accessRegistryId: s.accessRegistryId ?? "",
    executorCapId: s.executorCapId ?? "",
    workspaceId: "",
    mcpAddress: MCP_ADDRESS,
    mcpMemwalPubkey: s.mcpMemwalPubkey ?? "",
    walrusEpochs: WALRUS_EPOCHS,
    walrusUploadRelay: DEFAULT_UPLOAD_RELAY[network],
    walrusAggregator: DEFAULT_AGGREGATOR[network],
    suiCoinType: SUI_COIN_TYPE,
    walCoinType: DEFAULT_WAL_COIN_TYPE[network],
    seal: {
      serverObjectIds: parseList(s.sealServerIds),
      threshold: parseIntOr(s.sealThreshold, DEFAULT_SEAL_THRESHOLD),
    },
    memwal: {
      serverUrl: s.memwalServerUrl || DEFAULT_MEMWAL_SERVER,
      packageId: s.memwalPackageId ?? "",
      registryId: s.memwalRegistryId ?? "",
    },
    suinsParent: s.suinsParent || DEFAULT_SUINS_PARENT,
  };
}

const ENV_BY_NETWORK: Record<CortexNetwork, CortexEnv> = {
  mainnet: buildEnv("mainnet"),
  testnet: buildEnv("testnet"),
};

// Resolved config for a given network.
export function cortexEnvFor(network: CortexNetwork): CortexEnv {
  return ENV_BY_NETWORK[network];
}

// A network is offered in the UI once its core live path is in place: contracts +
// access model + Seal key servers. (Walrus Memory and SuiNS are optional add-ons
// that light up when their slots fill.) Seal is included so mainnet stays "coming
// soon" while its paid key server is pending, while testnet (free Seal) is live.
export function networkAvailable(network: CortexNetwork): boolean {
  const e = ENV_BY_NETWORK[network];
  return (
    e.packageId.length > 0 &&
    e.registryId.length > 0 &&
    e.accessRegistryId.length > 0 &&
    e.executorCapId.length > 0 &&
    e.seal.serverObjectIds.length > 0
  );
}

export function availableNetworks(): CortexNetwork[] {
  return CORTEX_NETWORKS.filter(networkAvailable);
}

function parseNetwork(value: string | undefined): CortexNetwork | undefined {
  return value === "mainnet" || value === "testnet" ? value : undefined;
}

// The network the app opens on: a user preference (set from the profile toggle)
// if it's available, else the configured default, else the first available
// network, else the default (mock mode until something is wired).
const DEFAULT_NETWORK: CortexNetwork =
  parseNetwork(process.env.NEXT_PUBLIC_CORTEX_DEFAULT_NETWORK) ?? "testnet";
const NETWORK_PREF_KEY = "cortex-network";

export function setPreferredNetwork(network: CortexNetwork): void {
  try {
    localStorage.setItem(NETWORK_PREF_KEY, network);
  } catch {}
}

function preferredNetwork(): CortexNetwork | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return parseNetwork(localStorage.getItem(NETWORK_PREF_KEY) ?? undefined);
  } catch {
    return undefined;
  }
}

export function defaultNetwork(): CortexNetwork {
  const pref = preferredNetwork();
  if (pref && networkAvailable(pref)) return pref;
  if (networkAvailable(DEFAULT_NETWORK)) return DEFAULT_NETWORK;
  return availableNetworks()[0] ?? DEFAULT_NETWORK;
}

// Active config for the default network. Consumers that need a user-selected
// network at runtime should call cortexEnvFor(selected) instead.
export const CORTEX_ENV: CortexEnv = cortexEnvFor(defaultNetwork());

// Privy login is available whenever an app id is set.
export function authEnabled(): boolean {
  return CORTEX_ENV.privyAppId.length > 0;
}

// Recording files as on-chain KbFile objects needs the deployed cortex package.
export function contractsEnabled(env: CortexEnv = CORTEX_ENV): boolean {
  return env.packageId.length > 0 && env.registryId.length > 0;
}

// Seal encryption is used only when key servers are configured.
export function sealEnabled(env: CortexEnv = CORTEX_ENV): boolean {
  return env.seal.serverObjectIds.length > 0;
}

// Walrus Memory can be auto-provisioned only when its contract ids are configured.
export function memoryConfigured(env: CortexEnv = CORTEX_ENV): boolean {
  return env.memwal.packageId.length > 0 && env.memwal.registryId.length > 0;
}

// SuiNS username claiming/resolution is available whenever a parent domain is set.
export function suinsEnabled(env: CortexEnv = CORTEX_ENV): boolean {
  return env.suinsParent.length > 0;
}
