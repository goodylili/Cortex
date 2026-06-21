// Self-hosted gas station. A fresh Privy embedded wallet holds no SUI or WAL, so
// every on-chain write (account register, session/timeline/doc/agent/loop pointers,
// KB files) and every Walrus blob write (storage is paid in WAL, plus a SUI relay
// tip) would revert. On testnet we make the executor wallet pay for everyone: this
// route tops a user's wallet up from the executor's SUI and WAL so all writes land.
//
// Pure gas-only sponsorship (sponsor owns the gas coin) cannot cover Walrus, whose
// storage cost is a WAL coin argument rather than gas, so the executor funds both
// balances directly. Called on every sign-in; it is idempotent (no-op when the
// wallet is already above threshold) and rate-limited per address.
//
// Production hardening (out of scope here): a gas-coin pool to avoid serializing
// every transfer, durable per-address quotas, and abuse limits. The in-memory
// queue + cooldown below are a single-instance testnet guard, not a real limiter.

import { z } from "zod";

import { SuiGrpcClient } from "@mysten/sui/grpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction, coinWithBalance } from "@mysten/sui/transactions";
import { isValidSuiAddress } from "@mysten/sui/utils";

type SuiNetwork = "testnet" | "mainnet";

const SERVICE_UNAVAILABLE = 503;

const DEFAULT_RPC: Record<SuiNetwork, string> = {
  testnet: "https://fullnode.testnet.sui.io:443",
  mainnet: "https://fullnode.mainnet.sui.io:443",
};

// Mirrors DEFAULT_WAL_COIN_TYPE in src/lib/cortex/walrus/env.ts.
const WAL_COIN_TYPE: Record<SuiNetwork, string> = {
  testnet:
    "0x8270feb7375eee355e64fdb69c50abb6b5f9393a722883c1cf45f8e26048810a::wal::WAL",
  mainnet:
    "0x356a26eb9e012a68958082340d4c4116e7f55615cf27affcff209cf0ae544f59::wal::WAL",
};

const SUI_COIN_TYPE = "0x2::sui::SUI";

// SUI and WAL both use 9 decimals. Top up only when the wallet is below the floor,
// and send enough to cover several writes before the next sign-in tops it up again.
const TOKEN_DECIMALS = BigInt(1_000_000_000);
const SUI_MIN = TOKEN_DECIMALS / BigInt(10); // 0.1 SUI
const SUI_TOPUP = TOKEN_DECIMALS / BigInt(2); // 0.5 SUI
const WAL_MIN = TOKEN_DECIMALS / BigInt(10); // 0.1 WAL
const WAL_TOPUP = TOKEN_DECIMALS / BigInt(2); // 0.5 WAL
// Headroom the executor keeps for its own transaction gas on top of the amount it
// transfers, so a top-up is only attempted when the sponsor can also pay for the
// transfer itself rather than reverting in gas selection.
const SPONSOR_GAS_BUFFER = TOKEN_DECIMALS / BigInt(20); // 0.05 SUI

const COOLDOWN_MS = 30_000;

const bodySchema = z.object({
  address: z.string().min(1),
  network: z.enum(["testnet", "mainnet"]).optional(),
});

function parseNetwork(value: string | undefined): SuiNetwork {
  return value === "mainnet" ? "mainnet" : "testnet";
}

// The executor signs one transfer at a time: it is a single wallet, so concurrent
// transfers would resolve the same gas coin version and equivocate. Serialize them
// through one promise chain (same pattern as the wallet signer's enqueueTx). A
// failed transfer still frees the queue for the next caller.
let txQueue: Promise<unknown> = Promise.resolve();
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = txQueue.then(task, task);
  txQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

// Last successful top-up per address, so a reload storm doesn't drain the executor.
const lastFunded = new Map<string, number>();

