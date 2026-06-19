// Lazily-constructed, memoized SDK clients for the live path. One Sui gRPC client
// is shared by the Walrus and Seal clients so they read the same chain state.

"use client";

import { SuiGrpcClient } from "@mysten/sui/grpc";
import { SealClient } from "@mysten/seal";
import { WalrusClient } from "@mysten/walrus";
import { CORTEX_ENV } from "./env";

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
    // nodes for the client, making writes fast from the browser. sendTip:null
    // targets the public tip-free testnet relay.
    walrusClient = new WalrusClient({
      network: CORTEX_ENV.network,
      suiClient: getSuiClient(),
      uploadRelay: {
        host: CORTEX_ENV.walrusUploadRelay,
        sendTip: null,
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
