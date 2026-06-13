// Sui: the chain is the source of truth for "what is the latest manifest blob".
// We record the manifest blob id against a per-namespace registry object and read
// it back. Live path uses @mysten/sui; the mock keeps an in-memory pointer table.

import type { Config } from "../../src/core/config";
import { isLive } from "../../src/core/config";
import { stateHash } from "../../src/core/crypto";
import { importExternal } from "../../src/core/external";

export interface ManifestPointer {
  manifestBlobId: string;
  suiObject: string;
}

export interface SuiClient {
  recordManifest(namespace: string, manifestBlobId: string): Promise<string>; // -> txn
  readManifestPointer(namespace: string): Promise<ManifestPointer>;
}

class MockSui implements SuiClient {
  private ptr = new Map<string, ManifestPointer>();
  private txn = 0;
  async recordManifest(namespace: string, manifestBlobId: string) {
    this.ptr.set(namespace, {
      manifestBlobId,
      suiObject: "0xobj_" + stateHash([namespace]),
    });
    return "0xsui" + String(++this.txn).padStart(4, "0");
  }
  async readManifestPointer(namespace: string) {
    const p = this.ptr.get(namespace);
    if (!p) throw new Error("sui(mock): no pointer for " + namespace);
    return p;
  }
}

/** Live Sui. Reads/writes a small Move registry mapping namespace -> manifest blob.
 *  Loosely typed + lazily imported; falls back cleanly when the SDK is absent. */
class LiveSui implements SuiClient {
  constructor(private cfg: Config) {}
  private clientP?: Promise<any>;
  private async client(): Promise<any> {
    if (!this.clientP) {
      this.clientP = (async () => {
        const sui: any = await importExternal("@mysten/sui/client");
        return new sui.SuiClient({ url: this.cfg.sui.rpc });
      })();
    }
    return this.clientP;
  }
  private async signer(): Promise<any> {
    const ed: any = await importExternal("@mysten/sui/keypairs/ed25519");
    return ed.Ed25519Keypair.fromSecretKey(this.cfg.delegateKey);
  }
  async recordManifest(
    namespace: string,
    manifestBlobId: string,
  ): Promise<string> {
    const c = await this.client();
    const txMod: any = await importExternal("@mysten/sui/transactions");
    const tx = new txMod.Transaction();
    // moveCall into the cortex::registry::set(namespace, blobId) entry once deployed
    tx.moveCall({
      target: `${this.cfg.seal.policyPackage}::registry::set`,
      arguments: [tx.pure.string(namespace), tx.pure.string(manifestBlobId)],
    });
    const res = await c.signAndExecuteTransaction({
      signer: await this.signer(),
      transaction: tx,
    });
    return res.digest;
  }
  async readManifestPointer(namespace: string): Promise<ManifestPointer> {
    // production reads the registry dynamic field; until deployed, surface clearly
    throw new Error(
      `sui(live): registry not deployed for ${namespace}; set seal.policyPackage`,
    );
  }
}

export function createSui(cfg: Config): SuiClient {
  return isLive(cfg) && cfg.seal.policyPackage
    ? new LiveSui(cfg)
    : new MockSui();
}
