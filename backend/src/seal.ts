// Seal threshold encryption. One allowlist policy per namespace (see
// contracts/sources/allowlist.move), checked on every decrypt via seal_approve.

import type { Config } from "./config.js";
import { isLive } from "./config.js";
import { importExternal } from "./external.js";

export interface SealHelper {
  encrypt(bytes: Uint8Array): Promise<Uint8Array>;
  decrypt(bytes: Uint8Array): Promise<Uint8Array>;
}

/** No-op for the mock; bytes pass through unchanged. */
class MockSeal implements SealHelper {
  async encrypt(bytes: Uint8Array) {
    return bytes;
  }
  async decrypt(bytes: Uint8Array) {
    return bytes;
  }
}

/** Live Seal via @mysten/seal, gated by the namespace allowlist object. */
class LiveSeal implements SealHelper {
  constructor(private cfg: Config) {}
  private clientP?: Promise<any>;
  private async client(): Promise<any> {
    if (!this.clientP) {
      this.clientP = (async () => {
        const sui: any = await importExternal("@mysten/sui/client");
        const seal: any = await importExternal("@mysten/seal");
        const suiClient = new sui.SuiClient({ url: this.cfg.sui.rpc });
        return new seal.SealClient({
          suiClient,
          serverConfigs: seal.getAllowlistedKeyServers?.(this.cfg.sui.network),
        });
      })();
    }
    return this.clientP;
  }
  async encrypt(bytes: Uint8Array): Promise<Uint8Array> {
    const c = await this.client();
    const { encryptedObject } = await c.encrypt({
      threshold: 1,
      packageId: this.cfg.seal.policyPackage,
      id: this.cfg.seal.policyObject,
      data: bytes,
    });
    return encryptedObject;
  }
  async decrypt(bytes: Uint8Array): Promise<Uint8Array> {
    const c = await this.client();
    return c.decrypt({ data: bytes, txBytes: this.cfg.seal.policyObject });
  }
}

export function createSeal(cfg: Config): SealHelper {
  return isLive(cfg) && cfg.seal.policyObject
    ? new LiveSeal(cfg)
    : new MockSeal();
}
