import type { CustomModel } from "./byok";

const VAULT_STORAGE_KEY = "cortex-byok-vault";
const VAULT_VERSION = 1;
const IDB_NAME = "cortex-byok";
const IDB_STORE = "kek";
const DEVICE_KEY_ID = "device-master";
const CIPHER = "AES-GCM";
const KEY_BITS = 256;
const IV_BYTES = 12;
const PRF_SALT_LABEL = "cortex-byok-prf-v1";
const PASSKEY_LABEL = "Cortex API keys";
const PASSKEY_USER = "cortex-byok";
const ES256 = -7;
const RS256 = -257;

interface PasskeyRef {
  credentialId: string;
}

interface StoredVault {
  version: number;
  models: CustomModel[];
  secrets: Record<string, string>;
  passkey?: PasskeyRef;
}

const emptyVault = (): StoredVault => ({
  version: VAULT_VERSION,
  models: [],
  secrets: {},
});

export const loadVault = (): StoredVault => {
  if (typeof localStorage === "undefined") return emptyVault();
  const raw = localStorage.getItem(VAULT_STORAGE_KEY);
  if (!raw) return emptyVault();
  try {
    const parsed = JSON.parse(raw) as StoredVault;
    return { ...emptyVault(), ...parsed };
  } catch {
    return emptyVault();
  }
};

const saveVault = (v: StoredVault) => {
  localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(v));
};

export const passkeySupported = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.PublicKeyCredential !== "undefined";

export const passkeyEnrolled = (): boolean => !!loadVault().passkey;

const bufToB64 = (buf: ArrayBuffer): string =>
  btoa(String.fromCharCode(...new Uint8Array(buf)));

const b64ToBytes = (s: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

const randomBytes = (n: number): Uint8Array<ArrayBuffer> =>
  crypto.getRandomValues(new Uint8Array(n));

const idb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const idbRead = async (key: string): Promise<CryptoKey | undefined> => {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(IDB_STORE).objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve(req.result as CryptoKey | undefined);
    req.onerror = () => reject(req.error);
  });
};

const idbWrite = async (key: string, value: CryptoKey): Promise<void> => {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

const deviceKek = async (): Promise<CryptoKey> => {
  const existing = await idbRead(DEVICE_KEY_ID);
  if (existing) return existing;
  const key = await crypto.subtle.generateKey(
    { name: CIPHER, length: KEY_BITS },
    false,
    ["encrypt", "decrypt"],
  );
  await idbWrite(DEVICE_KEY_ID, key);
  return key;
};

const prfSalt = (): Uint8Array<ArrayBuffer> =>
  new Uint8Array(new TextEncoder().encode(PRF_SALT_LABEL));

const prfToKey = (raw: ArrayBuffer): Promise<CryptoKey> =>
  crypto.subtle.importKey("raw", raw, { name: CIPHER }, false, [
    "encrypt",
    "decrypt",
  ]);

const passkeyKek = async (ref: PasskeyRef): Promise<CryptoKey> => {
  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(32),
      allowCredentials: [
        { id: b64ToBytes(ref.credentialId), type: "public-key" },
      ],
      userVerification: "required",
      extensions: { prf: { eval: { first: prfSalt() } } },
    },
  })) as PublicKeyCredential | null;
  if (!assertion) throw new Error("passkey-cancelled");
  const ext = assertion.getClientExtensionResults() as {
    prf?: { results?: { first?: ArrayBuffer } };
  };
  const secret = ext.prf?.results?.first;
  if (!secret) throw new Error("passkey-no-prf");
  return prfToKey(secret);
};

let sessionKek: CryptoKey | null = null;

export const isUnlocked = (): boolean => sessionKek !== null;

export const lockVault = () => {
  sessionKek = null;
};

export const unlockVault = async (): Promise<void> => {
  const vault = loadVault();
  sessionKek = vault.passkey ? await passkeyKek(vault.passkey) : await deviceKek();
};

const ensureKek = async (): Promise<CryptoKey> => {
  if (sessionKek) return sessionKek;
  if (loadVault().passkey) throw new Error("vault-locked");
  sessionKek = await deviceKek();
  return sessionKek;
};

const encryptSecret = async (plain: string): Promise<string> => {
  const kek = await ensureKek();
  const iv = randomBytes(IV_BYTES);
  const ct = await crypto.subtle.encrypt(
    { name: CIPHER, iv },
    kek,
    new TextEncoder().encode(plain),
  );
  const packed = new Uint8Array(iv.length + ct.byteLength);
  packed.set(iv, 0);
  packed.set(new Uint8Array(ct), iv.length);
  return bufToB64(packed.buffer);
};

const decryptSecret = async (blob: string): Promise<string> => {
  const kek = await ensureKek();
  const packed = b64ToBytes(blob);
  const iv = packed.slice(0, IV_BYTES);
  const ct = packed.slice(IV_BYTES);
  const plain = await crypto.subtle.decrypt({ name: CIPHER, iv }, kek, ct);
  return new TextDecoder().decode(plain);
};

export const listModels = (): CustomModel[] => loadVault().models;

export const addModel = async (
  model: CustomModel,
  apiKey: string,
): Promise<void> => {
  const vault = loadVault();
  vault.models = [...vault.models.filter((m) => m.id !== model.id), model];
  vault.secrets[model.id] = await encryptSecret(apiKey);
  saveVault(vault);
};

export const removeModel = (id: string): void => {
  const vault = loadVault();
  vault.models = vault.models.filter((m) => m.id !== id);
  delete vault.secrets[id];
  saveVault(vault);
};

export const decryptKeys = async (): Promise<Record<string, string>> => {
  const vault = loadVault();
  const out: Record<string, string> = {};
  for (const [id, blob] of Object.entries(vault.secrets)) {
    out[id] = await decryptSecret(blob);
  }
  return out;
};

export const enrollPasskey = async (): Promise<void> => {
  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: randomBytes(32),
      rp: { name: PASSKEY_LABEL, id: location.hostname },
      user: {
        id: randomBytes(16),
        name: PASSKEY_USER,
        displayName: PASSKEY_LABEL,
      },
      pubKeyCredParams: [
        { type: "public-key", alg: ES256 },
        { type: "public-key", alg: RS256 },
      ],
      authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
      extensions: { prf: {} },
    },
  })) as PublicKeyCredential | null;
  if (!credential) throw new Error("passkey-cancelled");
  const ext = credential.getClientExtensionResults() as {
    prf?: { enabled?: boolean };
  };
  if (!ext.prf?.enabled) throw new Error("passkey-no-prf");
  const ref: PasskeyRef = { credentialId: bufToB64(credential.rawId) };
  const newKek = await passkeyKek(ref);
  const vault = loadVault();
  const plain = await decryptKeys();
  sessionKek = newKek;
  const secrets: Record<string, string> = {};
  for (const [id, value] of Object.entries(plain)) {
    secrets[id] = await encryptSecret(value);
  }
  vault.secrets = secrets;
  vault.passkey = ref;
  saveVault(vault);
};