async function suiBalanceOf(
  client: SuiGrpcClient,
  owner: string,
  coinType: string,
): Promise<bigint> {
  const res = await client.getBalance({ owner, coinType });
  return BigInt(res.balance.balance);
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

  const address = parsed.data.address;
  if (!isValidSuiAddress(address)) {
    return Response.json({ error: "invalid address" }, { status: 400 });
  }

  const sponsorKey = process.env.CORTEX_SPONSOR_KEY ?? "";
  if (!sponsorKey) {
    return Response.json(
      { error: "gas station not configured" },
      { status: SERVICE_UNAVAILABLE },
    );
  }

  const network = parseNetwork(parsed.data.network);
  const walType = WAL_COIN_TYPE[network];

  try {
    const keypair = Ed25519Keypair.fromSecretKey(sponsorKey);
    const sponsor = keypair.toSuiAddress();
    const client = new SuiGrpcClient({
      network,
      baseUrl: DEFAULT_RPC[network],
    });

    const [userSui, userWal] = await Promise.all([
      suiBalanceOf(client, address, SUI_COIN_TYPE),
      suiBalanceOf(client, address, walType),
    ]);

    const needSui = userSui < SUI_MIN;
    const needWal = userWal < WAL_MIN;
    const recently = lastFunded.get(address);
    const onCooldown =
      recently !== undefined && Date.now() - recently < COOLDOWN_MS;

    if ((!needSui && !needWal) || onCooldown) {
      return Response.json({
        funded: false,
        suiBalance: userSui.toString(),
        walBalance: userWal.toString(),
      });
    }

    // Confirm the executor can actually cover each leg before building the transfer.
    // Sending more than it holds reverts in gas selection and surfaces only as a
    // confusing downstream write failure, so only fund the legs it can afford. WAL is
    // optional: a SUI-only executor still unblocks the on-chain pointers, and missing
    // WAL surfaces as a visible Walrus write error rather than a failed funding request.
    const sponsorSui = await suiBalanceOf(client, sponsor, SUI_COIN_TYPE);
    const sponsorWal = needWal
      ? await suiBalanceOf(client, sponsor, walType)
      : BigInt(0);
    const fundSui = needSui && sponsorSui >= SUI_TOPUP + SPONSOR_GAS_BUFFER;
    const fundWal =
      needWal && sponsorWal >= WAL_TOPUP && sponsorSui >= SPONSOR_GAS_BUFFER;

    // Fail loudly when the executor can't fund what this wallet needs. Without SUI the
    // wallet can't pay gas for any write, so missing SUI is a hard stop that WAL alone
    // won't fix; likewise when nothing fundable remains. A 503 + reason lets the client
    // warn the user and signals the operator to refill the executor, instead of the old
    // behaviour of silently returning "not funded" or letting the transfer revert.
    if ((needSui && !fundSui) || (!fundSui && !fundWal)) {
      return Response.json(
        {
          funded: false,
          reason: "sponsor_exhausted",
          error:
            "Gas station is empty. Request testnet SUI and WAL for your wallet at faucet.suilearn.io to keep saving.",
          sponsorSui: sponsorSui.toString(),
          sponsorWal: sponsorWal.toString(),
          suiBalance: userSui.toString(),
          walBalance: userWal.toString(),
        },
        { status: SERVICE_UNAVAILABLE },
      );
    }

    const digest = await enqueue(async () => {
      const tx = new Transaction();
      tx.setSender(sponsor);
      if (fundSui) {
        tx.transferObjects([coinWithBalance({ balance: SUI_TOPUP })], address);
      }
      if (fundWal) {
        tx.transferObjects(
          [coinWithBalance({ type: walType, balance: WAL_TOPUP })],
          address,
        );
      }
      const exec = await client.signAndExecuteTransaction({
        signer: keypair,
        transaction: tx,
      });
      const d =
        exec.$kind === "Transaction"
          ? exec.Transaction.digest
          : exec.FailedTransaction.digest;
      await client.waitForTransaction({ digest: d });
      return d;
    });

    lastFunded.set(address, Date.now());

    const [suiAfter, walAfter] = await Promise.all([
      suiBalanceOf(client, address, SUI_COIN_TYPE),
      suiBalanceOf(client, address, walType),
    ]);

    return Response.json({
      funded: true,
      walShort: needWal && !fundWal,
      suiBalance: suiAfter.toString(),
      walBalance: walAfter.toString(),
      digest,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "funding failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
