// Bridges Privy auth to the Cortex storage module. Ensures the signed-in user has
// a Sui embedded wallet, builds a Sui Signer from Privy's raw-hash signing, and
// exposes bound storeFile / remember / recall actions for the live path.

"use client";

import { useEffect, useMemo, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import {
  useCreateWallet,
  useSignRawHash,
} from "@privy-io/react-auth/extended-chains";
import { PrivySuiSigner, type SignRawHash } from "@/lib/cortex/walrus/signer";
import {
  ensureAccount,
  getAccountId,
  getClaimedHandle,
  grantAdmin as accountGrantAdmin,
  revokeAdmin as accountRevokeAdmin,
  setHandle as accountSetHandle,
} from "@/lib/cortex/walrus/account";
import {
  createShare,
  setShareBundle,
  shareWithAddress,
  unshare as sharingUnshare,
  revokeShare as sharingRevokeShare,
  loadMyShares,
  loadReceivedShares,
  decryptShareBundle,
  type SharedMemoryItem,
  type ShareSummary,
} from "@/lib/cortex/walrus/sharing";
import {
  toSuinsName,
  normalizeUsername,
  resolveSuinsAddress,
  claimUsername as claimSuinsUsername,
} from "@/lib/cortex/walrus/suins";
import type { Memory } from "@/lib/cortex/logic";
import {
  contractsEnabled,
  CORTEX_ENV,
  sealEnabled,
} from "@/lib/cortex/walrus/env";
import {
  storeFile,
  fetchBlob,
  fetchSealedFile,
  type StoredFile,
} from "@/lib/cortex/walrus/files";
import { trackWalrusWrite } from "@/lib/cortex/walrus/inflight";
import { listKbFiles, type KbFileInfo } from "@/lib/cortex/walrus/kb";
import {
  saveSession as walrusSaveSession,
  listSessions as walrusListSessions,
  loadSession as walrusLoadSession,
  saveState,
  loadState,
  saveSettingValue,
  TIMELINE_KEY,
  DOCUMENTS_KEY,
  MEMORIES_KEY,
  PROFILE_KEY,
  ONBOARDED_KEY,
  type SessionMeta,
} from "@/lib/cortex/walrus/sessions";
import {
  saveTasks,
  loadTasks,
  saveBus,
  loadBus,
  saveRoster,
  loadRoster,
} from "@/lib/cortex/walrus/agents";
import {
  clearConnections,
  listConnectionsFor,
  removeConnection,
  saveConnection,
  type ConnectionRecord,
} from "@/lib/cortex/walrus/connections";
import {
  getWorkspaceId,
  grantWorkspaceDelegate,
  revokeWorkspaceDelegate,
  setupWorkspace as setupWorkspaceObject,
  saveWorkspaceTasks,
  loadWorkspaceTasks,
  saveWorkspaceBus,
  loadWorkspaceBus,
  saveWorkspaceLoops,
  loadWorkspaceLoops,
} from "@/lib/cortex/walrus/workspace";
import type { AgentDef, AgentTask, AgentMessage } from "@/lib/cortex/agents";
import type { LoopRun } from "@/lib/cortex/loops";

import {
  allMemoriesLive,
  authorizeMemoryDelegate,
  ensureMemory,
  findMemwalAccountId,
  listMemoryDelegates,
  loadMemoryCreds,
  memoryProvisioned,
  recallLive,
  rememberLive,
  revokeMemoryDelegate,
  type RecalledMemory,
} from "@/lib/cortex/walrus/memory";

const NAMESPACE = "personal";
const ZERO_ID = `0x${"0".repeat(64)}`;

interface SuiAccount {
  address: string;
  publicKey: string;
}

export interface CortexWallet {
  address: string;
  storeFile: (file: File) => Promise<StoredFile>;
  listFiles: () => Promise<KbFileInfo[]>;
  fetchFile: (file: {
    blobId: string;
    kbFileId: string;
    name: string;
  }) => Promise<Uint8Array>;
  remember: (text: string) => Promise<{ blobId: string } | null>;
  recall: (query: string) => Promise<RecalledMemory[]>;
  allMemories: () => Promise<RecalledMemory[]>;
  syncMemwal: () => Promise<RecalledMemory[]>;
  saveSession: (meta: SessionMeta, chat: unknown) => Promise<SessionMeta[]>;
  listSessions: () => Promise<SessionMeta[]>;
  loadSession: (blobId: string) => Promise<unknown | null>;
  saveTimeline: (events: unknown) => Promise<void>;
  loadTimeline: () => Promise<unknown | null>;
  saveDocuments: (documents: unknown) => Promise<void>;
  loadDocuments: () => Promise<unknown | null>;
  // The Memories view backs up + restores from Sui exactly like chats/timeline:
  // the full memory list is one Walrus blob pointed to by the account's
  // MEMORIES_KEY setting. (MemWal stays the recall engine; this is the durable,
  // enumerable copy the view reads.)
  saveMemories: (memories: unknown) => Promise<void>;
  loadMemories: () => Promise<unknown | null>;
  saveProfile: (profile: unknown) => Promise<void>;
  loadProfile: () => Promise<unknown | null>;
  loadHandle: () => Promise<string | null>;
  markOnboarded: () => Promise<void>;
  isOnboardedOnChain: () => Promise<boolean>;
  saveAgents: (
    tasks: AgentTask[],
    messages: AgentMessage[],
    roster: AgentDef[],
  ) => Promise<void>;
  loadAgents: () => Promise<{
    tasks: AgentTask[] | null;
    messages: AgentMessage[] | null;
    roster: AgentDef[] | null;
  } | null>;
  grantAdmin: (delegate: string) => Promise<void>;
  revokeAdmin: (delegate: string) => Promise<void>;
  workspaceStatus: () => Promise<string | null>;
  setupWorkspace: () => Promise<{ id: string; digest?: string }>;
  authorizeMcpAccess: () => Promise<string | undefined>;
  // Grant on-chain access and mint a long-lived Bearer the user copies into an MCP
  // client (Claude and others) that authenticates with a static token.
  createMcpToken: () => Promise<string>;
  revokeMcpAccess: () => Promise<string | undefined>;
  // managed OAuth: consent grant for a connecting MCP client (e.g. Claude),
  // and the dashboard's connected-apps list + per-connection revoke.
  connectMcp: (
    codeChallenge: string,
    clientId?: string,
  ) => Promise<{
    address: string;
    namespace: string;
    memwalAccountId: string;
    connectionId: string;
    signature: string;
  }>;
  listConnections: () => Promise<ConnectionRecord[]>;
  revokeConnection: (id: string) => Promise<void>;
  listDelegates: () => Promise<{ publicKey: string; isThisDevice: boolean }[]>;
  revokeDelegate: (publicKey: string) => Promise<boolean>;
  saveLoops: (loops: LoopRun[]) => Promise<void>;
  loadLoops: () => Promise<LoopRun[] | null>;
  // memory sharing (cortex::sharing) + SuiNS handles
  claimUsername: (
    username: string,
  ) => Promise<{ name: string; address: string; digest?: string }>;
  createMemoryShare: (input: {
    title: string;
    items: SharedMemoryItem[];
    recipient: string;
  }) => Promise<string>;
  listMyShares: () => Promise<ShareSummary[]>;
  loadSharedWithMe: () => Promise<Memory[]>;
  unshareMemory: (shareId: string, recipient: string) => Promise<void>;
  revokeShare: (shareId: string) => Promise<void>;
}

export interface CortexWalletState {
  ready: boolean;
  authenticated: boolean;
  provisioning: boolean;
  address: string | null;
  label: string;
  wallet: CortexWallet | null;
  error: string | null;
  login: () => void;
  logout: () => Promise<void>;
}

type PrivyUser = ReturnType<typeof usePrivy>["user"];

function suiAccountOf(user: PrivyUser): SuiAccount | null {
  for (const acct of user?.linkedAccounts ?? []) {
    if (acct.type === "wallet" && acct.chainType === "sui" && acct.publicKey) {
      return { address: acct.address, publicKey: acct.publicKey };
    }
  }
  return null;
}

// A friendly identifier for the signed-in user, from whatever they logged in with.
function labelOf(user: PrivyUser): string {
  for (const acct of user?.linkedAccounts ?? []) {
    if (acct.type === "email") return acct.address;
    if (acct.type === "google_oauth")
      return acct.email ?? acct.name ?? "Google";
    if (acct.type === "phone") return acct.number;
    if (acct.type === "twitter_oauth") return acct.username ?? acct.name ?? "X";
    if (acct.type === "discord_oauth") return acct.username ?? "Discord";
  }
  return "Account";
}

// Turn a share recipient typed by the user into a concrete Sui address. Accepts a raw
// 0x address, a bare cortex username ("bob"), or a full SuiNS subname ("bob.cortex.sui")
//  -  the latter two resolve through SuiNS to the address the leaf subname points at.
async function resolveRecipient(
  input: string,
): Promise<{ address: string; displayName: string }> {
  const trimmed = input.trim();
  if (trimmed.startsWith("0x"))
    return { address: trimmed, displayName: trimmed };
  const name = trimmed.includes(".")
    ? trimmed.toLowerCase()
    : toSuinsName(trimmed);
  const address = await resolveSuinsAddress(name);
  if (!address) {
    throw new Error(
      `Could not resolve ${name} to a Sui address  -  has that username been claimed?`,
    );
  }
  return { address, displayName: name };
}

// A decrypted shared item becomes a read-only memory in the recipient's brain: a
// namespaced id (so it never collides with or overwrites their own), the owner's
// handle as provenance, and the "shared" marks the UI reads to badge it.
function sharedItemToMemory(
  item: SharedMemoryItem,
  share: ShareSummary,
): Memory {
  return {
    id: `shared_${share.id}_${item.id}`,
    text: item.text,
    tags: item.tags ?? [],
    ts: item.ts,
    createdAt: item.ts,
    source: "shared",
    facet: item.facet,
    tier: item.tier as Memory["tier"],
    origin: item.origin,
    shared: true,
    sharedBy: share.ownerHandle,
    sharedFrom: share.id,
    lock: "none",
  };
}

export function useCortexWallet(): CortexWalletState {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { createWallet } = useCreateWallet();
  const { signRawHash } = useSignRawHash();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sui = useMemo(() => suiAccountOf(user), [user]);

  useEffect(() => {
    if (!ready || !authenticated || sui || creating) return;
    setCreating(true);
    setError(null);
    createWallet({ chainType: "sui" })
      .catch((err: unknown) =>
        setError(
          `Could not set up your wallet: ${(err as Error).message ?? err}`,
        ),
      )
      .finally(() => setCreating(false));
  }, [ready, authenticated, sui, creating, createWallet]);

  const signer = useMemo(() => {
    if (!sui) return null;
    return new PrivySuiSigner({
      address: sui.address,
      publicKey: sui.publicKey,
      signRawHash: signRawHash as SignRawHash,
    });
  }, [sui, signRawHash]);

  const wallet = useMemo<CortexWallet | null>(() => {
    if (!signer || !user) return null;
    const userKey = user.id;
    const address = signer.toSuiAddress();
    const ensureWorkspaceId = (accountId: string): Promise<string> =>
      setupWorkspaceObject(signer, accountId).then((r) => r.id);
    const ensureCortexAccount = (): Promise<string> =>
      ensureAccount({
        signer,
        memwalAccountId: loadMemoryCreds(userKey)?.accountId ?? ZERO_ID,
        displayName: "Cortex",
        handle: `cortex_${address.slice(2, 10)}`,
      });
    // Grant the MCP delegate everything it needs (admin over the account, the
    // workspace board, and the MemWal delegate). Shared by the one-click
    // authorize button and the OAuth consent flow. Returns the admin grant digest.
    const grantMcpAccess = async (
      accountId: string,
    ): Promise<string | undefined> => {
      let digest: string | undefined;
      const grants: Promise<unknown>[] = [];
      if (CORTEX_ENV.mcpAddress) {
        grants.push(
          accountGrantAdmin({
            signer,
            accountId,
            delegate: CORTEX_ENV.mcpAddress,
          }).then((r) => {
            digest = r.digest;
          }),
        );
      }
      if (sealEnabled() && CORTEX_ENV.mcpAddress) {
        const workspaceId = await ensureWorkspaceId(accountId);
        grants.push(
          grantWorkspaceDelegate(signer, workspaceId, CORTEX_ENV.mcpAddress),
        );
      }
      if (CORTEX_ENV.mcpMemwalPubkey) {
        grants.push(
          authorizeMemoryDelegate({
            userKey,
            signer,
            delegatePublicKey: CORTEX_ENV.mcpMemwalPubkey,
          }),
        );
      }
      await Promise.all(grants);
      return digest;
    };
    const revokeMcpGrants = async (
      accountId: string,
    ): Promise<string | undefined> => {
      let digest: string | undefined;
      const revocations: Promise<unknown>[] = [];
      if (CORTEX_ENV.mcpAddress) {
        revocations.push(
          accountRevokeAdmin({
            signer,
            accountId,
            delegate: CORTEX_ENV.mcpAddress,
          }).then((r) => {
            digest = r.digest;
          }),
        );
        if (sealEnabled()) {
          const workspaceId = await ensureWorkspaceId(accountId);
          revocations.push(
            revokeWorkspaceDelegate(signer, workspaceId, CORTEX_ENV.mcpAddress),
          );
        }
      }
      // The MCP reads/writes memory through its MemWal delegate key, so revoking the
      // on-chain admin alone leaves memory access fully intact (memory is pure
      // MemWal). Revoke the MemWal delegate too, which is what actually cuts the MCP
      // off at the relayer  -  this was the missing half that made "revoke" a no-op.
      if (CORTEX_ENV.mcpMemwalPubkey) {
        revocations.push(
          revokeMemoryDelegate({
            userKey,
            signer,
            publicKey: CORTEX_ENV.mcpMemwalPubkey,
          }),
        );
      }
      await Promise.all(revocations);
      return digest;
    };
    return {
      address,
      storeFile: async (file: File) => {
        const bytes = new Uint8Array(await file.arrayBuffer());
        // When the contracts are deployed, the file is recorded as an on-chain
        // KbFile owned by the user's Account  -  discover or create that Account on
        // chain. Otherwise the upload is a bare Walrus blob and the wallet address
        // is only used as the Seal identity scope.
        let accountId = address;
        if (contractsEnabled()) {
          accountId = await ensureAccount({
            signer,
            memwalAccountId: loadMemoryCreds(userKey)?.accountId ?? ZERO_ID,
            displayName: "Cortex",
            handle: `cortex_${address.slice(2, 10)}`,
          });
        }
        return trackWalrusWrite(
          storeFile({
            signer,
            accountId,
            file: {
              name: file.name,
              mime: file.type || "application/octet-stream",
              bytes,
            },
          }),
        );
      },
      listFiles: () => listKbFiles(address),
      // Fetch a KbFile's bytes for download: Seal-decrypt under the user's key when
      // Seal is configured (the aggregator only holds ciphertext), else the raw
      // blob. Returns the original file bytes.
      fetchFile: async (file) => {
        if (sealEnabled()) {
          const accountId = await getAccountId(address);
          if (!accountId) throw new Error("No account for this file.");
          return fetchSealedFile({
            signer,
            blobId: file.blobId,
            kbFileId: file.kbFileId,
            accountId,
            name: file.name,
          });
        }
        return fetchBlob(file.blobId);
      },
      remember: async (text: string) => {
        // MemWal is the only memory plane (the on-chain cortex::memory module was
        // dropped). The relayer handles vector search, Seal encryption, and the
        // durable Walrus copy. Best-effort: a relayer outage logs rather than throws
        // so the capture flow (which holds the local copy) isn't blocked.
        try {
          await ensureMemory(userKey, signer);
          return await trackWalrusWrite(rememberLive(userKey, NAMESPACE, text));
        } catch (err) {
          console.error("MemWal remember failed:", err);
          return null;
        }
      },
      recall: async (query: string) => {
        await ensureMemory(userKey, signer);
        return recallLive(userKey, NAMESPACE, query);
      },
      allMemories: async () => {
        // Pure MemWal: restore() rebuilds the relayer index from the durable Walrus
        // blobs, then a broad recall returns the full set (bounded by RECALL_LIMIT).
        // Recover the durable account first so a returning device with cleared creds
        // still resolves its memories; only a user who never provisioned has none.
        if (memoryProvisioned(userKey) || (await findMemwalAccountId(address))) {
          await ensureMemory(userKey, signer);
          return allMemoriesLive(userKey, NAMESPACE);
        }
        return [];
      },
      syncMemwal: async () => {
        // Cross-surface sync reads MemWal directly: it is the shared plane the MCP
        // and other connected apps write to. Same path as allMemories() now that the
        // on-chain plane is gone, kept as a distinct method for the explicit Sync
        // action and the on-login merge.
        if (!(memoryProvisioned(userKey) || (await findMemwalAccountId(address)))) {
          return [];
        }
        await ensureMemory(userKey, signer);
        return allMemoriesLive(userKey, NAMESPACE);
      },
      saveSession: async (meta: SessionMeta, chat: unknown) => {
        if (!contractsEnabled()) return [];
        const accountId = await ensureAccount({
          signer,
          memwalAccountId: loadMemoryCreds(userKey)?.accountId ?? ZERO_ID,
          displayName: "Cortex",
          handle: `cortex_${address.slice(2, 10)}`,
        });
        return trackWalrusWrite(
          walrusSaveSession(signer, accountId, meta, chat),
        );
      },
      listSessions: async () => {
        if (!contractsEnabled()) return [];
        const accountId = await getAccountId(address);
        return accountId ? walrusListSessions(accountId) : [];
      },
      loadSession: (blobId: string) => walrusLoadSession(signer, blobId),
      saveTimeline: async (events: unknown) => {
        if (!contractsEnabled()) return;
        const accountId = await ensureAccount({
          signer,
          memwalAccountId: loadMemoryCreds(userKey)?.accountId ?? ZERO_ID,
          displayName: "Cortex",
          handle: `cortex_${address.slice(2, 10)}`,
        });
        await trackWalrusWrite(
          saveState(signer, accountId, TIMELINE_KEY, events),
        );
      },
      loadTimeline: async () => {
        if (!contractsEnabled()) return null;
        const accountId = await getAccountId(address);
        return accountId ? loadState(signer, accountId, TIMELINE_KEY) : null;
      },
      saveDocuments: async (documents: unknown) => {
        if (!contractsEnabled()) return;
        const accountId = await ensureAccount({
          signer,
          memwalAccountId: loadMemoryCreds(userKey)?.accountId ?? ZERO_ID,
          displayName: "Cortex",
          handle: `cortex_${address.slice(2, 10)}`,
        });
        await trackWalrusWrite(
          saveState(signer, accountId, DOCUMENTS_KEY, documents),
        );
      },
      loadDocuments: async () => {
        if (!contractsEnabled()) return null;
        const accountId = await getAccountId(address);
        return accountId ? loadState(signer, accountId, DOCUMENTS_KEY) : null;
      },
      saveMemories: async (memories: unknown) => {
        if (!contractsEnabled()) return;
        const accountId = await ensureAccount({
          signer,
          memwalAccountId: loadMemoryCreds(userKey)?.accountId ?? ZERO_ID,
          displayName: "Cortex",
          handle: `cortex_${address.slice(2, 10)}`,
        });
        await trackWalrusWrite(
          saveState(signer, accountId, MEMORIES_KEY, memories),
        );
      },
      loadMemories: async () => {
        if (!contractsEnabled()) return null;
        const accountId = await getAccountId(address);
        return accountId ? loadState(signer, accountId, MEMORIES_KEY) : null;
      },
      saveProfile: async (profile: unknown) => {
        if (!contractsEnabled()) return;
        const accountId = await ensureAccount({
          signer,
          memwalAccountId: loadMemoryCreds(userKey)?.accountId ?? ZERO_ID,
          displayName: "Cortex",
          handle: `cortex_${address.slice(2, 10)}`,
        });
        await trackWalrusWrite(
          saveState(signer, accountId, PROFILE_KEY, profile),
        );
      },
      loadProfile: async () => {
        if (!contractsEnabled()) return null;
        const accountId = await getAccountId(address);
        return accountId ? loadState(signer, accountId, PROFILE_KEY) : null;
      },
      loadHandle: async () => {
        if (!contractsEnabled()) return null;
        return getClaimedHandle(address);
      },
      // Record onboarding as a plain on-chain account flag (no Walrus blob, so it
      // does not depend on a blob write succeeding), read back on every sign-in so
      // first-run never re-prompts a returning user.
      markOnboarded: async () => {
        if (!contractsEnabled()) return;
        const accountId = await ensureCortexAccount();
        await trackWalrusWrite(
          saveSettingValue(signer, accountId, ONBOARDED_KEY, "1"),
        );
      },
      isOnboardedOnChain: async () => {
        if (!contractsEnabled()) return false;
        // Having an on-chain Account is the durable "this user is set up" signal:
        // onboarding (and any first durable write) registers it, so a returning
        // user is never re-prompted.
        return (await getAccountId(address)) !== null;
      },
      // With Seal configured, the agent task board + bus live in the shared
      // Workspace object (owner + an authorized MCP can read/write). Without Seal,
      // they fall back to the owner-only per-account encrypted blobs.
      saveAgents: async (
        tasks: AgentTask[],
        messages: AgentMessage[],
        roster: AgentDef[],
      ) => {
        if (!contractsEnabled()) return;
        const accountId = await ensureAccount({
          signer,
          memwalAccountId: loadMemoryCreds(userKey)?.accountId ?? ZERO_ID,
          displayName: "Cortex",
          handle: `cortex_${address.slice(2, 10)}`,
        });
        // The roster is the user's own, so it lives on the Account; the task board
        // and bus live on the shared Workspace when Seal is configured.
        const board = sealEnabled()
          ? (async () => {
              const workspaceId = await ensureWorkspaceId(accountId);
              await Promise.all([
                saveWorkspaceTasks(signer, workspaceId, tasks),
                saveWorkspaceBus(signer, workspaceId, messages),
              ]);
            })()
          : Promise.all([
              saveTasks(signer, accountId, tasks),
              saveBus(signer, accountId, messages),
            ]);
        await trackWalrusWrite(
          Promise.all([board, saveRoster(signer, accountId, roster)]),
        );
      },
      loadAgents: async () => {
        if (!contractsEnabled()) return null;
        const accountId = await getAccountId(address);
        if (!accountId) return null;
        const roster = await loadRoster(signer, accountId);
        if (sealEnabled()) {
          const workspaceId = await getWorkspaceId(accountId);
          if (!workspaceId) return { tasks: null, messages: null, roster };
          const [tasks, messages] = await Promise.all([
            loadWorkspaceTasks(signer, workspaceId),
            loadWorkspaceBus(signer, workspaceId),
          ]);
          return { tasks, messages, roster };
        }
        const [tasks, messages] = await Promise.all([
          loadTasks(signer, accountId),
          loadBus(signer, accountId),
        ]);
        return { tasks, messages, roster };
      },
      // Loops are durable only when Seal + the Workspace are configured (they share
      // the same shared, owner-or-delegate board so the MCP can run them too).
      saveLoops: async (loops: LoopRun[]) => {
        if (!contractsEnabled() || !sealEnabled()) return;
        const accountId = await ensureAccount({
          signer,
          memwalAccountId: loadMemoryCreds(userKey)?.accountId ?? ZERO_ID,
          displayName: "Cortex",
          handle: `cortex_${address.slice(2, 10)}`,
        });
        const workspaceId = await ensureWorkspaceId(accountId);
        await trackWalrusWrite(saveWorkspaceLoops(signer, workspaceId, loops));
      },
      loadLoops: async () => {
        if (!contractsEnabled() || !sealEnabled()) return null;
        const accountId = await getAccountId(address);
        if (!accountId) return null;
        const workspaceId = await getWorkspaceId(accountId);
        if (!workspaceId) return null;
        return loadWorkspaceLoops(signer, workspaceId);
      },
      grantAdmin: async (delegate: string) => {
        if (!contractsEnabled()) return;
        const accountId = await ensureAccount({
          signer,
          memwalAccountId: loadMemoryCreds(userKey)?.accountId ?? ZERO_ID,
          displayName: "Cortex",
          handle: `cortex_${address.slice(2, 10)}`,
        });
        await accountGrantAdmin({ signer, accountId, delegate });
      },
      revokeAdmin: async (delegate: string) => {
        if (!contractsEnabled()) return;
        const accountId = await ensureAccount({
          signer,
          memwalAccountId: loadMemoryCreds(userKey)?.accountId ?? ZERO_ID,
          displayName: "Cortex",
          handle: `cortex_${address.slice(2, 10)}`,
        });
        await accountRevokeAdmin({ signer, accountId, delegate });
      },
      // The resolved Workspace object id (account setting first, env fallback), or
      // null when no workspace has been created yet. Read-only  -  no transaction.
      workspaceStatus: async () => {
        if (!contractsEnabled()) return null;
        const accountId = await getAccountId(address);
        return accountId ? getWorkspaceId(accountId) : null;
      },
      // One-time: create the shared Workspace object and record its id in the
      // account settings so the browser, backend, and MCP all resolve the same board.
      setupWorkspace: async () => {
        if (!contractsEnabled()) {
          throw new Error(
            "Creating the agent workspace needs the cortex contracts configured",
          );
        }
        const accountId = await ensureCortexAccount();
        return setupWorkspaceObject(signer, accountId);
      },
      authorizeMcpAccess: async () => {
        if (!contractsEnabled()) return undefined;
        return grantMcpAccess(await ensureCortexAccount());
      },
      createMcpToken: async () => {
        if (!contractsEnabled())
          throw new Error("Connect the Cortex contracts to authorize an MCP");
        if (!CORTEX_ENV.mcpUrl)
          throw new Error("Set NEXT_PUBLIC_CORTEX_MCP_URL to mint a token");
        await ensureMemory(userKey, signer);
        const memwalAccountId = loadMemoryCreds(userKey)?.accountId ?? "";
        // Never mint a token without a concrete MemWal account: the MCP would fall
        // back to a shared pool and mix this user's memory with others'.
        if (!memwalAccountId)
          throw new Error(
            "Your memory account isn't ready yet. Try again in a moment.",
          );
        const accountId = await ensureCortexAccount();
        await grantMcpAccess(accountId);
        const connectionId = crypto.randomUUID();
        await saveConnection(signer, accountId, {
          id: connectionId,
          client: "Personal token",
          createdAt: Date.now(),
        });
        const challenge = crypto.randomUUID();
        const message = new TextEncoder().encode(
          `Authorize Cortex MCP for Claude\nchallenge:${challenge}`,
        );
        const { signature } = await signer.signPersonalMessage(message);
        const base = CORTEX_ENV.mcpUrl.replace(/\/mcp\/?$/, "");
        const res = await fetch(`${base}/oauth/personal-token`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            address,
            namespace: NAMESPACE,
            memwalAccountId,
            connectionId,
            signature,
            code_challenge: challenge,
          }),
        });
        if (!res.ok) throw new Error(`Token request failed (${res.status})`);
        const { access_token } = (await res.json()) as { access_token: string };
        return access_token;
      },
      revokeMcpAccess: async () => {
        if (!contractsEnabled()) return undefined;
        const accountId = await ensureCortexAccount();
        const digest = await revokeMcpGrants(accountId);
        await clearConnections(signer, accountId);
        return digest;
      },
      // OAuth consent: provision memory, grant the MCP delegate, record the
      // connection, and sign the challenge so the MCP can mint the auth code. The
      // signature is the proof of address ownership the MCP verifies.
      connectMcp: async (codeChallenge: string, clientId?: string) => {
        await ensureMemory(userKey, signer);
        const memwalAccountId = loadMemoryCreds(userKey)?.accountId ?? "";
        // Never authorize a connection without a concrete MemWal account: the MCP
        // would fall back to a shared pool and mix this user's memory with others'.
        if (!memwalAccountId)
          throw new Error(
            "Your memory account isn't ready yet. Try again in a moment.",
          );
        const accountId = await ensureCortexAccount();
        await grantMcpAccess(accountId);
        const connectionId = crypto.randomUUID();
        await saveConnection(signer, accountId, {
          id: connectionId,
          client: clientId || "OAuth Client",
          clientId,
          createdAt: Date.now(),
        });
        const message = new TextEncoder().encode(
          `Authorize Cortex MCP for Claude\nchallenge:${codeChallenge}`,
        );
        const { signature } = await signer.signPersonalMessage(message);
        return {
          address,
          namespace: NAMESPACE,
          memwalAccountId,
          connectionId,
          signature,
        };
      },
      listConnections: async () => {
        if (!contractsEnabled()) return [];
        const accountId = await getAccountId(address);
        return accountId ? listConnectionsFor(accountId) : [];
      },
      revokeConnection: async (id: string) => {
        if (!contractsEnabled()) return;
        const accountId = await ensureCortexAccount();
        await removeConnection(signer, accountId, id);
      },
      listDelegates: async () => {
        if (!contractsEnabled()) return [];
        return listMemoryDelegates(userKey);
      },
      revokeDelegate: async (publicKey: string) => {
        if (!contractsEnabled()) return false;
        return revokeMemoryDelegate({ userKey, signer, publicKey });
      },
      // Claim a SuiNS username: set it as the on-chain account handle (so a share's
      // owner_handle reads `<name>.cortex.sui`) then ask the server to mint the leaf
      // subname pointing at this wallet. The mint degrades gracefully if unconfigured.
      claimUsername: async (username: string) => {
        if (contractsEnabled()) {
          const accountId = await ensureAccount({
            signer,
            memwalAccountId: loadMemoryCreds(userKey)?.accountId ?? ZERO_ID,
            displayName: "Cortex",
            handle: `cortex_${address.slice(2, 10)}`,
          });
          await accountSetHandle({
            signer,
            accountId,
            handle: normalizeUsername(username),
          });
        }
        return claimSuinsUsername(username, address);
      },
      // Share a chosen set of memories with one recipient: open a DRAFT share, attach
      // the Seal-encrypted bundle (scoped to the share's own id), and grant the
      // recipient (resolved from their SuiNS name/address). Returns the share id.
      createMemoryShare: async ({ title, items, recipient }) => {
        if (!contractsEnabled() || !sealEnabled()) {
          throw new Error(
            "Sharing needs the cortex contracts and Seal key servers configured",
          );
        }
        const accountId = await ensureAccount({
          signer,
          memwalAccountId: loadMemoryCreds(userKey)?.accountId ?? ZERO_ID,
          displayName: "Cortex",
          handle: `cortex_${address.slice(2, 10)}`,
        });
        const { address: recipientAddress, displayName } =
          await resolveRecipient(recipient);
        const shareId = await createShare(signer, accountId, title);
        await setShareBundle(signer, shareId, items);
        await shareWithAddress(signer, shareId, recipientAddress, displayName);
        return shareId;
      },
      listMyShares: async () =>
        contractsEnabled() ? loadMyShares(address) : [],
      // Pull every active share addressed to me, decrypt each bundle, and flatten to
      // read-only "shared" memories for the brain. A share we can't decrypt (revoked
      // mid-flight, key server down) is skipped rather than failing the whole load.
      loadSharedWithMe: async () => {
        if (!contractsEnabled() || !sealEnabled()) return [];
        const received = await loadReceivedShares(address);
        const out: Memory[] = [];
        for (const share of received) {
          try {
            const items = await decryptShareBundle(signer, share.id);
            for (const item of items) out.push(sharedItemToMemory(item, share));
          } catch {
            /* unreadable share  -  skip, keep the rest of the inbox */
          }
        }
        return out;
      },
      unshareMemory: async (shareId: string, recipient: string) => {
        if (contractsEnabled())
          await sharingUnshare(signer, shareId, recipient);
      },
      revokeShare: async (shareId: string) => {
        if (contractsEnabled()) await sharingRevokeShare(signer, shareId);
      },
    };
  }, [signer, user]);

  return {
    ready,
    authenticated,
    provisioning: authenticated && !wallet,
    address: sui?.address ?? null,
    label: labelOf(user),
    wallet,
    error,
    login,
    logout,
  };
}
