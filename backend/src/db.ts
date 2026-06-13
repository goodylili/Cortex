// The infra bundle + storage helpers. Everything that touches Walrus/Seal/Sui
// goes through here; the rest of the backend depends only on these functions.

import type { Config } from "./config.js";
import type { Artifact } from "./models.js";
import { createWalrus, type WalrusClient } from "./walrus.js";
import { createSeal, type SealHelper } from "./seal.js";
import { createMemWal, type MemWalClient } from "./memwal.js";
import { createSui, type SuiClient } from "./sui.js";
import { decode, encode } from "./crypto.js";

export interface Clients {
  walrus: WalrusClient;
  seal: SealHelper;
  memwal: MemWalClient;
  sui: SuiClient;
  cfg: Config;
}

export function createClients(cfg: Config): Clients {
  return {
    walrus: createWalrus(cfg),
    seal: createSeal(cfg),
    memwal: createMemWal(cfg),
    sui: createSui(cfg),
    cfg,
  };
}

/** encode -> Seal-encrypt -> Walrus write. */
export async function putArtifact(
  c: Clients,
  artifact: Artifact,
): Promise<string> {
  const sealed = await c.seal.encrypt(encode(artifact));
  return c.walrus.putBlob(sealed);
}

/** Walrus read -> Seal-decrypt -> decode (kind-checked). */
export async function getArtifact<T extends Artifact = Artifact>(
  c: Clients,
  blobId: string,
  kind?: T["kind"],
): Promise<T> {
  const sealed = await c.walrus.getBlob(blobId);
  const bytes = await c.seal.decrypt(sealed);
  return decode<T>(bytes, kind);
}

/** Raw fetch straight from Walrus — the independence/verify check (no decrypt). */
export async function fetchRaw(
  c: Clients,
  blobId: string,
): Promise<Uint8Array> {
  return c.walrus.getBlob(blobId);
}
