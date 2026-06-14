// Durable chat/session history. The session is encrypted client-side with an
// AES-GCM key derived deterministically from the user's wallet (Ed25519 raw-sign
// of a fixed label is deterministic), uploaded to Walrus via the fast relay, and
// its blob id is recorded on Sui in the Account's settings (account::set_setting).
// Local cache stays the source of truth for instant load; this is the durable,
// owned, cross-device copy.

"use client";

import { Transaction } from "@mysten/sui/transactions";
import { SUI_CLOCK_OBJECT_ID } from "@mysten/sui/utils";
import { CORTEX_ENV } from "./env";
import { getSuiClient, getWalrusClient } from "./clients";
import { objectJson } from "./graphql";
import type { PrivySuiSigner } from "./signer";

const SETTING_KEY = "chat:current";
const KEY_LABEL = "cortex:session-key:v1";
const IV_BYTES = 12;

async function deriveKey(signer: PrivySuiSigner): Promise<CryptoKey> {
  const label = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(KEY_LABEL)),
  );
  const sig = await signer.sign(label); // deterministic for a given wallet
  const material = await crypto.subtle.digest("SHA-256", sig);
  return crypto.subtle.importKey("raw", material, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

async function encrypt(signer: PrivySuiSigner, plaintext: string): Promise<Uint8Array> {
  const key = await deriveKey(signer);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(plaintext),
    ),
  );
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0);
  out.set(ct, iv.length);
  return out;
}

async function decrypt(signer: PrivySuiSigner, blob: Uint8Array): Promise<string> {
  const key = await deriveKey(signer);
  const iv = blob.slice(0, IV_BYTES);
  const ct = blob.slice(IV_BYTES);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(pt);
}

// Encrypt the session, store it on Walrus, and record the blob id on chain.
export async function saveHistory(
  signer: PrivySuiSigner,
  accountId: string,
  chat: unknown,
): Promise<string> {
  const sealed = await encrypt(signer, JSON.stringify(chat));
  const { blobId } = await getWalrusClient().writeBlob({
    blob: sealed,
    deletable: true,
    epochs: CORTEX_ENV.walrusEpochs,
    signer,
  });
  const tx = new Transaction();
  tx.moveCall({
    target: `${CORTEX_ENV.packageId}::account::set_setting`,
    arguments: [
      tx.object(accountId),
      tx.pure.string(SETTING_KEY),
      tx.pure.string(blobId),
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
  });
  await signer.signAndExecuteTransaction({ transaction: tx, client: getSuiClient() });
  return blobId;
}

interface SettingsJson {
  settings?: { contents?: { key?: string; value?: string }[] };
}

// Read the recorded blob id from the Account's on-chain settings (VecMap inlines
// in GraphQL JSON as { contents: [{ key, value }] }).
async function currentBlobId(accountId: string): Promise<string | null> {
  const json = (await objectJson(accountId)) as SettingsJson | null;
  for (const entry of json?.settings?.contents ?? []) {
    if (entry.key === SETTING_KEY) return entry.value ?? null;
  }
  return null;
}

// Fetch + decrypt the durable session, or null if none recorded yet.
export async function loadHistory(
  signer: PrivySuiSigner,
  accountId: string,
): Promise<unknown | null> {
  const blobId = await currentBlobId(accountId);
  if (!blobId) return null;
  const blob = await getWalrusClient().readBlob({ blobId });
  try {
    return JSON.parse(await decrypt(signer, blob));
  } catch {
    return null;
  }
}
