// Owner-only Seal encryption for durable Walrus blobs. The Seal identity is the
// user's own 32-byte wallet address (plus a fixed resource scope), which the
// cortex::private::seal_approve policy checks: only the wallet whose address
// prefixes the identity can fetch the decryption keys. Encryption happens
// client-side via the configured Seal key servers; decryption signs a SessionKey
// with the Privy wallet and proves access through a seal_approve dry-run.

"use client";

import { SessionKey } from "@mysten/seal";
import { Transaction } from "@mysten/sui/transactions";
import { fromHex, toHex } from "@mysten/sui/utils";
import { getSealClient, getSuiClient } from "./clients";
import { CORTEX_ENV } from "./env";
import type { PrivySuiSigner } from "./signer";

const SUI_ADDRESS_BYTES = 32;
const RESOURCE_SCOPE = new TextEncoder().encode("cortex:sessions:v1");
const SESSION_TTL_MIN = 10;
const SEAL_APPROVE_TARGET = "private::seal_approve";

function addressBytes(address: string): Uint8Array {
  const bytes = fromHex(address.startsWith("0x") ? address.slice(2) : address);
  if (bytes.length !== SUI_ADDRESS_BYTES) {
    throw new Error(
      `Expected a ${SUI_ADDRESS_BYTES}-byte Sui address, got ${bytes.length} bytes`,
    );
  }
  return bytes;
}

export function buildOwnerIdentity(address: string): Uint8Array {
  const owner = addressBytes(address);
  const identity = new Uint8Array(owner.length + RESOURCE_SCOPE.length);
  identity.set(owner, 0);
  identity.set(RESOURCE_SCOPE, owner.length);
  return identity;
}

export async function sealEncrypt(
  signer: PrivySuiSigner,
  plaintext: string,
): Promise<Uint8Array> {
  const id = toHex(buildOwnerIdentity(signer.toSuiAddress()));
  const { encryptedObject } = await getSealClient().encrypt({
    threshold: CORTEX_ENV.seal.threshold,
    packageId: CORTEX_ENV.packageId,
    id,
    data: new TextEncoder().encode(plaintext),
  });
  return encryptedObject;
}

export async function sealDecrypt(
  signer: PrivySuiSigner,
  blob: Uint8Array,
): Promise<string> {
  const address = signer.toSuiAddress();
  const identity = buildOwnerIdentity(address);

  const sessionKey = await SessionKey.create({
    address,
    packageId: CORTEX_ENV.packageId,
    ttlMin: SESSION_TTL_MIN,
    signer,
    suiClient: getSuiClient(),
  });

  const tx = new Transaction();
  tx.moveCall({
    target: `${CORTEX_ENV.packageId}::${SEAL_APPROVE_TARGET}`,
    arguments: [tx.pure.vector("u8", Array.from(identity))],
  });
  const txBytes = await tx.build({
    client: getSuiClient(),
    onlyTransactionKind: true,
  });

  const decrypted = await getSealClient().decrypt({
    data: blob,
    sessionKey,
    txBytes,
  });
  return new TextDecoder().decode(decrypted);
}
