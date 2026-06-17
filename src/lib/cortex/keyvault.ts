"use client";

const DB_NAME = "cortex.keyvault";
const DB_VERSION = 1;
const META_STORE = "meta";
const KEYS_STORE = "keys";
const CREDENTIAL_RECORD_ID = "credential";
const RP_NAME = "Cortex";
const RP_ID_FALLBACK = "localhost";
const CHALLENGE_BYTES = 32;
const USER_HANDLE_BYTES = 16;
const IV_BYTES = 12;
const HKDF_INFO = "cortex:keyvault:apikeys:v1";
const HKDF_SALT = "cortex:keyvault:hkdf-salt:v1";
const PRF_EVAL_FIRST = "cortex:keyvault:prf:v1";
const AES_KEY_LENGTH_BITS = 256;
const ES256 = -7;
const RS256 = -257;
const TIMEOUT_MS = 60000;

type CredentialRecord = {
  id: string;
  rawId: Uint8Array;
  userHandle: Uint8Array;
  label: string;
};

type StoredKey = {
  iv: Uint8Array;
  ciphertext: Uint8Array;
};

type PrfExtensionResults = {
  prf?: { results?: { first?: ArrayBuffer | Uint8Array } };
};

export class KeyVaultUnsupportedError extends Error {
  constructor(reason: string) {
    super(`Key vault unavailable: ${reason}`);
    this.name = "KeyVaultUnsupportedError";
  }
}

export class KeyVaultLockedError extends Error {
  constructor() {
    super("Key vault is locked; call unlock() with the passkey first");
    this.name = "KeyVaultLockedError";
  }
}

export class KeyVaultNotRegisteredError extends Error {
  constructor() {
    super("No passkey is registered; call registerPasskey() first");
    this.name = "KeyVaultNotRegisteredError";
  }
}

export class KeyVaultPrfError extends Error {
  constructor() {
    super("Passkey did not return a PRF secret; this authenticator cannot back the vault");
    this.name = "KeyVaultPrfError";
  }
}

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function isBrowser(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof indexedDB !== "undefined" &&
    typeof crypto !== "undefined" &&
    typeof crypto.subtle !== "undefined"
  );
}

function hasWebAuthn(): boolean {
  return (
    isBrowser() &&
    typeof navigator !== "undefined" &&
    typeof navigator.credentials !== "undefined" &&
    typeof PublicKeyCredential !== "undefined"
  );
}

function requireBrowser(): void {
  if (!hasWebAuthn())
    throw new KeyVaultUnsupportedError("WebAuthn or WebCrypto is not available in this environment");
}

function rpId(): string {
  return typeof location !== "undefined" && location.hostname
    ? location.hostname
    : RP_ID_FALLBACK;
}

function toBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy.buffer;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE);
      if (!db.objectStoreNames.contains(KEYS_STORE)) db.createObjectStore(KEYS_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB"));
  });
}

function idbGet<T>(store: string, key: string): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const tx = db.transaction(store, "readonly");
        const request = tx.objectStore(store).get(key);
        request.onsuccess = () => resolve(request.result as T | undefined);
        request.onerror = () => reject(request.error ?? new Error("IndexedDB read failed"));
        tx.oncomplete = () => db.close();
      }),
  );
}

function idbPut(store: string, key: string, value: unknown): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(store, "readwrite");
        tx.objectStore(store).put(value, key);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error ?? new Error("IndexedDB write failed"));
      }),
  );
}

function idbDelete(store: string, key: string): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(store, "readwrite");
        tx.objectStore(store).delete(key);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error ?? new Error("IndexedDB delete failed"));
      }),
  );
}

function idbKeys(store: string): Promise<string[]> {
  return openDb().then(
    (db) =>
      new Promise<string[]>((resolve, reject) => {
        const tx = db.transaction(store, "readonly");
        const request = tx.objectStore(store).getAllKeys();
        request.onsuccess = () => resolve(request.result.map((k) => String(k)));
        request.onerror = () => reject(request.error ?? new Error("IndexedDB key scan failed"));
        tx.oncomplete = () => db.close();
      }),
  );
}

let sessionKey: CryptoKey | null = null;

async function loadCredential(): Promise<CredentialRecord | undefined> {
  return idbGet<CredentialRecord>(META_STORE, CREDENTIAL_RECORD_ID);
}

