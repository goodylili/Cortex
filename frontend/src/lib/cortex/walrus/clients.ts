// Lazily-constructed, memoized SDK clients for the live path. One Sui gRPC client
// is shared by the Walrus and Seal clients so they read the same chain state.

"use client";

import { SuiGrpcClient } from "@mysten/sui/grpc";
import { SealClient } from "@mysten/seal";
import { WalrusClient } from "@mysten/walrus";
import { CORTEX_ENV } from "./env";

// Ceiling (in MIST) on the per-upload tip the relay may charge. The actual tip is
// read from the relay's /v1/tip-config; this only caps it so a mispriced relay
// can't drain the wallet. 0.1 SUI is far above any real tip.
const UPLOAD_TIP_MAX_MIST = 100_000_000;

let suiClient: SuiGrpcClient | undefined;
let walrusClient: WalrusClient | undefined;
let sealClient: SealClient | undefined;

export function getSuiClient(): SuiGrpcClient {
  if (!suiClient) {
    suiClient = new SuiGrpcClient({
      network: CORTEX_ENV.network,
      baseUrl: CORTEX_ENV.suiRpc,
    });
  }
  return suiClient;
}

export function getWalrusClient(): WalrusClient {
  if (!walrusClient) {
    // The upload relay ("Walrus Harbor") fans encoded slivers out to storage
    // nodes for the client, making writes fast from the browser. The relay
    // requires a tip: with sendTip set the SDK reads the relay's tip-config,
    // pays it, and sends the tx_id/nonce the relay checks (sendTip:null omits
    // them and the relay rejects the upload with a 400).
    walrusClient = new WalrusClient({
      network: CORTEX_ENV.network,
      suiClient: getSuiClient(),
      uploadRelay: {
        host: CORTEX_ENV.walrusUploadRelay,
        sendTip: { max: UPLOAD_TIP_MAX_MIST },
      },
    });
  }
  return walrusClient;
}

export function getSealClient(): SealClient {
  if (!sealClient) {
    sealClient = new SealClient({
      suiClient: getSuiClient(),
      serverConfigs: CORTEX_ENV.seal.serverObjectIds.map((objectId) => ({
        objectId,
        weight: 1,
      })),
    });
  }
  return sealClient;
}
