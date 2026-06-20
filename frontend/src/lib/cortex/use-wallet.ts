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
import { storeFile, type StoredFile } from "@/lib/cortex/walrus/files";
import { listKbFiles, type KbFileInfo } from "@/lib/cortex/walrus/kb";
import {
  saveSession as walrusSaveSession,
  listSessions as walrusListSessions,
  loadSession as walrusLoadSession,
  saveState,
  loadState,
  TIMELINE_KEY,
  DOCUMENTS_KEY,
  type SessionMeta,
} from "@/lib/cortex/walrus/sessions";
import {
  saveTasks,
  loadTasks,
  saveBus,
  loadBus,
} from "@/lib/cortex/walrus/agents";
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
import type { AgentTask, AgentMessage } from "@/lib/cortex/agents";
import type { LoopRun } from "@cortex/core/loops";

const WORKSPACE_KEY = "agents:workspace";
import {
  authorizeMemoryDelegate,
  ensureMemory,
  listMemoryDelegates,
  loadMemoryCreds,
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
  remember: (text: string) => Promise<{ blobId: string } | null>;
  recall: (query: string) => Promise<RecalledMemory[]>;
  saveSession: (meta: SessionMeta, chat: unknown) => Promise<SessionMeta[]>;
  listSessions: () => Promise<SessionMeta[]>;
  loadSession: (blobId: string) => Promise<unknown | null>;
  saveTimeline: (events: unknown) => Promise<void>;
  loadTimeline: () => Promise<unknown | null>;
  saveDocuments: (documents: unknown) => Promise<void>;
  loadDocuments: () => Promise<unknown | null>;
  saveAgents: (tasks: AgentTask[], messages: AgentMessage[]) => Promise<void>;
  loadAgents: () => Promise<{
    tasks: AgentTask[] | null;
    messages: AgentMessage[] | null;
  } | null>;
  grantAdmin: (delegate: string) => Promise<void>;
  revokeAdmin: (delegate: string) => Promise<void>;
  workspaceStatus: () => Promise<string | null>;
  setupWorkspace: () => Promise<{ id: string; digest?: string }>;
  authorizeMcpAccess: () => Promise<string | undefined>;
  revokeMcpAccess: () => Promise<string | undefined>;
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
  logout: () => void;
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
    if (acct.type === "google_oauth") return acct.email ?? acct.name ?? "Google";
    if (acct.type === "phone") return acct.number;
    if (acct.type === "twitter_oauth")
      return acct.username ?? acct.name ?? "X";
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
  if (trimmed.startsWith("0x")) return { address: trimmed, displayName: trimmed };
  const name = trimmed.includes(".") ? trimmed.toLowerCase() : toSuinsName(trimmed);
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
function sharedItemToMemory(item: SharedMemoryItem, share: ShareSummary): Memory {
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
        return storeFile({
          signer,
          accountId,
          file: {
            name: file.name,
            mime: file.type || "application/octet-stream",
            bytes,
          },
        });
      },
      listFiles: () => listKbFiles(address),
      remember: async (text: string) => {
        await ensureMemory(userKey, signer);
        return rememberLive(userKey, NAMESPACE, text);
      },
      recall: async (query: string) => {
        await ensureMemory(userKey, signer);
        return recallLive(userKey, NAMESPACE, query);
      },
      saveSession: async (meta: SessionMeta, chat: unknown) => {
        if (!contractsEnabled()) return [];
        const accountId = await ensureAccount({
          signer,
          memwalAccountId: loadMemoryCreds(userKey)?.accountId ?? ZERO_ID,
          displayName: "Cortex",
          handle: `cortex_${address.slice(2, 10)}`,
        });
        return walrusSaveSession(signer, accountId, meta, chat);
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
        await saveState(signer, accountId, TIMELINE_KEY, events);
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
        await saveState(signer, accountId, DOCUMENTS_KEY, documents);
      },
      loadDocuments: async () => {
        if (!contractsEnabled()) return null;
        const accountId = await getAccountId(address);
        return accountId ? loadState(signer, accountId, DOCUMENTS_KEY) : null;
      },
      // With Seal configured, the agent task board + bus live in the shared
      // Workspace object (owner + an authorized MCP can read/write). Without Seal,
      // they fall back to the owner-only per-account encrypted blobs.
      saveAgents: async (tasks: AgentTask[], messages: AgentMessage[]) => {
        if (!contractsEnabled()) return;
        const accountId = await ensureAccount({
          signer,
          memwalAccountId: loadMemoryCreds(userKey)?.accountId ?? ZERO_ID,
          displayName: "Cortex",
          handle: `cortex_${address.slice(2, 10)}`,
        });
        if (sealEnabled()) {
          const workspaceId = await ensureWorkspaceId(accountId);
          await Promise.all([
            saveWorkspaceTasks(signer, workspaceId, tasks),
            saveWorkspaceBus(signer, workspaceId, messages),
          ]);
          return;
        }
        await Promise.all([
          saveTasks(signer, accountId, tasks),
          saveBus(signer, accountId, messages),
        ]);
      },
      loadAgents: async () => {
        if (!contractsEnabled()) return null;
        const accountId = await getAccountId(address);
        if (!accountId) return null;
        if (sealEnabled()) {
          const workspaceId = await getWorkspaceId(accountId);
          if (!workspaceId) return null;
          const [tasks, messages] = await Promise.all([
            loadWorkspaceTasks(signer, workspaceId),
            loadWorkspaceBus(signer, workspaceId),
          ]);
          return { tasks, messages };
        }
        const [tasks, messages] = await Promise.all([
          loadTasks(signer, accountId),
          loadBus(signer, accountId),
        ]);
        return { tasks, messages };
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
        await saveWorkspaceLoops(signer, workspaceId, loops);
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
        const accountId = await ensureAccount({
          signer,
          memwalAccountId: loadMemoryCreds(userKey)?.accountId ?? ZERO_ID,
          displayName: "Cortex",
          handle: `cortex_${address.slice(2, 10)}`,
        });
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
      },
      revokeMcpAccess: async () => {
        if (!contractsEnabled() || !CORTEX_ENV.mcpAddress) return undefined;
        const accountId = await ensureAccount({
          signer,
          memwalAccountId: loadMemoryCreds(userKey)?.accountId ?? ZERO_ID,
          displayName: "Cortex",
          handle: `cortex_${address.slice(2, 10)}`,
        });
        let digest: string | undefined;
        const revocations: Promise<unknown>[] = [
          accountRevokeAdmin({
            signer,
            accountId,
            delegate: CORTEX_ENV.mcpAddress,
          }).then((r) => {
            digest = r.digest;
          }),
        ];
        if (sealEnabled()) {
          const workspaceId = await ensureWorkspaceId(accountId);
          revocations.push(
            revokeWorkspaceDelegate(signer, workspaceId, CORTEX_ENV.mcpAddress),
          );
        }
        await Promise.all(revocations);
        return digest;
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
      listMyShares: async () => (contractsEnabled() ? loadMyShares(address) : []),
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
        if (contractsEnabled()) await sharingUnshare(signer, shareId, recipient);
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
