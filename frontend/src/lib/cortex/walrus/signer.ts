// A Sui Signer backed by a Privy embedded wallet. Privy supports Sui as a Tier-2
// chain via raw-hash signing (useSignRawHash). The Sui SDK's abstract Signer does
// the intent framing + blake2b digest + signature serialization; we only supply
// sign(digest) by forwarding the digest to Privy, plus the Ed25519 public key.

"use client";

import { Signer } from "@mysten/sui/cryptography";
import type { SignatureScheme } from "@mysten/sui/cryptography";
import type { PublicKey } from "@mysten/sui/cryptography";
import type { SuiClientTypes } from "@mysten/sui/client";
import type { Transaction } from "@mysten/sui/transactions";
import { Ed25519PublicKey } from "@mysten/sui/keypairs/ed25519";
import { fromBase64, fromHex, toHex } from "@mysten/sui/utils";
import { getSuiClient } from "./clients";

const ED25519_PUBLIC_KEY_LENGTH = 32;

// All on-chain writes share one Privy wallet, so they share one gas coin. Two
// transactions built concurrently resolve the same coin version and the second
// lands stale ("object ... unavailable for consumption" / equivocation). Run
// every wallet transaction through this queue and wait for it to settle before
// releasing, so the next build reads fresh object versions. A failed tx still
// frees the queue for the next one.
let txQueue: Promise<unknown> = Promise.resolve();
function enqueueTx<T>(task: () => Promise<T>): Promise<T> {
  const run = txQueue.then(task, task);
  txQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function digestOf(result: SuiClientTypes.TransactionResult): string {
  return result.$kind === "Transaction"
    ? result.Transaction.digest
    : result.FailedTransaction.digest;
}

export type SignRawHash = (input: {
  address: string;
  chainType: "sui";
  hash: `0x${string}`;
}) => Promise<{ signature: `0x${string}` }>;

const ED25519_SCHEME_FLAG = 0x00;

function decodePublicKey(raw: string): Uint8Array {
  const trimmed = raw.startsWith("0x") ? raw.slice(2) : raw;
  const isHex = /^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0;
  let bytes = isHex ? fromHex(trimmed) : fromBase64(raw);
  // Sui serializes public keys as `flag || key`; Privy returns this 33-byte form.
  // Strip the leading Ed25519 scheme flag to recover the raw 32-byte key.
  if (
    bytes.length === ED25519_PUBLIC_KEY_LENGTH + 1 &&
    bytes[0] === ED25519_SCHEME_FLAG
  ) {
    bytes = bytes.slice(1);
  }
  if (bytes.length !== ED25519_PUBLIC_KEY_LENGTH) {
    throw new Error(
      `Expected a ${ED25519_PUBLIC_KEY_LENGTH}-byte Ed25519 public key, got ${bytes.length} bytes`,
    );
  }
  return bytes;
}

export class PrivySuiSigner extends Signer {
  readonly #address: string;
  readonly #publicKey: Ed25519PublicKey;
  readonly #signRawHash: SignRawHash;

  constructor(args: {
    address: string;
    publicKey: string;
    signRawHash: SignRawHash;
  }) {
    super();
    this.#address = args.address;
    this.#publicKey = new Ed25519PublicKey(decodePublicKey(args.publicKey));
    this.#signRawHash = args.signRawHash;
  }

  getKeyScheme(): SignatureScheme {
    return "ED25519";
  }

  getPublicKey(): PublicKey {
    return this.#publicKey;
  }

  async sign(bytes: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
    const { signature } = await this.#signRawHash({
      address: this.#address,
      chainType: "sui",
      hash: `0x${toHex(bytes)}`,
    });
    const raw = fromHex(
      signature.startsWith("0x") ? signature.slice(2) : signature,
    );
    const out = new Uint8Array(raw.length);
    out.set(raw);
    return out;
  }

  // Serialize wallet writes (see enqueueTx) and wait for each to settle so the
  // next transaction builds against fresh object versions. Both our own calls and
  // the Walrus SDK's internal steps (create storage, register, certify) go through
  // here, so this is the single chokepoint that prevents gas-coin equivocation.
  override signAndExecuteTransaction(
    input: Parameters<Signer["signAndExecuteTransaction"]>[0],
  ): ReturnType<Signer["signAndExecuteTransaction"]> {
    return enqueueTx(async () => {
      const result = await super.signAndExecuteTransaction(input);
      try {
        await input.client.core.waitForTransaction({ digest: digestOf(result) });
      } catch {
        /* settlement wait is best-effort; the queue still advances */
      }
      return result;
    });
  }
}

// MemWal's account helpers want a dapp-kit-shaped wallet signer rather than the
// Sui Signer class. Adapt the Privy signer to that interface.
export interface WalletSigner {
  address: string;
  signAndExecuteTransaction: (input: {
    transaction: unknown;
  }) => Promise<{ digest: string }>;
  signPersonalMessage: (input: {
    message: Uint8Array;
  }) => Promise<{ signature: string }>;
}

export function toWalletSigner(signer: PrivySuiSigner): WalletSigner {
  const client = getSuiClient();
  return {
    address: signer.toSuiAddress(),
    signAndExecuteTransaction: async ({ transaction }) => {
      const result = await signer.signAndExecuteTransaction({
        transaction: transaction as Transaction,
        client,
      });
      return { digest: digestOf(result) };
    },
    signPersonalMessage: async ({ message }) => {
      const { signature } = await signer.signPersonalMessage(message);
      return { signature };
    },
  };
}
