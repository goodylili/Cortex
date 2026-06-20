// Durable, owned, cross-device state on Walrus + Sui. Any JSON state (a chat
// session, the activity timeline, the document index) is encrypted client-side,
// uploaded to Walrus via the fast relay, and its blob id recorded on Sui in the
// Account's settings (account::set_setting). The local cache stays the instant
// source of truth; this is the durable copy. One setting key per artifact.
//
// New blobs are prefixed with a 1-byte format tag: SEAL_TAG for owner-only Seal
// encryption (used when key servers are configured) or AES_TAG for the legacy
// wallet-derived AES-GCM path. Blobs written before tagging existed carry no tag
// (raw iv|ct) and are read as legacy AES for backward compatibility.

"use client";

import { Transaction } from "@mysten/sui/transactions";
import { SUI_CLOCK_OBJECT_ID } from "@mysten/sui/utils";
import { CORTEX_ENV, sealEnabled } from "./env";
import { getSuiClient, getWalrusClient } from "./clients";
import { objectJson } from "./graphql";
import { sealDecrypt, sealEncrypt } from "./seal";
import type { PrivySuiSigner } from "./signer";

const KEY_LABEL = "cortex:session-key:v1";
const IV_BYTES = 12;
const AES_TAG = 0x01;
const SEAL_TAG = 0x02;

export const TIMELINE_KEY = "events:current";
export const DOCUMENTS_KEY = "docs:current";
export const SESSIONS_KEY = "sessions:index";

export interface SessionMeta {
  id: string;
  title: string;
  updatedAt: number;
  blobId?: string;
}

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

async function aesEncrypt(
  signer: PrivySuiSigner,
  plaintext: string,
): Promise<Uint8Array> {
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

async function aesDecrypt(
  signer: PrivySuiSigner,
  body: Uint8Array,
): Promise<string> {
  const key = await deriveKey(signer);
  const iv = body.slice(0, IV_BYTES);
  const ct = body.slice(IV_BYTES);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(pt);
}

function tagged(tag: number, body: Uint8Array): Uint8Array {
  const out = new Uint8Array(1 + body.length);
  out[0] = tag;
  out.set(body, 1);
  return out;
}

async function encrypt(
  signer: PrivySuiSigner,
  plaintext: string,
): Promise<Uint8Array> {
  if (sealEnabled()) {
    return tagged(SEAL_TAG, await sealEncrypt(signer, plaintext));
  }
  return tagged(AES_TAG, await aesEncrypt(signer, plaintext));
}

async function decrypt(
  signer: PrivySuiSigner,
  blob: Uint8Array,
): Promise<string> {
  if (blob[0] === SEAL_TAG) return sealDecrypt(signer, blob.slice(1));
  if (blob[0] === AES_TAG) return aesDecrypt(signer, blob.slice(1));
  return aesDecrypt(signer, blob);
}

// Encrypt + upload arbitrary JSON to Walrus, returning its blob id.
export async function putBlob(
  signer: PrivySuiSigner,
  data: unknown,
): Promise<string> {
  const sealed = await encrypt(signer, JSON.stringify(data));
  const { blobId } = await getWalrusClient().writeBlob({
    blob: sealed,
    deletable: true,
    epochs: CORTEX_ENV.walrusEpochs,
    signer,
  });
  return blobId;
}

export async function getBlob(
  signer: PrivySuiSigner,
  blobId: string,
): Promise<unknown | null> {
  try {
    const blob = await getWalrusClient().readBlob({ blobId });
    return JSON.parse(await decrypt(signer, blob));
  } catch {
    return null;
  }
}

// Record a key -> value pointer in the Account's on-chain settings.
async function setPointer(
  signer: PrivySuiSigner,
  accountId: string,
  key: string,
  value: string,
): Promise<void> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CORTEX_ENV.packageId}::account::set_setting`,
    arguments: [
      tx.object(accountId),
      tx.pure.string(key),
      tx.pure.string(value),
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
  });
  await signer.signAndExecuteTransaction({
    transaction: tx,
    client: getSuiClient(),
  });
}

interface SettingsJson {
  settings?: { contents?: { key?: string; value?: string }[] };
}

async function getSetting(
  accountId: string,
  key: string,
): Promise<string | null> {
  const json = (await objectJson(accountId)) as SettingsJson | null;
  for (const entry of json?.settings?.contents ?? []) {
    if (entry.key === key) return entry.value ?? null;
  }
  return null;
}

// A plain (unencrypted) on-chain setting value  -  used for non-secret pointers like
// the user's Workspace object id, which is just a public object reference.
export async function saveSettingValue(
  signer: PrivySuiSigner,
  accountId: string,
  key: string,
  value: string,
): Promise<void> {
  await setPointer(signer, accountId, key, value);
}

export async function loadSettingValue(
  accountId: string,
  key: string,
): Promise<string | null> {
  return getSetting(accountId, key);
}

// Generic single-artifact save/load (used for timeline + documents).
export async function saveState(
  signer: PrivySuiSigner,
  accountId: string,
  key: string,
  data: unknown,
): Promise<void> {
  const blobId = await putBlob(signer, data);
  await setPointer(signer, accountId, key, blobId);
}

export async function loadState(
  signer: PrivySuiSigner,
  accountId: string,
  key: string,
): Promise<unknown | null> {
  const blobId = await getSetting(accountId, key);
  if (!blobId) return null;
  return getBlob(signer, blobId);
}

// Multi-session: a single index setting holds metadata + each session's blob id.
export async function listSessions(accountId: string): Promise<SessionMeta[]> {
  const raw = await getSetting(accountId, SESSIONS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as SessionMeta[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveSession(
  signer: PrivySuiSigner,
  accountId: string,
  meta: SessionMeta,
  chat: unknown,
): Promise<SessionMeta[]> {
  const blobId = await putBlob(signer, chat);
  const current = await listSessions(accountId);
  const next: SessionMeta = { ...meta, blobId };
  const merged = [next, ...current.filter((s) => s.id !== meta.id)].sort(
    (a, b) => b.updatedAt - a.updatedAt,
  );
  await setPointer(signer, accountId, SESSIONS_KEY, JSON.stringify(merged));
  return merged;
}

export async function loadSession(
  signer: PrivySuiSigner,
  blobId: string,
): Promise<unknown | null> {
  return getBlob(signer, blobId);
}
