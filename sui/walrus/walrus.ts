// Walrus blob storage. Publisher writes, aggregator reads. The read path is the
// independence check: a blob is fetchable from a public aggregator with no Cortex.

import type { Config } from "../../src/core/config";
import { isLive } from "../../src/core/config";
import { importExternal } from "../../src/core/external";

export interface WalrusClient {
  putBlob(bytes: Uint8Array): Promise<string>; // -> blobId
  getBlob(blobId: string): Promise<Uint8Array>;
  aggregatorUrl(blobId: string): string;
}

function fnv(bytes: Uint8Array): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i]!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

class MockWalrus implements WalrusClient {
  private blobs = new Map<string, Uint8Array>();
  async putBlob(bytes: Uint8Array) {
    const id = "blob_" + fnv(bytes);
    this.blobs.set(id, bytes);
    return id;
  }
  async getBlob(blobId: string) {
    const b = this.blobs.get(blobId);
    if (!b) throw new Error("walrus(mock): blob not found " + blobId);
    return b;
  }
  aggregatorUrl(blobId: string) {
    return `mock://aggregator/v1/${blobId}`;
  }
}

/** Live Walrus via @mysten/walrus + @mysten/sui. Lazily imported and loosely
 *  typed so the package compiles and runs on the mock without the SDK present. */
class LiveWalrus implements WalrusClient {
  constructor(private cfg: Config) {}
  private clientP?: Promise<any>;
  private async client(): Promise<any> {
    if (!this.clientP) {
      this.clientP = (async () => {
        const sui: any = await importExternal("@mysten/sui/client");
        const walrus: any = await importExternal("@mysten/walrus");
        const suiClient = new sui.SuiClient({ url: this.cfg.sui.rpc });
        return new walrus.WalrusClient({
          network: this.cfg.sui.network,
          suiClient,
        });
      })();
    }
    return this.clientP;
  }
  private async signer(): Promise<any> {
    const ed: any = await importExternal("@mysten/sui/keypairs/ed25519");
    return ed.Ed25519Keypair.fromSecretKey(this.cfg.delegateKey);
  }
  async putBlob(bytes: Uint8Array): Promise<string> {
    const c = await this.client();
    const { blobId } = await c.writeBlob({
      blob: bytes,
      epochs: this.cfg.walrus.epochs,
      deletable: false,
      signer: await this.signer(),
    });
    return blobId;
  }
  async getBlob(blobId: string): Promise<Uint8Array> {
    const c = await this.client();
    return c.readBlob({ blobId });
  }
  aggregatorUrl(blobId: string): string {
    return `${this.cfg.walrus.aggregator}/v1/blobs/${blobId}`;
  }
}

export function createWalrus(cfg: Config): WalrusClient {
  return isLive(cfg) ? new LiveWalrus(cfg) : new MockWalrus();
}