async function deriveAesKey(prfSecret: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey("raw", toBuffer(prfSecret), "HKDF", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new TextEncoder().encode(HKDF_SALT),
      info: new TextEncoder().encode(HKDF_INFO),
    },
    baseKey,
    { name: "AES-GCM", length: AES_KEY_LENGTH_BITS },
    false,
    ["encrypt", "decrypt"],
  );
}

function extractPrfSecret(credential: PublicKeyCredential): Uint8Array {
  const results = credential.getClientExtensionResults() as PrfExtensionResults;
  const first = results.prf?.results?.first;
  if (!first) throw new KeyVaultPrfError();
  return first instanceof Uint8Array ? new Uint8Array(first) : new Uint8Array(first);
}

export async function isSupported(): Promise<boolean> {
  if (!hasWebAuthn()) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export async function isRegistered(): Promise<boolean> {
  if (!isBrowser()) return false;
  try {
    return (await loadCredential()) !== undefined;
  } catch {
    return false;
  }
}

export async function registerPasskey(userLabel: string): Promise<void> {
  requireBrowser();
  const label = userLabel.trim();
  invariant(label.length > 0, "userLabel must not be empty");

  const challenge = crypto.getRandomValues(new Uint8Array(CHALLENGE_BYTES));
  const userHandle = crypto.getRandomValues(new Uint8Array(USER_HANDLE_BYTES));

  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: toBuffer(challenge),
      rp: { name: RP_NAME, id: rpId() },
      user: {
        id: toBuffer(userHandle),
        name: label,
        displayName: label,
      },
      pubKeyCredParams: [
        { type: "public-key", alg: ES256 },
        { type: "public-key", alg: RS256 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        residentKey: "required",
        userVerification: "required",
      },
      timeout: TIMEOUT_MS,
      extensions: { prf: {} } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;

  invariant(credential, "Authenticator did not return a credential");

  const record: CredentialRecord = {
    id: credential.id,
    rawId: new Uint8Array(credential.rawId),
    userHandle,
    label,
  };
  await idbPut(META_STORE, CREDENTIAL_RECORD_ID, record);
}

export async function unlock(): Promise<void> {
  requireBrowser();
  const record = await loadCredential();
  if (!record) throw new KeyVaultNotRegisteredError();

  const challenge = crypto.getRandomValues(new Uint8Array(CHALLENGE_BYTES));
  const prfInput = new TextEncoder().encode(PRF_EVAL_FIRST);

  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: toBuffer(challenge),
      rpId: rpId(),
      allowCredentials: [{ type: "public-key", id: toBuffer(record.rawId) }],
      userVerification: "required",
      timeout: TIMEOUT_MS,
      extensions: {
        prf: { eval: { first: toBuffer(prfInput) } },
      } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;

  invariant(assertion, "Authenticator did not return an assertion");
  const prfSecret = extractPrfSecret(assertion);
  sessionKey = await deriveAesKey(prfSecret);
  prfSecret.fill(0);
}

export function lock(): void {
  sessionKey = null;
}

export function isUnlocked(): boolean {
  return sessionKey !== null;
}

function requireUnlocked(): CryptoKey {
  if (!sessionKey) throw new KeyVaultLockedError();
  return sessionKey;
}

export async function setKey(provider: string, apiKey: string): Promise<void> {
  requireBrowser();
  const key = requireUnlocked();
  const name = provider.trim();
  invariant(name.length > 0, "provider must not be empty");
  invariant(apiKey.length > 0, "apiKey must not be empty");

  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(apiKey),
    ),
  );
  const record: StoredKey = { iv, ciphertext };
  await idbPut(KEYS_STORE, name, record);
}

export async function getKey(provider: string): Promise<string | null> {
  requireBrowser();
  const key = requireUnlocked();
  const name = provider.trim();
  invariant(name.length > 0, "provider must not be empty");

  const record = await idbGet<StoredKey>(KEYS_STORE, name);
  if (!record) return null;
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toBuffer(record.iv) },
    key,
    toBuffer(record.ciphertext),
  );
  return new TextDecoder().decode(plaintext);
}

export async function listProviders(): Promise<string[]> {
  if (!isBrowser()) return [];
  return idbKeys(KEYS_STORE);
}

export async function removeKey(provider: string): Promise<void> {
  requireBrowser();
  const name = provider.trim();
  invariant(name.length > 0, "provider must not be empty");
  await idbDelete(KEYS_STORE, name);
}
