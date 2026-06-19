// Load config from config/config.yaml (+ env overrides). The deterministic core
// runs with none of it (mock infra); these values wire the live clients.

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";

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
  memwal: { url: string; apiKey: string };
  delegateKey: string;
  models: { chat: string; extract: string; anthropicApiKey: string };
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
  memwal: { url: "", apiKey: "" },
  delegateKey: "",
  models: {
    chat: "claude-sonnet-4-6",
    extract: "claude-sonnet-4-6",
    anthropicApiKey: "",
  },
  watch: { paths: [] },
  webhookUrl: "",
  accessRegistryId: "",
  executorCapId: "",
  workspaceId: "",
  userAddress: "",
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
  // env overrides for secrets
  if (process.env.CORTEX_DELEGATE_KEY)
    cfg.delegateKey = process.env.CORTEX_DELEGATE_KEY;
  if (process.env.MEMWAL_API_KEY)
    cfg.memwal.apiKey = process.env.MEMWAL_API_KEY;
  if (process.env.ANTHROPIC_API_KEY)
    cfg.models.anthropicApiKey = process.env.ANTHROPIC_API_KEY;
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
    ["memwal.apiKey", cfg.memwal.apiKey],
    ["delegateKey", cfg.delegateKey],
  ];
  return need.filter(([, v]) => !v).map(([k]) => k);
}

export function isLive(cfg: Config): boolean {
  return missingForLive(cfg).length === 0;
}
