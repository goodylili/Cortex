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
} from "@/lib/cortex/walrus/account";
import { contractsEnabled, sealEnabled } from "@/lib/cortex/walrus/env";
import { storeFile, type StoredFile } from "@/lib/cortex/walrus/files";
import { listKbFiles, type KbFileInfo } from "@/lib/cortex/walrus/kb";
import {
  saveSession as walrusSaveSession,
  listSessions as walrusListSessions,
  loadSession as walrusLoadSession,
  saveState,
  loadState,
  saveSettingValue,
  loadSettingValue,
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
  createWorkspace,
  saveWorkspaceTasks,
  loadWorkspaceTasks,
  saveWorkspaceBus,
  loadWorkspaceBus,
} from "@/lib/cortex/walrus/workspace";
import type { AgentTask, AgentMessage } from "@/lib/cortex/agents";

const WORKSPACE_KEY = "agents:workspace";
import {
  ensureMemory,
  loadMemoryCreds,
  recallLive,
  rememberLive,
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
    return {
      address,
      storeFile: async (file: File) => {
        const bytes = new Uint8Array(await file.arrayBuffer());
        // When the contracts are deployed, the file is recorded as an on-chain
        // KbFile owned by the user's Account — discover or create that Account on
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
          let workspaceId = await loadSettingValue(accountId, WORKSPACE_KEY);
          if (!workspaceId) {
            workspaceId = await createWorkspace(signer, accountId);
            await saveSettingValue(signer, accountId, WORKSPACE_KEY, workspaceId);
          }
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
          const workspaceId = await loadSettingValue(accountId, WORKSPACE_KEY);
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
