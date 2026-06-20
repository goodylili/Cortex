// Server-side mint of a SuiNS *leaf* subname under the project's parent domain.
// The browser cannot mint these  -  the parent `cortex.sui` registration NFT lives in a
// server wallet, so the claim is signed here. A leaf subname carries no NFT of its own:
// it is a pointer the parent owns, which is exactly what we want (the project retains
// control, the user just gets `<username>.cortex.sui` resolving to their address).
//
// Graceful degradation: when the server wallet / parent-NFT env is unset the route
// returns 503 rather than crashing, so the app still runs on the mock/unconfigured path.

import { z } from "zod";

import { SuinsClient, SuinsTransaction } from "@mysten/suins";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { isValidSuiAddress } from "@mysten/sui/utils";

type SuiNetwork = "testnet" | "mainnet";

const DEFAULT_SUINS_PARENT = "cortex.sui";
const DEFAULT_RPC: Record<SuiNetwork, string> = {
  testnet: "https://fullnode.testnet.sui.io:443",
  mainnet: "https://fullnode.mainnet.sui.io:443",
};

// Same label rules the client helper enforces (lowercase a-z/0-9/hyphen, length-bounded),
// re-checked here because the route is reachable without the client.
const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 63;
const USERNAME_PATTERN = /^[a-z0-9-]+$/;

const SERVICE_UNAVAILABLE = 503;

const bodySchema = z.object({
  username: z.string().min(1),
  address: z.string().min(1),
  network: z.enum(["testnet", "mainnet"]).optional(),
});

function parseNetwork(value: string | undefined): SuiNetwork {
  return value === "mainnet" ? "mainnet" : "testnet";
}

// SuiNS env is per-network (different parent domain / registration NFT per chain);
// the signer wallet is reused, so its key stays untagged.
function suinsConfig(network: SuiNetwork): {
  parent: string;
  parentNftId: string;
} {
  const tag = network.toUpperCase();
  return {
    parent: process.env[`NEXT_PUBLIC_CORTEX_SUINS_PARENT_${tag}`] ?? "",
    parentNftId: process.env[`CORTEX_SUINS_PARENT_NFT_ID_${tag}`] ?? "",
  };
}

function normalizeUsername(username: string): string | null {
  const normalized = username.trim().toLowerCase();
  if (
    normalized.length < USERNAME_MIN_LENGTH ||
    normalized.length > USERNAME_MAX_LENGTH ||
    !USERNAME_PATTERN.test(normalized) ||
    normalized.startsWith("-") ||
    normalized.endsWith("-")
  ) {
    return null;
  }
  return normalized;
}

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: "bad request" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const username = normalizeUsername(parsed.data.username);
  if (!username) {
    return Response.json({ error: "invalid username" }, { status: 400 });
  }

  const address = parsed.data.address;
  if (!isValidSuiAddress(address)) {
    return Response.json({ error: "invalid address" }, { status: 400 });
  }

  // Network-scoped parent domain + registration NFT; signer wallet is reused, so
  // its key is untagged. Absent any of them, claiming is not configured.
  const network = parseNetwork(parsed.data.network);
  const { parent: parentName, parentNftId } = suinsConfig(network);
  const signerKey = process.env.CORTEX_SUINS_SIGNER_KEY ?? "";
  if (!parentNftId || !signerKey || !parentName) {
    return Response.json(
      { error: "SuiNS claiming not configured" },
      { status: SERVICE_UNAVAILABLE },
    );
  }

  const parent = parentName || DEFAULT_SUINS_PARENT;
  const name = `${username}.${parent}`;
  const rpc = DEFAULT_RPC[network];

  try {
    // fromSecretKey accepts a bech32 `suiprivkey...` string or a raw 32-byte key;
    // a configured secret should be the bech32 form.
    const keypair = Ed25519Keypair.fromSecretKey(signerKey);
    const client = new SuiGrpcClient({ network, baseUrl: rpc });
    const suinsClient = new SuinsClient({ client, network });

    const transaction = new Transaction();
    const suinsTx = new SuinsTransaction(suinsClient, transaction);
    // Leaf subname: no expiry/NFT  -  points `name` at `address`, parent NFT authorizes it.
    suinsTx.createLeafSubName({
      parentNft: parentNftId,
      name,
      targetAddress: address,
    });

    const result = await client.signAndExecuteTransaction({
      signer: keypair,
      transaction,
    });
    const digest =
      result.$kind === "Transaction"
        ? result.Transaction.digest
        : result.FailedTransaction.digest;

    return Response.json({ name, address, digest });
  } catch (err) {
    const message = err instanceof Error ? err.message : "claim failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
