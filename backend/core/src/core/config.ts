// Load config from config/config.yaml (+ env overrides). The deterministic core
// runs with none of it (mock infra); these values wire the live clients.

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";

export type ModelProvider = "anthropic" | "google";

export interface Config {
  namespace: string;
  sui: { rpc: string; network: string };
  walrus: { publisher: string; aggregator: string; epochs: number };
  seal: {
    policyPackage: string;
    policyObject: string;
    serverIds: string[];
    threshold: number;
  };
  memwal: { url: string; key: string; accountId: string };
  delegateKey: string;
  models: {
    provider: ModelProvider;
    chat: string;
    extract: string;
    anthropicApiKey: string;
    googleApiKey: string;
  };
  watch: { paths: string[] };
  webhookUrl: string;
  accessRegistryId: string;
  executorCapId: string;
  workspaceId: string;
  userAddress: string;
}

const DEFAULTS: Config = {
  namespace: "personal",
  sui: { rpc: "https://fullnode.testnet.sui.io", network: "testnet" },
  walrus: {
    publisher: "",
    aggregator: "https://aggregator.walrus-testnet.walrus.space",
    epochs: 5,
  },
  seal: { policyPackage: "", policyObject: "", serverIds: [], threshold: 1 },
  memwal: { url: "", key: "", accountId: "" },
  delegateKey: "",
  models: {
    provider: "anthropic",
    chat: "",
    extract: "",
    anthropicApiKey: "",
    googleApiKey: "",
  },
  watch: { paths: [] },
  webhookUrl: "",
  accessRegistryId: "",
  executorCapId: "",
  workspaceId: "",
  userAddress: "",
};

const PROVIDER_MODELS: Record<ModelProvider, { chat: string; extract: string }> =
  {
    anthropic: { chat: "claude-sonnet-4-6", extract: "claude-sonnet-4-6" },
    google: { chat: "gemini-3-pro", extract: "gemini-2.5-flash" },
  };

function deepMerge<T>(base: T, over: Partial<T> | undefined): T {
  if (!over) return base;
  const out: any = Array.isArray(base) ? [...(base as any)] : { ...base };
  for (const k of Object.keys(over)) {
    const b = (base as any)[k];
    const o = (over as any)[k];
    out[k] =
      o && typeof o === "object" && !Array.isArray(o) && typeof b === "object"
        ? deepMerge(b, o)
        : o;
  }
  return out;
}

export function loadConfig(
  path = resolve(process.cwd(), "config/config.yaml"),
): Config {
  let fromFile: Partial<Config> = {};
  if (existsSync(path)) {
    try {
      fromFile = parse(readFileSync(path, "utf8")) ?? {};
    } catch {
      /* fall back to defaults */
    }
  }
  const cfg = deepMerge(DEFAULTS, fromFile);
  const fileModels = (fromFile.models ?? {}) as Partial<Config["models"]>;
  // env overrides
  if (process.env.CORTEX_NAMESPACE)
    cfg.namespace = process.env.CORTEX_NAMESPACE;
  if (process.env.CORTEX_SUI_RPC) cfg.sui.rpc = process.env.CORTEX_SUI_RPC;
  if (process.env.CORTEX_SUI_NETWORK)
    cfg.sui.network = process.env.CORTEX_SUI_NETWORK;
  if (process.env.CORTEX_WALRUS_PUBLISHER)
    cfg.walrus.publisher = process.env.CORTEX_WALRUS_PUBLISHER;
  if (process.env.CORTEX_WALRUS_AGGREGATOR)
    cfg.walrus.aggregator = process.env.CORTEX_WALRUS_AGGREGATOR;
  if (process.env.CORTEX_WALRUS_EPOCHS) {
    const parsed = Number.parseInt(process.env.CORTEX_WALRUS_EPOCHS, 10);
    if (Number.isFinite(parsed) && parsed > 0) cfg.walrus.epochs = parsed;
  }
  if (process.env.CORTEX_PACKAGE_ID)
    cfg.seal.policyPackage = process.env.CORTEX_PACKAGE_ID;
  if (process.env.CORTEX_SEAL_POLICY_OBJECT)
    cfg.seal.policyObject = process.env.CORTEX_SEAL_POLICY_OBJECT;
  const memwalUrl = process.env.MEMWAL_SERVER_URL || process.env.CORTEX_MEMWAL_URL;
  if (memwalUrl) cfg.memwal.url = memwalUrl;
  if (process.env.MEMWAL_PRIVATE_KEY)
    cfg.memwal.key = process.env.MEMWAL_PRIVATE_KEY;
  if (process.env.MEMWAL_ACCOUNT_ID)
    cfg.memwal.accountId = process.env.MEMWAL_ACCOUNT_ID;
  if (process.env.CORTEX_DELEGATE_KEY)
    cfg.delegateKey = process.env.CORTEX_DELEGATE_KEY;
  if (process.env.ANTHROPIC_API_KEY)
    cfg.models.anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  const googleKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (googleKey) cfg.models.googleApiKey = googleKey;
  // pick the model provider: an explicit choice (env or config) wins, otherwise infer
  // from whichever key is present so a Gemini-only deploy uses Gemini automatically.
  const envProvider = process.env.CORTEX_MODEL_PROVIDER;
  if (envProvider === "anthropic" || envProvider === "google")
    cfg.models.provider = envProvider;
  else if (!fileModels.provider)
    cfg.models.provider = cfg.models.googleApiKey ? "google" : "anthropic";
  // fill model ids from the provider's defaults unless pinned in config
  const fam = PROVIDER_MODELS[cfg.models.provider];
  if (!fileModels.chat) cfg.models.chat = fam.chat;
  if (!fileModels.extract) cfg.models.extract = fam.extract;
  if (process.env.CORTEX_WEBHOOK_URL)
    cfg.webhookUrl = process.env.CORTEX_WEBHOOK_URL;
  if (process.env.CORTEX_WORKSPACE_ID)
    cfg.workspaceId = process.env.CORTEX_WORKSPACE_ID;
  if (process.env.CORTEX_ACCESS_REGISTRY)
    cfg.accessRegistryId = process.env.CORTEX_ACCESS_REGISTRY;
  if (process.env.CORTEX_EXECUTOR_CAP)
    cfg.executorCapId = process.env.CORTEX_EXECUTOR_CAP;
  if (process.env.CORTEX_USER_ADDRESS)
    cfg.userAddress = process.env.CORTEX_USER_ADDRESS;
  if (process.env.SEAL_SERVER_IDS)
    cfg.seal.serverIds = process.env.SEAL_SERVER_IDS.split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  if (process.env.SEAL_THRESHOLD) {
    const parsed = Number.parseInt(process.env.SEAL_THRESHOLD, 10);
    if (Number.isFinite(parsed) && parsed > 0) cfg.seal.threshold = parsed;
  }
  return cfg;
}

/** Which fields are still missing for the live (non-mock) path. */
export function missingForLive(cfg: Config): string[] {
  const need: [string, string][] = [
    ["walrus.publisher", cfg.walrus.publisher],
    ["walrus.aggregator", cfg.walrus.aggregator],
    ["sui.rpc", cfg.sui.rpc],
    ["memwal.url", cfg.memwal.url],
    ["memwal.key", cfg.memwal.key],
    ["memwal.accountId", cfg.memwal.accountId],
    ["delegateKey", cfg.delegateKey],
  ];
  return need.filter(([, v]) => !v).map(([k]) => k);
}

export function isLive(cfg: Config): boolean {
  return missingForLive(cfg).length === 0;
}
