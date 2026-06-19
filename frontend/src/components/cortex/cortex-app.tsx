"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useCortex } from "@/lib/cortex/store";
import {
  ago,
  computeSavings,
  fmtMoney,
  fmtTokens,
  MODELS,
  type Memory,
} from "@/lib/cortex/logic";
import {
  PROVIDERS,
  providerInfo,
  providerModels,
  customModelId,
  type CustomModel,
} from "@/lib/llm/byok";
import { passkeySupported, passkeyEnrolled } from "@/lib/llm/byok-vault";
import type { Provider } from "@/lib/llm/models";
import {
  compilePrompt,
  DEFAULT_MODALITY,
  DEFAULT_STYLE,
  DEFAULT_TYPE,
  MODALITIES,
  STYLES,
  TYPES,
  type PromptModality,
  type PromptStyle,
  type PromptType,
} from "@/lib/cortex/prompt";
import {
  stateOf,
  retention,
  TIER_NAME,
  type Tier,
  type MemState,
} from "@/lib/cortex/memory-model";
import type { CortexWalletState } from "@/lib/cortex/use-wallet";
import {
  CORTEX_ENV,
  contractsEnabled,
  sealEnabled,
} from "@/lib/cortex/walrus/env";
import { getSuiClient } from "@/lib/cortex/walrus/clients";
import {
  AGENTS,
  type AgentRole,
  ACCENTS,
  ROLE_LABELS,
  isBuiltInAgent,
} from "@/lib/cortex/agents";
import { useDictation, useReadAloud } from "@/lib/cortex/use-voice";
import { DOCS_URL } from "@/lib/site";
import {
  ONBOARDING_STEPS,
  TOTAL_QUESTIONS,
  profileAnsweredCount,
  type UserProfile,
} from "@/lib/cortex/profile";
import { Onboarding } from "./onboarding";
import { CaptureModal } from "./capture";
import { Markdown } from "./markdown";
import { SourceChips, type SourceItem } from "./sources";

// cortex::sharing MemoryShare.status: 0 DRAFT, 1 ACTIVE, 2 REVOKED.
const SHARE_STATUS_LABEL: Record<number, string> = {
  0: "draft",
  1: "active",
  2: "revoked",
};

const MARK = (
  <svg viewBox="0 0 120 120" fill="currentColor">
    <circle cx="60" cy="60" r="13" />
    {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
      <g key={a} transform={`rotate(${a} 60 60)`}>
        <rect x="51.5" y="19" width="6.5" height="25" rx="3.25" />
        <rect x="62" y="19" width="6.5" height="25" rx="3.25" />
      </g>
    ))}
  </svg>
);

const MemoryMap = dynamic(
  () => import("./memory-map").then((m) => m.MemoryMap),
  {
    ssr: false,
    loading: () => <div className="brain-loading">Mapping your memory…</div>,
  },
);

type View =
  | "home"
  | "memories"
  | "reflect"
  | "brain"
  | "agents"
  | "studio"
  | "knowledge"
  | "integrations";
type Theme = "light" | "dark" | "system";
type SettingsSection =
  | "account"
  | "profile"
  | "models"
  | "privacy"
  | "username"
  | "devices"
  | "memory"
  | "reset";

// Popular destinations per modality — "Open in …" from the Studio output.
// `prefill` URLs accept the prompt as a ?q= query; the rest just open the app
// (we always copy the prompt to the clipboard so it's ready to paste).
const STUDIO_PRODUCTS: Record<
  PromptModality,
  { name: string; url: string; prefill?: boolean }[]
> = {
  text: [
    { name: "ChatGPT", url: "https://chatgpt.com/?q=", prefill: true },
    { name: "Claude", url: "https://claude.ai/new?q=", prefill: true },
    { name: "Gemini", url: "https://gemini.google.com/app" },
    {
      name: "Perplexity",
      url: "https://www.perplexity.ai/search?q=",
      prefill: true,
    },
  ],
  image: [
    { name: "Midjourney", url: "https://www.midjourney.com/imagine" },
    {
      name: "DALL·E in ChatGPT",
      url: "https://chatgpt.com/?q=",
      prefill: true,
    },
    { name: "Ideogram", url: "https://ideogram.ai" },
    { name: "Leonardo", url: "https://app.leonardo.ai" },
  ],
  audio: [
    { name: "Suno", url: "https://suno.com/create" },
    { name: "Udio", url: "https://www.udio.com" },
    { name: "ElevenLabs", url: "https://elevenlabs.io/app" },
  ],
  video: [
    { name: "Sora", url: "https://sora.chatgpt.com" },
    { name: "Runway", url: "https://app.runwayml.com" },
    { name: "Veo in Gemini", url: "https://gemini.google.com/app" },
    { name: "Pika", url: "https://pika.art" },
  ],
};
const CODE_TYPES = ["json", "xml", "yaml", "function", "multimodal", "schema"];

const ROOM_SLUG_WORDS = 3;
const ROOM_PREVIEW_CAP = 5;
const AGENT_NAMES = AGENTS.map((a) => a.name);
const roomSlug = (goal: string): string => {
  const words = goal
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, ROOM_SLUG_WORDS);
  return words.length ? words.join("-") : "task";
};
const taskCode = (id: string): string => "TASK-" + id.slice(-3).toUpperCase();
const COIN_DECIMALS = 9;
const COIN_DISPLAY_DECIMALS = 4;
const fmtCoin = (raw: string): string => {
  let big: bigint;
  try {
    big = BigInt(raw);
  } catch {
    return "0";
  }
  const base = BigInt(10) ** BigInt(COIN_DECIMALS);
  const whole = big / base;
  const frac = (big % base)
    .toString()
    .padStart(COIN_DECIMALS, "0")
    .slice(0, COIN_DISPLAY_DECIMALS)
    .replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
};
const clock = (ts: number): string =>
  new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
const renderMessageText = (
  text: string,
  names: string[] = AGENT_NAMES,
): React.ReactNode[] => {
  const nodes: React.ReactNode[] = [];
  text.split(/(`[^`]+`)/g).forEach((part, pi) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      nodes.push(
        <code className="pr-code" key={`c${pi}`}>
          {part.slice(1, -1)}
        </code>,
      );
      return;
    }
    part.split(/(@\w+)/g).forEach((tok, ti) => {
      if (!tok) return;
      const isMention =
        tok.startsWith("@") &&
        names.some((n) => n.toLowerCase() === tok.slice(1).toLowerCase());
      nodes.push(
        isMention ? (
          <span className="pr-mention" key={`m${pi}-${ti}`}>
            {tok}
          </span>
        ) : (
          <span key={`t${pi}-${ti}`}>{tok}</span>
        ),
      );
    });
  });
  return nodes;
};

export function CortexApp({
  walletState,
}: {
  walletState?: CortexWalletState;
}) {
  const s = useCortex();
  const [view, setView] = useState<View>("home");
  const [theme, setTheme] = useState<Theme>("system");
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const [dev, setDev] = useState(false);
  const [onboardOpen, setOnboardOpen] = useState(false);
  const [profileDraft, setProfileDraft] = useState<UserProfile>({});
  const [profileSaved, setProfileSaved] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] =
    useState<SettingsSection>("account");
  const [settingsSearch, setSettingsSearch] = useState("");
  const [walletBalances, setWalletBalances] = useState<{
    sui: string;
    wal: string;
  } | null>(null);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const openSettings = (section: SettingsSection) => {
    setSettingsSection(section);
    setSettingsSearch("");
    setSettingsOpen(true);
    setProfileOpen(false);
  };
  const [input, setInput] = useState("");
  const [memFilter, setMemFilter] = useState("all");
  const [memTab, setMemTab] = useState<"cards" | "timeline">("cards");
  const [captureOpen, setCaptureOpen] = useState(false);
  const [agentAssignee, setAgentAssignee] = useState<string>(AGENTS[0]!.id);
  const [roomTaskId, setRoomTaskId] = useState<string | null>(null);
  const [threadTaskId, setThreadTaskId] = useState<string | null>(null);
  const [threadReply, setThreadReply] = useState("");
  const [roomRailOpen, setRoomRailOpen] = useState(true);
  const [roomsExpanded, setRoomsExpanded] = useState(false);
  const [secRooms, setSecRooms] = useState(true);
  const [secAgents, setSecAgents] = useState(true);
  const [agModalOpen, setAgModalOpen] = useState(false);
  const [agName, setAgName] = useState("");
  const [agRole, setAgRole] = useState<AgentRole>("researcher");
  const [agBlurb, setAgBlurb] = useState("");
  const [agAccent, setAgAccent] = useState<string>(ACCENTS[0]!);
  const [agRenameId, setAgRenameId] = useState<string | null>(null);
  const [agRenameVal, setAgRenameVal] = useState("");
  const [agMode, setAgMode] = useState<"task" | "ask" | "remember">("task");
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null);
  const [autoTaskId, setAutoTaskId] = useState<string | null>(null);
  const autoStop = useRef(false);
  const [loopBusy, setLoopBusy] = useState(false);
  const dictation = useDictation();
  const readAloud = useReadAloud();
  const [modelOpen, setModelOpen] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [impOpen, setImpOpen] = useState(false);
  const [addModelOpen, setAddModelOpen] = useState(false);
  const [amProvider, setAmProvider] = useState<Provider | "">("");
  const [amApiId, setAmApiId] = useState("");
  const [amKey, setAmKey] = useState("");
  const [amUrl, setAmUrl] = useState("");
  const [amBusy, setAmBusy] = useState(false);
  const [amError, setAmError] = useState("");
  useEffect(() => {
    useCortex.getState().loadCustomModels();
  }, []);
  const [kbMenu, setKbMenu] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<Memory | "savings" | null>(null);
  const [studioTask, setStudioTask] = useState("");
  const [studioMode, setStudioMode] = useState<"prompt" | "loop">("prompt");
  const [studioStyle, setStudioStyle] = useState<PromptStyle>(DEFAULT_STYLE);
  const [studioType, setStudioType] = useState<PromptType>(DEFAULT_TYPE);
  const [studioSel, setStudioSel] = useState<Set<string> | null>(null);
  const [studioModality, setStudioModality] =
    useState<PromptModality>(DEFAULT_MODALITY);
  const [studioResult, setStudioResult] = useState<{
    key: string;
    text: string;
    ai: boolean;
  } | null>(null);
  const [studioLoading, setStudioLoading] = useState(false);
  const [studioPick, setStudioPick] = useState(false);
  const [studioDrop, setStudioDrop] = useState<
    "modality" | "style" | "type" | "model" | null
  >(null);
  const [studioMenu, setStudioMenu] = useState(false);
  const [intTab, setIntTab] = useState<
    "all" | "mcp" | "frameworks" | "sources"
  >("all");
  const [intOpen, setIntOpen] = useState<string | null>(null);
  const [mcpAuthBusy, setMcpAuthBusy] = useState(false);
  const [delegates, setDelegates] = useState<
    { publicKey: string; isThisDevice: boolean }[]
  >([]);
  const [delegatesLoading, setDelegatesLoading] = useState(false);
  const [revokingKey, setRevokingKey] = useState<string | null>(null);
  const [session, setSession] = useState<{ addr: string; via: string } | null>(
    null,
  );
  // memory sharing (cortex::sharing) + SuiNS handle, local UI state.
  const [shareOpen, setShareOpen] = useState(false);
  const [shareHubOpen, setShareHubOpen] = useState(false);
  const [shareRecipient, setShareRecipient] = useState("");
  const [shareBusy, setShareBusy] = useState(false);
  const [shareErr, setShareErr] = useState("");
  const [username, setUsername] = useState("");
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimErr, setClaimErr] = useState("");
  const [claimedName, setClaimedName] = useState("");
  const [shareSel, setShareSel] = useState<Set<string>>(new Set());
  const [sharedRefreshing, setSharedRefreshing] = useState(false);
  const [revokingShareId, setRevokingShareId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [chatRailOpen, setChatRailOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [kbFilter, setKbFilter] = useState<
    "all" | "pdf" | "markdown" | "walrus" | "shared"
  >("all");
  const [dreams, setDreams] = useState<{ title: string; body: string }[]>([]);
  const [dreamsLoading, setDreamsLoading] = useState(false);
  const dreamsTried = useRef(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    s.hydrate();
  }, []); // eslint-disable-line
  useEffect(() => {
    try {
      const t = localStorage.getItem("cortex-theme") as Theme;
      if (t) setTheme(t);
      if (localStorage.getItem("cortex-dev")) setDev(true);
      const ss = localStorage.getItem("cortex-session");
      if (ss) setSession(JSON.parse(ss));
      const cn = localStorage.getItem("cortex-username");
      if (cn) setClaimedName(cn);
      const cr = localStorage.getItem("cortex-chatrail");
      if (cr !== null) setChatRailOpen(cr === "1");
    } catch {}
    const apply = () => {
      const h = location.hash.slice(1) as View;
      if (
        [
          "home",
          "memories",
          "reflect",
          "brain",
          "agents",
          "studio",
          "knowledge",
          "integrations",
        ].includes(h)
      )
        setView(h);
    };
    // Always open on the overview; a deep-link hash no longer picks the initial
    // view. In-app nav still drives the hash, so back/forward keep working.
    if (location.hash && location.hash !== "#home")
      history.replaceState(null, "", "#home");
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);
  const eff =
    theme === "system"
      ? typeof window !== "undefined" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", eff);
  }, [eff]);
  useEffect(() => {
    document.body.classList.toggle("dev", dev);
    document.body.classList.toggle("mode-ask", s.mode === "ask");
  }, [dev, s.mode]);
  // Mirror on-chain KbFiles into the store so they appear in Knowledge + the brain.
  useEffect(() => {
    const w = walletState?.wallet;
    if (!w) return;
    w.listFiles()
      .then((files) => s.syncFiles(files))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletState?.wallet]);
  // Restore durable state (sessions index, timeline, documents) from Walrus/Sui on
  // sign-in. Local cache stays instant; this fills in cross-device history.
  useEffect(() => {
    const w = walletState?.wallet;
    if (!w) return;
    void w
      .listSessions()
      .then((sessions) => {
        if (sessions.length) s.setSessions(sessions);
        const active = sessions[0];
        if (active?.blobId && !s.chat.length) {
          return w.loadSession(active.blobId).then((chat) => {
            if (Array.isArray(chat) && chat.length) {
              s.setChat(chat as Parameters<typeof s.setChat>[0]);
            }
          });
        }
      })
      .catch(() => {});
    void w
      .loadTimeline()
      .then((t) => {
        if (Array.isArray(t) && t.length)
          s.setEvents(t as Parameters<typeof s.setEvents>[0]);
      })
      .catch(() => {});
    void w
      .loadDocuments()
      .then((d) => {
        if (Array.isArray(d) && d.length)
          s.setDocuments(d as Parameters<typeof s.setDocuments>[0]);
      })
      .catch(() => {});
    void w
      .loadAgents()
      .then((a) => {
        if (a?.tasks?.length)
          s.setTasks(a.tasks as Parameters<typeof s.setTasks>[0]);
        if (a?.messages?.length)
          s.setAgentMessages(
            a.messages as Parameters<typeof s.setAgentMessages>[0],
          );
      })
      .catch(() => {});
    void w
      .loadLoops()
      .then((loops) => {
        if (Array.isArray(loops) && loops.length)
          s.setLoops(loops as Parameters<typeof s.setLoops>[0]);
      })
      .catch(() => {});
    // Memories others shared with me (read-only) + the shares I created.
    void w
      .loadSharedWithMe()
      .then((shared) => s.setSharedMemories(shared))
      .catch(() => {});
    void w
      .listMyShares()
      .then((shares) => s.setShares(shares))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletState?.wallet]);
  // Debounced background sync of the active session + timeline + documents to
  // Walrus + Sui (local stays instant; the chain copy catches up after a settle).
  useEffect(() => {
    const w = walletState?.wallet;
    if (!w) return;
    const t = setTimeout(() => {
      const active = s.sessions.find((x) => x.id === s.activeId);
      if (active && s.chat.length && !s.chat.some((m) => m.streaming)) {
        void w
          .saveSession(
            { id: active.id, title: active.title, updatedAt: active.updatedAt },
            s.chat,
          )
          .catch(() => {});
      }
      if (s.events.length) void w.saveTimeline(s.events).catch(() => {});
      if (s.documents.length) void w.saveDocuments(s.documents).catch(() => {});
      if (s.tasks.length || s.agentMessages.length)
        void w.saveAgents(s.tasks, s.agentMessages).catch(() => {});
      if (s.loops.length) void w.saveLoops(s.loops).catch(() => {});
    }, 6000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    walletState?.wallet,
    s.chat,
    s.events,
    s.documents,
    s.tasks,
    s.agentMessages,
    s.loops,
  ]);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (
        composerRef.current &&
        !composerRef.current.contains(e.target as Node)
      )
        setModelOpen(false);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  useEffect(() => {
    if (!kbMenu) return;
    const onDoc = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".kb2-menu-wrap")) setKbMenu(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [kbMenu]);
  useEffect(() => {
    if (!profileOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (
        profileRef.current &&
        !profileRef.current.contains(e.target as Node)
      ) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [profileOpen]);
  const isSignedIn = walletState
    ? walletState.authenticated && !!walletState.address
    : !!session;
  useEffect(() => {
    if (s.ready && isSignedIn && !s.onboarded) setOnboardOpen(true);
  }, [s.ready, isSignedIn, s.onboarded]);
  useEffect(() => {
    if (settingsOpen) {
      setProfileDraft({ ...useCortex.getState().profile });
      setProfileSaved(false);
    }
  }, [settingsOpen]);
  function flash(m: string) {
    setToast(m);
    setTimeout(() => setToast(""), 2600);
  }

  const mcpAuthReady =
    !!walletState?.wallet &&
    contractsEnabled() &&
    CORTEX_ENV.mcpAddress.length > 0;

  async function authorizeMcp() {
    const w = walletState?.wallet;
    if (!w || !mcpAuthReady) return;
    setMcpAuthBusy(true);
    try {
      await w.authorizeMcpAccess();
      flash(
        "Authorized your MCP — it can now access your profile, memory and shared agent workspace.",
      );
    } catch (err) {
      flash(err instanceof Error ? err.message : String(err));
    } finally {
      setMcpAuthBusy(false);
    }
  }

  async function revokeMcp() {
    const w = walletState?.wallet;
    if (!w || !mcpAuthReady) return;
    setMcpAuthBusy(true);
    try {
      await w.revokeMcpAccess();
      flash("Revoked MCP access.");
    } catch (err) {
      flash(err instanceof Error ? err.message : String(err));
    } finally {
      setMcpAuthBusy(false);
    }
  }

  async function refreshBalances() {
    const owner = walletState?.address;
    if (!owner) {
      setWalletBalances(null);
      return;
    }
    setBalancesLoading(true);
    try {
      const client = getSuiClient();
      const [sui, wal] = await Promise.all([
        client.getBalance({ owner, coinType: CORTEX_ENV.suiCoinType }),
        client.getBalance({ owner, coinType: CORTEX_ENV.walCoinType }),
      ]);
      setWalletBalances({ sui: sui.balance.balance, wal: wal.balance.balance });
    } catch {
      setWalletBalances(null);
    } finally {
      setBalancesLoading(false);
    }
  }

  async function loadDelegates() {
    const w = walletState?.wallet;
    if (!w) {
      setDelegates([]);
      return;
    }
    setDelegatesLoading(true);
    try {
      setDelegates(await w.listDelegates());
    } catch {
      setDelegates([]);
    } finally {
      setDelegatesLoading(false);
    }
  }

  async function revokeDelegate(publicKey: string) {
    const w = walletState?.wallet;
    if (!w) return;
    setRevokingKey(publicKey);
    try {
      const ok = await w.revokeDelegate(publicKey);
      if (!ok) {
        flash("Revoking from chain isn't available in this build yet.");
        return;
      }
      flash("Revoked.");
      await loadDelegates();
    } catch (err) {
      flash(err instanceof Error ? err.message : String(err));
    } finally {
      setRevokingKey(null);
    }
  }

  // Share one of my OWN memories with a named recipient (username / *.cortex.sui
  // / 0x address). Bundles a single item, then refreshes my outbox of shares.
  async function shareMemory(m: Memory) {
    const w = walletState?.wallet;
    const recipient = shareRecipient.trim();
    if (!w || !recipient) return;
    setShareBusy(true);
    setShareErr("");
    try {
      const title = m.text.length > 60 ? m.text.slice(0, 60) + "…" : m.text;
      await w.createMemoryShare({
        title,
        items: [
          {
            id: m.id,
            text: m.text,
            tags: m.tags,
            ts: m.ts,
            facet: m.facet,
            tier: m.tier,
            origin: m.origin,
          },
        ],
        recipient,
      });
      s.setShares(await w.listMyShares());
      setShareOpen(false);
      setShareRecipient("");
      flash(`Shared with ${recipient}.`);
    } catch (err) {
      setShareErr(err instanceof Error ? err.message : String(err));
    } finally {
      setShareBusy(false);
    }
  }

  // Share several of my OWN memories with a recipient in one go, bundling each
  // selected memory as a shared item, then refreshing my outbox of shares.
  function bulkSetAside() {
    const ids = [...shareSel];
    ids.forEach((id) => s.setAside(id));
    setShareSel(new Set());
    flash(
      `Set aside ${ids.length} ${ids.length === 1 ? "memory" : "memories"}.`,
    );
  }
  function bulkForget() {
    const ids = [...shareSel];
    ids.forEach((id) => s.forgetMem(id, true));
    setShareSel(new Set());
    flash(`Deleted ${ids.length} ${ids.length === 1 ? "memory" : "memories"}.`);
  }
  function bulkKeepClose() {
    const ids = [...shareSel];
    ids.forEach((id) => s.keepClose(id));
    setShareSel(new Set());
    flash(
      `Kept ${ids.length} ${ids.length === 1 ? "memory" : "memories"} close.`,
    );
  }
  async function shareSelected() {
    const w = walletState?.wallet;
    const recipient = shareRecipient.trim();
    const picked = live.filter((m) => shareSel.has(m.id));
    if (!w || !recipient || picked.length === 0) return;
    setShareBusy(true);
    setShareErr("");
    try {
      const lead = picked[0]!.text;
      const title =
        picked.length === 1
          ? lead.length > 60
            ? lead.slice(0, 60) + "…"
            : lead
          : `${picked.length} memories`;
      await w.createMemoryShare({
        title,
        items: picked.map((m) => ({
          id: m.id,
          text: m.text,
          tags: m.tags,
          ts: m.ts,
          facet: m.facet,
          tier: m.tier,
          origin: m.origin,
        })),
        recipient,
      });
      s.setShares(await w.listMyShares());
      setShareSel(new Set());
      setShareRecipient("");
      flash(
        `Shared ${picked.length} ${
          picked.length === 1 ? "memory" : "memories"
        } with ${recipient}.`,
      );
    } catch (err) {
      setShareErr(err instanceof Error ? err.message : String(err));
    } finally {
      setShareBusy(false);
    }
  }

  // Pull the memories others have shared with me again, freshest first.
  async function refreshShared() {
    const w = walletState?.wallet;
    if (!w) return;
    setSharedRefreshing(true);
    try {
      s.setSharedMemories(await w.loadSharedWithMe());
      s.setShares(await w.listMyShares());
    } catch (err) {
      flash(err instanceof Error ? err.message : String(err));
    } finally {
      setSharedRefreshing(false);
    }
  }

  // Claim a SuiNS subname under cortex.sui and set it as the account handle.
  async function claimUsername() {
    const w = walletState?.wallet;
    const name = username.trim();
    if (!w || !name) return;
    setClaimBusy(true);
    setClaimErr("");
    try {
      const result = await w.claimUsername(name);
      setClaimedName(result.name);
      try {
        localStorage.setItem("cortex-username", result.name);
      } catch {}
      flash(`Claimed ${result.name}.`);
    } catch (err) {
      setClaimErr(err instanceof Error ? err.message : String(err));
    } finally {
      setClaimBusy(false);
    }
  }

  // Retire a whole share I created; refresh the outbox so its status updates.
  async function revokeShare(shareId: string) {
    const w = walletState?.wallet;
    if (!w) return;
    setRevokingShareId(shareId);
    try {
      await w.revokeShare(shareId);
      s.setShares(await w.listMyShares());
      flash("Revoked.");
    } catch (err) {
      flash(err instanceof Error ? err.message : String(err));
    } finally {
      setRevokingShareId(null);
    }
  }

  // Collapse the inline share form whenever the drawer opens a different memory.
  useEffect(() => {
    setShareOpen(false);
    setShareErr("");
    setShareRecipient("");
  }, [drawer]);

  useEffect(() => {
    if (!settingsOpen) return;
    void loadDelegates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsOpen, walletState?.wallet]);

  useEffect(() => {
    if (!settingsOpen) return;
    void refreshBalances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsOpen, walletState?.address]);

  // Dreams (offline insight pass) power the wide carousel on the overview. Fetch
  // once, lazily, when the overview is in view and there's enough to reflect on.
  useEffect(() => {
    if (!s.ready || view !== "home" || dreamsTried.current) return;
    const mems = s.live();
    if (mems.length < 2) return;
    if (s.chat.length > 0 && s.mode === "ask") return;
    dreamsTried.current = true;
    setDreamsLoading(true);
    fetch("/api/dream", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ memories: mems.slice(0, 40) }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.dreams)) setDreams(d.dreams);
      })
      .catch(() => {})
      .finally(() => setDreamsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, s.ready]);

  useEffect(() => {
    if (view === "knowledge" && s.mode === "remember") s.setMode("ask");
  }, [view, s.mode, s]);

  function toggleChatRail() {
    setChatRailOpen((o) => {
      const n = !o;
      try {
        localStorage.setItem("cortex-chatrail", n ? "1" : "0");
      } catch {}
      return n;
    });
  }

  const live = s.live();
  const now = Date.now();
  const cfg = s.config;
  const memState = (m: Memory): MemState => stateOf(m, now, cfg);
  const STATE_LABEL: Record<MemState, string> = {
    pinned: "kept",
    core: "core",
    active: "active",
    fading: "fading",
    forgotten: "out of mind",
    purged: "purged",
  };
  const grow = (el: HTMLTextAreaElement | null) => {
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 220) + "px";
    }
  };

  function submit() {
    if (s.mode === "ask") {
      if (!input.trim()) return;
      s.ask(input);
      setInput("");
      grow(ta.current);
    } else {
      if (!input.trim()) return;
      const text = input;
      s.remember(text, s.importance);
      if (wallet)
        void wallet
          .remember(text)
          .catch((err) =>
            flash(
              `Saved locally; Walrus memory failed: ${(err as Error).message}`,
            ),
          );
      setInput("");
      grow(ta.current);
      flash(
        s.importance === "high"
          ? "Kept close."
          : "Kept. Cortex will look after it.",
      );
    }
  }
  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }
  function onFiles(files: FileList | null) {
    if (!files) return;
    [...files].forEach((f) => {
      s.attachDoc(f.name);
      if (wallet) void storeFileLive(f);
      if (
        /\.(txt|md|markdown|csv|json|log)$/i.test(f.name) ||
        f.type.startsWith("text")
      ) {
        const r = new FileReader();
        r.onload = () => {
          const n = s.ingestText(String(r.result || ""), f.name);
          flash(`Kept ${n} ${n === 1 ? "memory" : "memories"} from ${f.name}`);
        };
        r.readAsText(f);
      } else {
        s.remember(`From “${f.name}”, a file kept for reference.`, "normal");
      }
    });
    if (fileRef.current) fileRef.current.value = "";
  }

  const hasChat = s.chat.length > 0 && s.mode === "ask";
  const sav = computeSavings(live, s.cost);

  const SETTINGS_NAV: [SettingsSection, string, React.ReactNode][] = [
    [
      "account",
      "Account",
      <g key="i">
        <circle cx="12" cy="8" r="3.4" />
        <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
      </g>,
    ],
    [
      "profile",
      "Profile",
      <g key="i">
        <circle cx="12" cy="7" r="3.2" />
        <path d="M5 20a7 7 0 0 1 14 0" />
        <path d="M16 4.5l1.4-1.4 2 2L18 6.5" />
      </g>,
    ],
    [
      "models",
      "Models & API keys",
      <path
        key="i"
        d="M14 7a4 4 0 1 0-3.4 6L7 16.6V20h3.4l.6-2h2l.6-2 .8-.8A4 4 0 0 0 14 7zm2.6 1.4h.01"
      />,
    ],
    [
      "privacy",
      "Privacy & Access",
      <path key="i" d="M12 3l7 3v5c0 4.4-3 8.3-7 9.5C8 19.3 5 15.4 5 11V6z" />,
    ],
    [
      "username",
      "Username & sharing",
      <path
        key="i"
        d="M12 8a4 4 0 1 0 2.5 7.1M12 8a4 4 0 0 1 4 4v1.2a2 2 0 0 1-4 0V8"
      />,
    ],
    [
      "devices",
      "Devices & Access",
      <g key="i">
        <rect x="3" y="4" width="18" height="12" rx="1.5" />
        <path d="M8 20h8M12 16v4" />
      </g>,
    ],
    [
      "memory",
      "Memory model",
      <g key="i">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
      </g>,
    ],
    [
      "reset",
      "Reset memory",
      <path key="i" d="M4 12a8 8 0 1 1 2.3 5.6M4 12V7M4 12h5" />,
    ],
  ];

  const NAV: [View, string, React.ReactNode][] = [
    [
      "home",
      "Home",
      <path
        key="i"
        d="M3 11l9-8 9 8M5 10v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10"
      />,
    ],
    [
      "memories",
      "Memories",
      <>
        <path key="a" d="M12 3 3 8l9 5 9-5-9-5z" />
        <path key="b" d="M3 13l9 5 9-5" />
      </>,
    ],
    [
      "brain",
      "Brain",
      <>
        <circle key="a" cx="6" cy="7" r="2.2" />
        <circle key="b" cx="18" cy="8" r="2.2" />
        <circle key="c" cx="12" cy="17.5" r="2.2" />
        <path key="d" d="M8 7.6l8 .8M7.4 9l3.6 6.6M16.4 9.6l-3.4 6" />
      </>,
    ],
    [
      "agents",
      "Agents",
      <>
        <circle key="a" cx="9" cy="7" r="3" />
        <circle key="b" cx="17" cy="9" r="2.4" />
        <path
          key="c"
          d="M3 20a6 6 0 0 1 12 0M14.5 14.5a4.5 4.5 0 0 1 6.5 4.1"
        />
      </>,
    ],
    [
      "knowledge",
      "Knowledge",
      <>
        <path
          key="a"
          d="M3 5a17 17 0 0 1 9 2 17 17 0 0 1 9-2v13a17 17 0 0 0-9 2 17 17 0 0 0-9-2z"
        />
        <path key="b" d="M12 7v13" />
      </>,
    ],
    [
      "studio",
      "Studio",
      <>
        <path
          key="a"
          d="M12 3l1.7 4.6L18 9l-4.3 1.4L12 15l-1.7-4.6L6 9l4.3-1.4z"
        />
        <path
          key="b"
          d="M19 15l.7 2L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7z"
        />
      </>,
    ],
    [
      "integrations",
      "Integrations",
      <>
        <rect key="a" x="3" y="3" width="7" height="7" rx="1.5" />
        <rect key="b" x="14" y="3" width="7" height="7" rx="1.5" />
        <rect key="c" x="3" y="14" width="7" height="7" rx="1.5" />
        <rect key="d" x="14" y="14" width="7" height="7" rx="1.5" />
      </>,
    ],
  ];

  // knowledge: sources (documents) + recommendations (plain, computed after the ready gate)
  const sources = (() => {
    const by: Record<string, Memory[]> = {};
    live.forEach((m) => {
      if (
        m.source &&
        m.source !== "note" &&
        m.source !== "reflection" &&
        !m.blobId
      )
        (by[m.source] ||= []).push(m);
    });
    return Object.entries(by).map(([name, mems]) => ({ name, mems }));
  })();
  // Files stored on Walrus (KbFile nodes synced from chain).
  const walrusFiles = live.filter((m) => m.blobId);
  // Overview stats (5-slide carousel) + the recent-memories carousel.
  const added24 = live.filter(
    (m) => now - (m.createdAt ?? m.ts) < 86_400_000,
  ).length;
  const added7 = live.filter(
    (m) => now - (m.createdAt ?? m.ts) < 7 * 86_400_000,
  ).length;
  const recentMems = [...live]
    .sort((a, b) => (b.createdAt ?? b.ts) - (a.createdAt ?? a.ts))
    .slice(0, 8);
  // Knowledge base cards — Walrus blobs + document sources, unified + filterable
  // by the general search bar in the top navigation.
  const ext = (n: string) => (n.split(".").pop() || "").toLowerCase();
  const kbItems = [
    ...walrusFiles.map((m) => {
      const e = (m.mime || "").toLowerCase();
      const badge = e.includes("pdf")
        ? "PDF"
        : e.includes("markdown") || e.includes("md")
          ? "MARKDOWN"
          : "WALRUS";
      return {
        id: m.id,
        walrus: true,
        shared: false,
        sharedBy: null as string | null,
        badge,
        key: "walrus" as "walrus" | "pdf" | "markdown" | "other" | "shared",
        title: m.text,
        desc: `${m.mime || "file"} · sealed on Walrus`,
        foot: m.url ? "Download" : "On Walrus",
        date: ago(m.ts),
        url: m.url ?? null,
        name: null as string | null,
        memIds: [m.id],
        body: m.text,
      };
    }),
    ...sources.map((src) => {
      const e = ext(src.name);
      const badge =
        e === "pdf"
          ? "PDF"
          : e === "md" || e === "markdown"
            ? "MARKDOWN"
            : e
              ? e.toUpperCase()
              : "TEXT";
      const key: "walrus" | "pdf" | "markdown" | "other" | "shared" =
        e === "pdf"
          ? "pdf"
          : e === "md" || e === "markdown"
            ? "markdown"
            : "other";
      return {
        id: "src:" + src.name,
        walrus: false,
        shared: false,
        sharedBy: null as string | null,
        badge,
        key,
        title: src.name,
        desc: src.mems[0]?.text || "",
        foot: `${src.mems.length} ${
          src.mems.length === 1 ? "memory" : "memories"
        }`,
        date: ago(Math.max(...src.mems.map((x) => x.ts))),
        url: null as string | null,
        name: src.name as string | null,
        memIds: src.mems.map((x) => x.id),
        body: src.mems.map((x) => x.text).join("\n\n"),
      };
    }),
    ...(() => {
      const by: Record<string, Memory[]> = {};
      s.sharedMemories.forEach((m) => {
        (by[m.sharedFrom || m.sharedBy || "shared"] ||= []).push(m);
      });
      return Object.entries(by).map(([gid, mems]) => {
        const owner = mems[0]?.sharedBy || "someone";
        const lead = mems[0]?.text || "";
        return {
          id: "shared:" + gid,
          walrus: false,
          shared: true,
          sharedBy: owner as string | null,
          badge: "SHARED",
          key: "shared" as "walrus" | "pdf" | "markdown" | "other" | "shared",
          title:
            mems.length === 1
              ? lead.length > 60
                ? lead.slice(0, 60) + "…"
                : lead
              : `${mems.length} memories from ${owner}`,
          desc: lead,
          foot: `${mems.length} ${mems.length === 1 ? "memory" : "memories"}`,
          date: ago(Math.max(...mems.map((x) => x.ts))),
          url: null as string | null,
          name: null as string | null,
          memIds: mems.map((x) => x.id),
          body: mems.map((x) => x.text).join("\n\n"),
        };
      });
    })(),
  ];
  const kbFiltered = kbItems.filter(
    (it) =>
      (kbFilter === "all" || it.key === kbFilter) &&
      (it.title + " " + it.desc).toLowerCase().includes(query.toLowerCase()),
  );
  const downloadKb = (it: {
    url: string | null;
    title: string;
    body: string;
  }) => {
    const a = document.createElement("a");
    if (it.url) {
      a.href = it.url;
      a.download = it.title || "download";
      a.target = "_blank";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }
    const url = URL.createObjectURL(
      new Blob([it.body || it.title], { type: "text/plain" }),
    );
    a.href = url;
    a.download = (it.title || "memory") + ".txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };
  // studio
  const studioSelected =
    studioSel ??
    new Set(live.filter((m) => m.kept || m.noticed).map((m) => m.id));
  const studioMems = live.filter((m) => studioSelected.has(m.id));
  const studioPreview = compilePrompt(studioStyle, studioType, {
    task: studioTask,
    memories: studioMems,
    modality: studioModality,
  });
  const studioKey = [
    studioStyle,
    studioType,
    studioModality,
    studioTask,
    [...studioSelected].sort().join(","),
  ].join("|");
  const studioFresh = studioResult?.key === studioKey ? studioResult : null;
  const studioOut = studioFresh?.text ?? studioPreview;
  async function generateStudio() {
    setStudioLoading(true);
    const key = studioKey;
    try {
      const res = await fetch("/api/studio", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          task: studioTask,
          memories: studioMems,
          style: studioStyle,
          type: studioType,
          modality: studioModality,
          model: s.model.name,
          web: s.web,
        }),
      });
      const data = await res.json();
      setStudioResult({ key, text: data.prompt, ai: !!data.ai });
      flash(
        data.ai
          ? "Generated with AI"
          : "Generated locally — set ANTHROPIC_API_KEY for AI",
      );
    } catch {
      flash("Generation failed");
    } finally {
      setStudioLoading(false);
    }
  }
  function openStudioProduct(p: {
    name: string;
    url: string;
    prefill?: boolean;
  }) {
    navigator.clipboard?.writeText(studioOut);
    const href = p.prefill
      ? p.url + encodeURIComponent(studioOut.slice(0, 1400))
      : p.url;
    window.open(href, "_blank", "noopener,noreferrer");
    setStudioMenu(false);
    flash(`Copied your prompt — opening ${p.name}`);
  }
  const toggleStudio = (id: string) => {
    const next = new Set(studioSelected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setStudioSel(next);
  };

  // integrations: MCP clients, storage backends, import sources
  const CORTEX_MCP_URL = process.env.NEXT_PUBLIC_CORTEX_MCP_URL || "";
  const hostedMcp = CORTEX_MCP_URL.length > 0;
  const CORTEX_MCP_CMD = "pnpm --filter cortex-mcp start";
  const mcpSnippet = (kind: "url" | "cli" | "config") =>
    kind === "url"
      ? hostedMcp
        ? CORTEX_MCP_URL
        : "A hosted Cortex connector is coming soon. For now use a stdio client below — it runs the Cortex MCP server locally over stdio."
      : kind === "cli"
        ? `claude mcp add cortex -- ${CORTEX_MCP_CMD}`
        : JSON.stringify(
            {
              mcpServers: {
                cortex: {
                  command: "pnpm",
                  args: ["--filter", "cortex-mcp", "start"],
                },
              },
            },
            null,
            2,
          );
  const SNIPPET_LABEL: Record<"url" | "cli" | "config", string> = {
    url: hostedMcp ? "Your Cortex connector URL" : "Hosted connector (coming soon)",
    cli: "Run this once (stdio)",
    config: "Add to your MCP config (stdio)",
  };
  const MCP_TOOL_GROUPS: {
    label: string;
    blurb: string;
    tools: { name: string; desc: string }[];
  }[] = [
    {
      label: "Memory",
      blurb: "Read, write and consolidate your durable memory.",
      tools: [
        { name: "recall", desc: "Recall memories from your namespace, verified first." },
        { name: "remember", desc: "Write a durable memory." },
        { name: "ingest", desc: "Ingest a note or document and extract memories from it." },
        { name: "forget", desc: "De-index a memory — the record stays on Walrus, recall stops surfacing it." },
        { name: "consolidate", desc: "Review and merge memory into a committed diff." },
        { name: "verify", desc: "Check every blob is fetchable from the public aggregator." },
        { name: "timeline", desc: "Walk the version history of your namespace." },
        { name: "digest", desc: "Summarize a period of your memory." },
      ],
    },
    {
      label: "Agents",
      blurb: "Drive the researcher, curator, planner and critic team over a shared board and bus.",
      tools: [
        { name: "agents", desc: "List the specialist agents that share this memory." },
        { name: "task-create", desc: "Open a task and assign it to an agent." },
        { name: "task-handoff", desc: "Reassign a task so another agent continues it." },
        { name: "run-step", desc: "Run one collaborative step — recall, reason, record." },
        { name: "message", desc: "Post to or read the durable agent message bus." },
      ],
    },
    {
      label: "Your data",
      blurb: "Read by an MCP you authorize, revocable anytime.",
      tools: [
        { name: "profile", desc: "Read your public on-chain account, once you authorize it." },
        { name: "memory", desc: "Recall your distilled memory facts." },
        { name: "context", desc: "Read your durable context — sessions, events, docs." },
      ],
    },
    {
      label: "Execution",
      blurb: "Act directly on Walrus and Sui under the server wallet.",
      tools: [
        { name: "store-blob", desc: "Store raw bytes on Walrus." },
        { name: "read-blob", desc: "Fetch a raw Walrus blob by id." },
        { name: "record-pointer", desc: "Record a namespace → manifest pointer on Sui." },
        { name: "restore", desc: "Restore the full namespace head and memories from MemWal." },
      ],
    },
    {
      label: "Connectors",
      blurb: "Bridge Cortex to the web and other services.",
      tools: [
        { name: "web-fetch", desc: "Fetch a URL into context, optionally as memory." },
        { name: "notify", desc: "Push events to a Slack, Discord or Zapier webhook." },
        { name: "export", desc: "Export a portable JSON bundle of your memory." },
      ],
    },
  ];
  const MCP_TOOL_COUNT = MCP_TOOL_GROUPS.reduce((n, g) => n + g.tools.length, 0);
  const MCP_CLIENTS: {
    key: string;
    name: string;
    kind: "url" | "cli" | "config";
    blurb: string;
    overview: string;
    steps: string[];
  }[] = [
    {
      key: "chatgpt",
      name: "ChatGPT",
      kind: "url",
      blurb:
        "Reach your Cortex memory from ChatGPT — and let every chat build it.",
      overview:
        "Cortex becomes a connector inside ChatGPT. Every prompt can read your durable memory, and once the connector is authorized each chat quietly writes back what's worth keeping — no copy-paste between conversations, no context lost when a thread ends.",
      steps: [
        "In ChatGPT, open Settings → Connectors (enable developer mode if prompted).",
        "Choose “Add connector” and pick a custom MCP server.",
        "Paste your Cortex connector URL below, then authorize the connection.",
        "Just chat — Cortex reads your prompts over MCP and grows your memory on its own.",
      ],
    },
    {
      key: "claude",
      name: "Claude",
      kind: "url",
      blurb:
        "Add Cortex as a connector in Claude to recall and write memory in any chat.",
      overview:
        "Add Cortex to Claude once and your memory travels with you across every chat. Recall what you've kept, write new memories mid-conversation, and let the agent team work the same shared context.",
      steps: [
        "In Claude, open Settings → Connectors → Add custom connector.",
        "Paste your Cortex connector URL below.",
        "Click Connect and approve the Cortex tools.",
        "Ask Claude to recall or keep anything — it flows straight through your memory.",
      ],
    },
    {
      key: "claude-code",
      name: "Claude Code",
      kind: "cli",
      blurb:
        "Your conventions, decisions and project context, remembered in the CLI.",
      overview:
        "Your conventions, decisions and project context live in Cortex and surface in the CLI. Claude Code reads and writes the same memory as the rest of your tools, so a choice made once is remembered everywhere.",
      steps: [
        "Open a terminal in the project you work in.",
        "Run the command below to register Cortex as an MCP server.",
        "Restart Claude Code — the Cortex tools appear automatically.",
      ],
    },
    {
      key: "cursor",
      name: "Cursor",
      kind: "config",
      blurb: "Persistent memory and MCP tools inside the editor.",
      overview:
        "Cortex memory and tools sit inside the editor. The agent recalls your past decisions and keeps new ones as it works, grounded in the same context as your other assistants.",
      steps: [
        "Open Cursor → Settings → MCP.",
        "Add a new server and paste the config below.",
        "Reload Cursor — Cortex tools are now available to the agent.",
      ],
    },
    {
      key: "vscode",
      name: "VS Code",
      kind: "config",
      blurb: "Bring Cortex memory into Copilot Chat and MCP-aware extensions.",
      overview:
        "Bring Cortex into Copilot Chat and any MCP-aware extension. Memory you've kept becomes available to the model, and new context flows back into the same durable store.",
      steps: [
        "Open the MCP servers view, or your settings JSON.",
        "Add the Cortex server config below.",
        "Reload the window to connect.",
      ],
    },
    {
      key: "codex",
      name: "Codex",
      kind: "config",
      blurb: "Persistent memory for the Codex CLI.",
      overview:
        "Persistent memory for the Codex CLI. Cortex tools load on start, so Codex can recall and refine the same memory plane your other tools share.",
      steps: [
        "Open your Codex MCP configuration.",
        "Add the Cortex server config below.",
        "Restart Codex to load the tools.",
      ],
    },
    {
      key: "windsurf",
      name: "Windsurf",
      kind: "config",
      blurb: "Cortex memory and tools inside Windsurf.",
      overview:
        "Cortex memory and tools inside Windsurf. The agent works from your kept context and writes new memories back to the same shared store.",
      steps: [
        "Open Windsurf → Settings → MCP / Plugins.",
        "Add the Cortex server config below.",
        "Reload to connect.",
      ],
    },
    {
      key: "cline",
      name: "Cline",
      kind: "config",
      blurb: "Give Cline a durable memory across sessions.",
      overview:
        "Give Cline a durable memory across sessions. It recalls what you've kept and records new context to the same Walrus-backed store as the rest of Cortex.",
      steps: [
        "Open Cline’s MCP settings.",
        "Add the Cortex server config below.",
        "Reload to connect.",
      ],
    },
  ];
  const clientLogo = (key: string) => {
    const inner: Record<string, React.ReactNode> = {
      chatgpt: (
        <>
          <path d="M12 2l8.5 4.9v9.8L12 22l-8.5-4.9V6.9z" />
          <circle cx="12" cy="12" r="3.2" />
        </>
      ),
      claude: <path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4" />,
      "claude-code": (
        <>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M7 10l3 2.5L7 15M12.5 15.5H16" />
        </>
      ),
      cursor: (
        <>
          <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" />
          <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
        </>
      ),
      vscode: (
        <>
          <path d="M16 3l5 2.5v13L16 21 4 12z" />
          <path d="M16 3v18" />
        </>
      ),
      codex: (
        <path d="M9 5H7a2 2 0 0 0-2 2v3l-2 2 2 2v3a2 2 0 0 0 2 2h2M15 5h2a2 2 0 0 1 2 2v3l2 2-2 2v3a2 2 0 0 1-2 2h-2" />
      ),
      windsurf: <path d="M5 20h14M7 20V5l10 9z" />,
      cline: (
        <>
          <rect x="4" y="5" width="16" height="13" rx="3" />
          <circle cx="9.5" cy="11" r="1" />
          <circle cx="14.5" cy="11" r="1" />
          <path d="M9 15h6" />
        </>
      ),
    };
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {inner[key] ?? (
          <path d="M9 2v6M15 2v6M6 8h12v3a6 6 0 0 1-12 0zM12 17v5" />
        )}
      </svg>
    );
  };
  const SOURCES = [
    {
      key: "files",
      letter: "F",
      name: "Local files",
      desc: "Drop notes, PDFs and markdown. Cortex reads them and keeps what matters.",
      action: "add",
    },
    {
      key: "notes",
      letter: "N",
      name: "Quick notes",
      desc: "Write a thought straight into memory from the composer.",
      action: "remember",
    },
    {
      key: "web",
      letter: "We",
      name: "Web search",
      desc: "Pull live answers into context, cited, when you ask.",
      action: "web",
    },
  ];
  const FRAMEWORKS = [
    {
      key: "langchain",
      letter: "L",
      name: "LangChain",
      desc: "Pull your taste-tuned prompt and memories into any LangChain agent or chain, and write new memories back.",
      overview:
        "Pull your taste-tuned prompt and kept memories into any LangChain agent or chain, then write new memories back as the agent learns — all grounded in the same durable store as the rest of Cortex.",
      steps: [
        "Install the Cortex memory package alongside LangChain.",
        "Set CORTEX_API_KEY from your account to connect your managed Cortex.",
        "Pull your taste-tuned prompt and recall memory inside any chain.",
        "Write new memories back as the agent learns.",
      ],
      code: [
        "# pip install cortex-memory langchain",
        "from cortex_memory import CortexMemory",
        "",
        "# connects to your managed Cortex — set CORTEX_API_KEY",
        "mem = CortexMemory()",
        "",
        "# taste-retained system prompt, grounded in what you've kept",
        'system = mem.prompt(format="role")',
        "",
        "# read + refine memory from inside a chain",
        'context = mem.recall("what do I know about this?")',
        'mem.remember("user prefers concise answers", kept=True)',
      ].join("\n"),
    },
    {
      key: "skills",
      letter: "sh",
      name: "skills.sh",
      desc: "Install Cortex skills and prompts into your agents, and let them recall, correct and refine memory on the fly.",
      overview:
        "Install Cortex skills and prompts into your agents, then let them recall, correct and refine memory on the fly — the same memory you keep on Walrus, sealed and owned by you.",
      steps: [
        "Add the Cortex skill to your agent with one command.",
        "Authenticate with your Cortex account.",
        "Call recall, remember, correct and prompt from any run.",
      ],
      code: [
        "# add the Cortex skill to your agent",
        "npx skills.sh add cortex-memory",
        "",
        "# exposes: recall · remember · correct · prompt(format)",
        'skills run cortex-memory recall "upcoming travel"',
        "skills run cortex-memory prompt --format json",
      ].join("\n"),
    },
  ];
  function intConnect(key: string) {
    setIntOpen(key);
  }
  function copyText(text: string, label = "Setup copied to clipboard") {
    navigator.clipboard?.writeText(text);
    flash(label);
  }
  const detailClient = MCP_CLIENTS.find((cl) => cl.key === intOpen);
  const detailFw = FRAMEWORKS.find((cl) => cl.key === intOpen);
  const openDetail = detailClient
    ? {
        name: detailClient.name,
        blurb: detailClient.blurb,
        overview: detailClient.overview,
        steps: detailClient.steps,
        av: clientLogo(detailClient.key),
        avLetter: null as string | null,
        snippetLabel: SNIPPET_LABEL[detailClient.kind],
        snippet: mcpSnippet(detailClient.kind),
        connectLabel:
          detailClient.kind === "url"
            ? "Copy connector URL"
            : detailClient.kind === "cli"
              ? "Copy command"
              : "Copy config",
      }
    : detailFw
      ? {
          name: detailFw.name,
          blurb: detailFw.desc,
          overview: detailFw.overview,
          steps: detailFw.steps,
          av: null as React.ReactNode,
          avLetter: detailFw.letter,
          snippetLabel: "Add to your project",
          snippet: detailFw.code,
          connectLabel: "Copy code",
        }
      : null;

  // local zkLogin-style session: an ephemeral keypair generated in-browser.
  // Live testnet zkLogin needs a Google OAuth client id, a salt service and a prover.
  function startSession(via: string) {
    const bytes = new Uint8Array(32);
    window.crypto.getRandomValues(bytes);
    const addr =
      "0x" + [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    const sess = { addr, via };
    setSession(sess);
    try {
      localStorage.setItem("cortex-session", JSON.stringify(sess));
    } catch {}
    flash("Signed in with a local ephemeral session.");
  }
  function endSession() {
    setSession(null);
    try {
      localStorage.removeItem("cortex-session");
    } catch {}
    flash("Signed out.");
  }

  // When Privy is configured the account comes from a managed Sui wallet; the
  // local ephemeral session is the fallback for the keyless mock.
  const privyOn = !!walletState;
  const wallet = walletState?.wallet ?? null;

  async function runStep(taskId: string) {
    setRunningTaskId(taskId);
    try {
      await s.runAgentStep(taskId);
    } finally {
      setRunningTaskId(null);
    }
  }
  // Auto-run a task like a chat thread: keep stepping until the user stops it,
  // the task is marked done, or a safety cap is reached.
  const AUTO_STEP_CAP = 8;
  async function autoRunTask(taskId: string) {
    if (autoTaskId) return;
    autoStop.current = false;
    setAutoTaskId(taskId);
    try {
      for (let i = 0; i < AUTO_STEP_CAP; i++) {
        if (autoStop.current) break;
        await runStep(taskId);
        const t = useCortex.getState().tasks.find((x) => x.id === taskId);
        if (!t || t.status === "done") break;
      }
    } finally {
      setAutoTaskId(null);
    }
  }
  async function sendRoomMessage() {
    const text = input.trim();
    if (!text) return;
    const st = useCortex.getState();
    const roster = st.agents;
    const mentioned = roster.find((a) =>
      new RegExp(`@${a.name}\\b`, "i").test(text),
    );
    if (!mentioned && agMode === "ask") {
      s.ask(text);
      setInput("");
      grow(ta.current);
      return;
    }
    if (!mentioned && agMode === "remember") {
      s.remember(text, s.importance);
      if (wallet)
        void wallet
          .remember(text)
          .catch((err) =>
            flash(`Saved locally; Walrus memory failed: ${(err as Error).message}`),
          );
      setInput("");
      grow(ta.current);
      flash(
        s.importance === "high"
          ? "Kept close."
          : "Kept. Cortex will look after it.",
      );
      return;
    }
    const roomTask = roomTaskId
      ? st.tasks.find((t) => t.id === roomTaskId)
      : undefined;
    const assignee =
      mentioned?.id ??
      roomTask?.assignedTo ??
      (roster.some((a) => a.id === agentAssignee)
        ? agentAssignee
        : roster[0]!.id);
    const id = s.createTask(text, assignee);
    setInput("");
    grow(ta.current);
    if (id) {
      setAgentAssignee(assignee);
      setRoomTaskId(id);
      await autoRunTask(id);
    }
  }
  function createAgentFromForm() {
    const name = agName.trim();
    if (!name) return;
    const id = s.addAgent({
      name,
      role: agRole,
      accent: agAccent,
      blurb: agBlurb,
    });
    if (id) {
      setAgentAssignee(id);
      flash(`${name} joined the team.`);
    }
    setAgName("");
    setAgBlurb("");
    setAgRole("researcher");
    setAgAccent(ACCENTS[0]!);
    setAgModalOpen(false);
  }
  function commitRename(id: string) {
    const next = agRenameVal.trim();
    if (next) s.renameAgent(id, next);
    setAgRenameId(null);
    setAgRenameVal("");
  }
  async function replyInThread() {
    const id = threadTaskId;
    if (!id) return;
    const text = threadReply.trim();
    setThreadReply("");
    const mentioned = text
      ? useCortex
          .getState()
          .agents.find((a) => new RegExp(`@${a.name}\\b`, "i").test(text))
      : undefined;
    if (mentioned) s.handoffTask(id, mentioned.id);
    await autoRunTask(id);
  }
  async function makeLoopFromStudio() {
    const goal = studioTask.trim();
    if (!goal || loopBusy) return;
    setLoopBusy(true);
    flash("Reading memory to write the loop…");
    try {
      const id = await s.generateLoop(goal, AGENTS[0]!.id);
      if (id) {
        s.startLoop(id);
        setView("agents");
        flash("Loop running on the Agents page.");
      }
    } finally {
      setLoopBusy(false);
    }
  }
  function saveFinding(taskId: string, obsId: string) {
    const text = s.saveObservationAsMemory(taskId, obsId);
    if (text && wallet) void wallet.remember(text).catch(() => {});
    flash(text ? "Saved to shared memory." : "Nothing to save.");
  }
  async function toggleDictation() {
    if (dictation.recording) {
      const text = await dictation.stop();
      if (text) {
        setInput((v) => (v ? v + " " : "") + text);
        grow(ta.current);
      } else flash("Couldn't transcribe — set OPENAI_API_KEY for voice.");
    } else {
      try {
        await dictation.start();
      } catch (e) {
        flash((e as Error).message || "Microphone unavailable");
      }
    }
  }
  const sess = privyOn
    ? walletState.authenticated && walletState.address
      ? { addr: walletState.address, via: "Privy" }
      : null
    : session;
  function doSignIn() {
    if (walletState) walletState.login();
    else startSession("Google");
  }
  function doSignOut() {
    if (walletState) walletState.logout();
    else endSession();
  }
  function seedProfileToMemory(profile: UserProfile) {
    const texts = s.seedProfileMemories(profile);
    if (wallet)
      texts.forEach((t) => void wallet.remember(t).catch(() => {}));
    return texts.length;
  }
  function completeOnboarding(profile: UserProfile) {
    s.saveProfile(profile);
    const n = seedProfileToMemory(profile);
    s.setOnboarded(true);
    setOnboardOpen(false);
    flash(
      n
        ? `Welcome. Seeded ${n} ${n === 1 ? "memory" : "memories"} about you.`
        : "Welcome to Cortex.",
    );
  }
  function skipOnboarding(profile: UserProfile) {
    if (profileAnsweredCount(profile) > 0) s.saveProfile(profile);
    s.setOnboarded(true);
    setOnboardOpen(false);
  }
  function openProfileSettings() {
    setProfileDraft({ ...s.profile });
    setProfileSaved(false);
    openSettings("profile");
  }
  function saveProfileEdits() {
    const prev = s.profile;
    const fresh: UserProfile = {};
    Object.entries(profileDraft).forEach(([k, v]) => {
      if (v?.trim() && !prev[k]?.trim()) fresh[k] = v;
    });
    s.saveProfile(profileDraft);
    const n = Object.keys(fresh).length ? seedProfileToMemory(fresh) : 0;
    setProfileSaved(true);
    flash(
      n
        ? `Profile saved · ${n} new ${n === 1 ? "memory" : "memories"}.`
        : "Profile saved.",
    );
  }
  async function storeFileLive(file: File) {
    if (!wallet) return;
    flash(`Storing ${file.name} on Walrus…`);
    try {
      const stored = await wallet.storeFile(file);
      flash(`Stored ${file.name} on Walrus · ${stored.blobId.slice(0, 10)}…`);
      wallet
        .listFiles()
        .then((files) => s.syncFiles(files))
        .catch(() => {});
    } catch (err) {
      flash(`Walrus upload failed: ${(err as Error).message}`);
    }
  }

  // settings: tier table rows
  const TIERS: Tier[] = [0, 1, 2, 3, 4];
  const fmtDays = (n: number) =>
    n === Infinity
      ? "never"
      : n >= 365
        ? Math.round(n / 365) + "y"
        : n >= 30
          ? Math.round(n / 30) + "mo"
          : n + "d";

  const memCard = (m: Memory) => {
    const selected = shareSel.has(m.id);
    return (
      <div
        className={"mcard" + (selected ? " selected" : "")}
        key={m.id}
        onClick={() => setDrawer(m)}
      >
        {!m.shared && (
          <button
            className={"mcard-check" + (selected ? " on" : "")}
            onClick={(e) => {
              e.stopPropagation();
              setShareSel((prev) => {
                const next = new Set(prev);
                if (next.has(m.id)) next.delete(m.id);
                else next.add(m.id);
                return next;
              });
            }}
            aria-label={selected ? "Deselect memory" : "Select memory to share"}
          >
            <svg viewBox="0 0 24 24">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </button>
        )}
        <div className="mtext">{m.text}</div>
        <div className="mfoot">
          {m.shared && (
            <span className="chip shared">
              <span className="dot" />
              shared{m.sharedBy ? ` · ${m.sharedBy}` : ""}
            </span>
          )}
          {(() => {
            if (m.shared) return null;
            const st = memState(m);
            return st === "core" ? (
              <span className="chip core">
                <span className="dot" />
                core
              </span>
            ) : st === "pinned" ? (
              <span className="chip kept">
                <span className="dot" />
                kept
              </span>
            ) : st === "fading" ? (
              <span className="chip fading">
                <span className="dot" />
                fading
              </span>
            ) : st === "forgotten" ? (
              <span className="chip gone">
                <span className="dot" />
                out of mind
              </span>
            ) : m.noticed ? (
              <span className="chip noticed">
                <span className="dot" />
                noticed
              </span>
            ) : null;
          })()}
          {m.tags.map((t) => (
            <span className="mtag" key={t}>
              {t}
            </span>
          ))}
          <span className="mwhen">{ago(m.ts)}</span>
        </div>
      </div>
    );
  };

  // Memories others shared with me sit alongside my own in the Memories view,
  // newest first, but never mingle with my own retention model (see the store).
  const brainMemories = [...live, ...s.sharedMemories].sort(
    (a, b) => b.ts - a.ts,
  );
  const q = query.trim().toLowerCase();
  const memList = brainMemories.filter((m) => {
    const hay = (m.text + " " + m.tags.join(" ")).toLowerCase();
    return (
      (memFilter === "all" ||
        (memFilter === "__shared" ? !!m.shared : m.tags.includes(memFilter))) &&
      hay.includes(q)
    );
  });
  // Cross-page fallback: how many memories / documents match the global search,
  // so an empty page can point you to where the matches actually live.
  const memMatchCount = q
    ? brainMemories.filter((m) =>
        (m.text + " " + m.tags.join(" ")).toLowerCase().includes(q),
      ).length
    : 0;
  const docMatchCount = q
    ? kbItems.filter((it) =>
        (it.title + " " + it.desc).toLowerCase().includes(q),
      ).length
    : 0;
  const sharedCount = brainMemories.filter((m) => m.shared).length;
  const tags = [...new Set(brainMemories.flatMap((m) => m.tags))];
  const byokPickerModels = s.customModels.map((m) => ({
    name: m.label,
    prov: providerInfo(m.provider).label,
    price: "BYOK",
    desc: `${providerInfo(m.provider).label} · your key`,
  }));
  const modelList = [...MODELS, ...byokPickerModels].filter((m) =>
    (m.name + " " + m.prov).toLowerCase().includes(modelSearch.toLowerCase()),
  );
  const openAddModel = () => {
    setAmProvider("");
    setAmApiId("");
    setAmKey("");
    setAmUrl("");
    setAmError("");
    setAddModelOpen(true);
  };
  const baseFromUrl = (u: string) =>
    u.replace(/\/+$/, "").replace(/\/(chat\/completions|messages)$/, "");
  const submitAddModel = async () => {
    if (!amProvider || !amApiId || !amKey.trim()) {
      setAmError("Provider, model and API key are required.");
      return;
    }
    const info = providerInfo(amProvider);
    const spec = providerModels(amProvider).find((x) => x.apiId === amApiId);
    const model: CustomModel = {
      id: customModelId(amProvider, amApiId),
      label: spec ? spec.name : amApiId,
      provider: amProvider,
      apiId: amApiId,
      baseUrl: amUrl.trim() ? baseFromUrl(amUrl.trim()) : info.baseUrl,
      createdAt: Date.now(),
    };
    setAmBusy(true);
    setAmError("");
    try {
      await s.addCustomModel(model, amKey.trim());
      s.setModel(model.label);
      setAddModelOpen(false);
    } catch (err) {
      setAmError((err as Error).message);
    } finally {
      setAmBusy(false);
    }
  };

  const onHome = view === "home";
  const railOn = onHome && chatRailOpen;
  return (
    <div
      className={
        "app" + (onHome ? " home-rail" : "") + (railOn ? " rail-expanded" : "")
      }
    >
      <header className="topbar">
        <div className="topbar-inner">
          <div className="tb-left">
            <a
              className="tb-brand"
              href="#home"
              onClick={() => setView("home")}
            >
              <span className="mark">{MARK}</span>
              <b>Cortex</b>
            </a>
          </div>
          <div className="tb-center">
            <button
              className={"tb-icon" + (view === "home" ? " on" : "")}
              onClick={() => setView("home")}
              aria-label="Home"
              title="Home"
            >
              <svg viewBox="0 0 24 24">
                <path d="M3 11l9-8 9 8M5 10v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10" />
              </svg>
            </button>
            <nav className="tb-nav" aria-label="Primary">
              {NAV.filter(([v]) => v !== "home").map(([v, label, icon]) => (
                <a
                  key={v}
                  className={"tb-item" + (view === v ? " on" : "")}
                  href={`#${v}`}
                  onClick={() => setView(v)}
                >
                  <svg viewBox="0 0 24 24">{icon}</svg>
                  <span>{label}</span>
                </a>
              ))}
            </nav>
            <button
              className={"tb-icon" + (railOn ? " on" : "")}
              onClick={() => {
                if (!onHome) setView("home");
                toggleChatRail();
              }}
              aria-label="Chat"
              title="Chat"
            >
              <svg viewBox="0 0 24 24">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </button>
          </div>
          <div className="tb-right">
            <button className="tb-add" onClick={() => setCaptureOpen(true)}>
              <svg viewBox="0 0 24 24">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add memory
            </button>
            <div className="tb-profile" ref={profileRef}>
              <button
                className={"tb-you" + (profileOpen ? " on" : "")}
                onClick={() => setProfileOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={profileOpen}
                aria-label="Account"
              >
                <span className="avatar">
                  {(walletState?.label?.[0] ?? "G").toUpperCase()}
                </span>
              </button>
              {profileOpen && (
                <div className="tb-menu" role="menu">
                  <div className="tb-menu-head">
                    <span className="avatar">
                      {(walletState?.label?.[0] ?? "G").toUpperCase()}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div className="nm">{walletState?.label ?? "Guest"}</div>
                      {sess && claimedName ? (
                        <a
                          className="you-handle"
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            openSettings("username");
                          }}
                        >
                          <span className="dot" />
                          {claimedName}
                        </a>
                      ) : sess ? (
                        <a
                          className="you-claim"
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            openSettings("username");
                          }}
                        >
                          Claim username
                        </a>
                      ) : (
                        <div className="sub">Free · just you</div>
                      )}
                    </div>
                  </div>
                  <button
                    className="tb-menu-item"
                    onClick={() => {
                      const n = eff === "dark" ? "light" : "dark";
                      setTheme(n);
                      try {
                        localStorage.setItem("cortex-theme", n);
                      } catch {}
                    }}
                  >
                    <svg viewBox="0 0 24 24">
                      {eff === "dark" ? (
                        <g>
                          <circle cx="12" cy="12" r="4.2" />
                          <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5 5l1.4 1.4M17.6 17.6L19 19M19 5l-1.4 1.4M6.4 17.6L5 19" />
                        </g>
                      ) : (
                        <path d="M20 14.5A8 8 0 1 1 9.5 4a6.3 6.3 0 0 0 10.5 10.5z" />
                      )}
                    </svg>
                    <span>{eff === "dark" ? "Light mode" : "Dark mode"}</span>
                  </button>
                  <button
                    className="tb-menu-item"
                    onClick={() => {
                      const n = !dev;
                      setDev(n);
                      try {
                        localStorage.setItem("cortex-dev", n ? "1" : "");
                      } catch {}
                    }}
                  >
                    <svg viewBox="0 0 24 24">
                      <path d="M8 3H7a2 2 0 0 0-2 2v3a2 2 0 0 1-2 2 2 2 0 0 1 2 2v3a2 2 0 0 0 2 2h1M16 3h1a2 2 0 0 1 2 2v3a2 2 0 0 0 2 2 2 2 0 0 0-2 2v3a2 2 0 0 1-2 2h-1" />
                    </svg>
                    <span style={{ flex: 1, textAlign: "left" }}>
                      Developer
                    </span>
                    <span className="dev-switch" />
                  </button>
                  <button
                    className="tb-menu-item"
                    onClick={openProfileSettings}
                  >
                    <svg viewBox="0 0 24 24">
                      <circle cx="12" cy="7" r="3.2" />
                      <path d="M5 20a7 7 0 0 1 14 0" />
                    </svg>
                    <span>Profile</span>
                  </button>
                  <button
                    className="tb-menu-item"
                    onClick={() => openSettings("account")}
                  >
                    <svg viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                    <span>Settings</span>
                  </button>
                  <a
                    className="tb-menu-item"
                    href={DOCS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setProfileOpen(false)}
                  >
                    <svg viewBox="0 0 24 24">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                    </svg>
                    <span>Docs</span>
                  </a>
                  {sess ? (
                    <button
                      className="tb-menu-item danger"
                      onClick={() => {
                        doSignOut();
                        setProfileOpen(false);
                      }}
                    >
                      <svg viewBox="0 0 24 24">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <path d="M16 17l5-5-5-5M21 12H9" />
                      </svg>
                      <span>Sign out</span>
                    </button>
                  ) : privyOn ? (
                    <button
                      className="tb-menu-item"
                      onClick={() => {
                        doSignIn();
                        setProfileOpen(false);
                      }}
                    >
                      <svg viewBox="0 0 24 24">
                        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                        <path d="M10 17l5-5-5-5M15 12H3" />
                      </svg>
                      <span>Sign in</span>
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <aside
        className={
          "chat-rail" + (onHome ? " on-home" : "") + (railOn ? " open" : "")
        }
        aria-hidden={!onHome}
      >
        <div className="cr-top">
          <button
            className="cr-icon"
            onClick={toggleChatRail}
            aria-label={chatRailOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            <svg viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M9 4v16" />
            </svg>
          </button>
        </div>
        <button className="cr-new" onClick={() => s.newSession()}>
          <svg viewBox="0 0 24 24">
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span>New chat</span>
        </button>
        <div className="cr-label">
          <span>Recents</span>
          <button className="cr-viewall" onClick={() => setView("memories")}>
            View all
          </button>
        </div>
        <div className="cr-recents">
          {s.sessions.length ? (
            s.sessions
              .filter(
                (se) =>
                  !query ||
                  (se.title || "New chat")
                    .toLowerCase()
                    .includes(query.toLowerCase()),
              )
              .map((se) => (
                <button
                  key={se.id}
                  className={"cr-item" + (se.id === s.activeId ? " on" : "")}
                  onClick={() => {
                    s.switchSession(se.id);
                    s.setMode("ask");
                    setView("home");
                  }}
                >
                  <span className="cr-node" aria-hidden="true" />
                  <span className="cr-item-t">{se.title || "New chat"}</span>
                </button>
              ))
          ) : (
            <div className="cr-empty">
              Your conversations will show up here. Start one below.
            </div>
          )}
        </div>
        <button
          className="cr-log"
          onClick={toggleChatRail}
          aria-expanded={chatRailOpen}
        >
          <span className="cr-log-l">
            <svg viewBox="0 0 24 24">
              <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
              <path d="M3 4v4h4M12 8v4l3 2" />
            </svg>
            <span className="cr-log-t">Chat History</span>
          </span>
          <svg className="cr-log-chev" viewBox="0 0 24 24">
            <path d="M6 15l6-6 6 6" />
          </svg>
        </button>
      </aside>

      <main className="main">
        <div className="wrap">
          {/* HOME */}
          <section className={"view" + (view === "home" ? " on" : "")}>
            {!hasChat ? (
              <div className="home-intro">
                <div className="ov-hero">
                  <h1 className="ov-hello">
                    Hello,{" "}
                    {claimedName
                      ? claimedName.split(/[.@]/)[0]
                      : username || "User"}
                    .
                  </h1>
                  <p className="ov-sub">
                    Cortex has processed{" "}
                    {(added24 || live.length).toLocaleString()}{" "}
                    {(added24 || live.length) === 1 ? "memory" : "memories"}{" "}
                    since your last session. Ready to expand your neural
                    workspace?
                  </p>
                </div>

                {live.length > 0 && (
                  <>
                    <div className="hc-duo">
                      <div className="hc-stat">
                        <div className="hc-label">
                          <svg className="hc-ico" viewBox="0 0 24 24">
                            <rect x="6" y="6" width="12" height="12" rx="2" />
                            <path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" />
                          </svg>
                          Total memories
                        </div>
                        <div className="hc-big">
                          {live.length.toLocaleString()}
                        </div>
                        <div className="hc-subs">
                          <div className="hc-sub">
                            <span className="hc-sub-k">Added Today</span>
                            <span className="hc-sub-v">+{added24}</span>
                          </div>
                          <div className="hc-sub">
                            <span className="hc-sub-k">Tokens Saved</span>
                            <span className="hc-sub-v">
                              {fmtTokens(sav.realizedTok)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="hc-reflect">
                        <div className="hc-label">
                          <svg className="hc-ico" viewBox="0 0 24 24">
                            <path d="M9 18h6M10 21h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.2 1 2h6c0-.8.4-1.5 1-2A7 7 0 0 0 12 2z" />
                          </svg>
                          Reflection
                        </div>
                        <p className="hc-insight">
                          {dreams[0]
                            ? `${dreams[0].title} — ${dreams[0].body}`
                            : dreamsLoading
                              ? "Cortex is looking across your memories for connections."
                              : `You've added ${added7} ${
                                  added7 === 1 ? "memory" : "memories"
                                } this week across ${live.length.toLocaleString()} total. Synthesize them into a clearer picture.`}
                        </p>
                        <button
                          className="hc-synth"
                          onClick={() => {
                            s.setMode("ask");
                            s.ask(
                              dreams[0]
                                ? `Synthesise what I know about this: ${dreams[0].title}. ${dreams[0].body}`
                                : "Synthesise the most important things I've stored recently into a clear summary.",
                            );
                          }}
                        >
                          Synthesize Now
                        </button>
                      </div>
                    </div>

                    <div className="hc-recent-head">
                      <h2 className="hc-recent-title">Recent Memories</h2>
                      <button
                        className="hc-viewall"
                        onClick={() => setView("memories")}
                      >
                        View All
                      </button>
                    </div>

                    <div className="hc-grid">
                      {recentMems.map((m) => {
                        const pinned = !!(m.kept || m.lock === "pinned");
                        const isFile = !!(m.blobId || m.mime);
                        const cat = pinned
                          ? "Pinned"
                          : m.tags[0]
                            ? m.tags[0]
                            : isFile
                              ? "File"
                              : "Memory";
                        const fileName =
                          (m.origin ? m.origin.split(/[\\/]/).pop() : null) ||
                          m.text.slice(0, 40) ||
                          "Untitled";
                        const fileMeta = (m.mime || "file").split("/").pop();
                        return (
                          <button
                            key={m.id}
                            className={"hc-card" + (pinned ? " pinned" : "")}
                            onClick={() => setDrawer(m)}
                          >
                            <div className="hc-card-top">
                              <span className="hc-tag">
                                {pinned && (
                                  <svg className="hc-heart" viewBox="0 0 24 24">
                                    <path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z" />
                                  </svg>
                                )}
                                {cat}
                              </span>
                              <span className="hc-ago">{ago(m.ts)}</span>
                            </div>
                            {isFile ? (
                              <div className="hc-file">
                                <span className="hc-file-ico">
                                  <svg viewBox="0 0 24 24">
                                    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                                    <path d="M14 3v5h5" />
                                  </svg>
                                </span>
                                <div className="hc-file-meta">
                                  <div className="hc-card-title">
                                    {fileName}
                                  </div>
                                  <div className="hc-file-sub">{fileMeta}</div>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="hc-card-title">{m.text}</div>
                                <div className="hc-card-snip">
                                  {m.note || m.content || m.text}
                                </div>
                              </>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="home-chat">
                {s.chat.map((m, i) => {
                  const pad = (n: number) => String(n).padStart(2, "0");
                  let mn = 0;
                  let kn = 0;
                  let wn = 0;
                  const items: SourceItem[] = [
                    ...m.sources
                      .filter((src) => src.type === "memory")
                      .map((src) => ({
                        kind: "memory" as const,
                        label: `Memory Source ${pad(++mn)}`,
                        title: src.text,
                      })),
                    ...m.docs.map((d) => ({
                      kind: "knowledge" as const,
                      label: `Knowledge Base ${pad(++kn)}`,
                      title: d,
                    })),
                    ...m.sources
                      .filter((src) => src.type === "web")
                      .map((src) => ({
                        kind: "web" as const,
                        label: `Web Search ${pad(++wn)}`,
                        title: src.title,
                        url: src.url ? `https://${src.url}` : undefined,
                      })),
                  ];
                  return (
                    <div className="cmsg" key={i}>
                      <div className="cmsg-q">
                        <div className="bubble-q">
                          {m.q}
                          {m.docs.length > 0 && (
                            <span className="q-docs">
                              {m.docs.map((d) => "📎 " + d).join(" ")}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="cmsg-a">
                        <span className="cmsg-av" aria-hidden="true">
                          <svg viewBox="0 0 24 24">
                            <path d="M13 2 4 14h6l-1 8 9-12h-6z" />
                          </svg>
                        </span>
                        <div className="cmsg-card">
                          <div className="atext">
                            {m.streaming ? m.a : <Markdown text={m.a} />}
                          </div>
                          {!m.streaming && <SourceChips sources={items} />}
                          {!m.streaming && (
                            <div className="cmsg-acts">
                              <button
                                className="cmsg-ic"
                                title="Copy"
                                aria-label="Copy"
                                onClick={() => {
                                  navigator.clipboard?.writeText(m.a);
                                  flash("Copied.");
                                }}
                              >
                                <svg viewBox="0 0 24 24">
                                  <rect
                                    x="9"
                                    y="9"
                                    width="11"
                                    height="11"
                                    rx="2"
                                  />
                                  <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                                </svg>
                              </button>
                              {readAloud.supported && m.a && (
                                <button
                                  className="cmsg-ic"
                                  title={
                                    readAloud.speaking ? "Stop" : "Read aloud"
                                  }
                                  aria-label="Read aloud"
                                  onClick={() =>
                                    readAloud.speaking
                                      ? readAloud.stop()
                                      : readAloud.speak(m.a)
                                  }
                                >
                                  {readAloud.speaking ? (
                                    <svg viewBox="0 0 24 24">
                                      <rect
                                        x="6"
                                        y="6"
                                        width="12"
                                        height="12"
                                        rx="2"
                                      />
                                    </svg>
                                  ) : (
                                    <svg viewBox="0 0 24 24">
                                      <path d="M7 5l11 7-11 7z" />
                                    </svg>
                                  )}
                                </button>
                              )}
                              <button
                                className={
                                  "cmsg-ic" + (m.rating === "up" ? " on" : "")
                                }
                                title="Good response"
                                aria-label="Good response"
                                onClick={() => s.rateChat(i, "up")}
                              >
                                <svg viewBox="0 0 24 24">
                                  <path d="M7 11v9H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1zM7 11l4-8a2 2 0 0 1 2 2v4h5.5a2 2 0 0 1 2 2.4l-1.2 6A2 2 0 0 1 17.3 20H7" />
                                </svg>
                              </button>
                              <button
                                className={
                                  "cmsg-ic" + (m.rating === "down" ? " on" : "")
                                }
                                title="Bad response"
                                aria-label="Bad response"
                                onClick={() => s.rateChat(i, "down")}
                              >
                                <svg viewBox="0 0 24 24">
                                  <path d="M17 13V4h3a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1zM17 13l-4 8a2 2 0 0 1-2-2v-4H5.5a2 2 0 0 1-2-2.4l1.2-6A2 2 0 0 1 6.7 4H17" />
                                </svg>
                              </button>
                              <button
                                className="cmsg-ic"
                                title="Regenerate"
                                aria-label="Regenerate"
                                disabled={!m.q}
                                onClick={() => m.q && s.ask(m.q)}
                              >
                                <svg viewBox="0 0 24 24">
                                  <path d="M21 12a9 9 0 1 1-3-6.7M21 4v4h-4" />
                                </svg>
                              </button>
                              <span className="cmsg-model">
                                {m.model}
                                {m.savedNote && (
                                  <span className="ask-saved">
                                    {" · "}
                                    {m.savedNote}
                                  </span>
                                )}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* MEMORIES + LOOKING BACK */}
          <section className={"view" + (view === "memories" ? " on" : "")}>
            <div className="rr-head">
              <h1 className="h1">Your memories</h1>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div className="seg-toggle">
                  <button
                    className={"seg-btn" + (memTab === "cards" ? " on" : "")}
                    onClick={() => setMemTab("cards")}
                  >
                    <svg viewBox="0 0 24 24">
                      <rect x="3" y="3" width="7" height="7" rx="1.5" />
                      <rect x="14" y="3" width="7" height="7" rx="1.5" />
                      <rect x="3" y="14" width="7" height="7" rx="1.5" />
                      <rect x="14" y="14" width="7" height="7" rx="1.5" />
                    </svg>
                    Grid
                  </button>
                  <button
                    className={"seg-btn" + (memTab === "timeline" ? " on" : "")}
                    onClick={() => setMemTab("timeline")}
                  >
                    <svg viewBox="0 0 24 24">
                      <path d="M3 17l5-6 4 4 4-7 5 6" />
                    </svg>
                    Timeline
                  </button>
                </div>
                <button
                  className="pill-btn keep"
                  onClick={() => setCaptureOpen(true)}
                >
                  + Build memory
                </button>
              </div>
            </div>
            {shareSel.size > 0 && (
              <div className="sel-bar">
                <span className="sel-n">{shareSel.size} selected</span>
                <button
                  className="sel-clear"
                  onClick={() => setShareSel(new Set())}
                >
                  Clear
                </button>
                <div className="sel-actions">
                  <button className="sel-act" onClick={bulkKeepClose}>
                    Keep close
                  </button>
                  <button className="sel-act" onClick={bulkSetAside}>
                    Set aside
                  </button>
                  <button className="sel-act danger" onClick={bulkForget}>
                    Delete
                  </button>
                  <button
                    className="pill-btn keep"
                    onClick={() => setShareHubOpen(true)}
                  >
                    Share
                  </button>
                </div>
              </div>
            )}

            {memTab === "cards" ? (
              <>
                <div className="filters" style={{ marginTop: 16 }}>
                  {["all", ...tags].map((f) => (
                    <button
                      key={f}
                      className={"fchip" + (memFilter === f ? " on" : "")}
                      onClick={() => setMemFilter(f)}
                    >
                      {f === "all" ? "Everything" : f}
                    </button>
                  ))}
                  {sharedCount > 0 && (
                    <button
                      className={
                        "fchip shared" + (memFilter === "__shared" ? " on" : "")
                      }
                      onClick={() => setMemFilter("__shared")}
                    >
                      Shared · {sharedCount}
                    </button>
                  )}
                </div>
                <div className="cards">
                  {memList.length ? (
                    memList.map(memCard)
                  ) : q ? (
                    <div className="empty">
                      <div className="et">No memories match “{query}”</div>
                      {docMatchCount > 0 ? (
                        <>
                          <div className="es">
                            But {docMatchCount}{" "}
                            {docMatchCount === 1 ? "document" : "documents"}{" "}
                            match. Were you looking in your knowledge base?
                          </div>
                          <button
                            className="pill-btn keep"
                            style={{ marginTop: 14 }}
                            onClick={() => setView("knowledge")}
                          >
                            View {docMatchCount} in Knowledge
                          </button>
                        </>
                      ) : (
                        <div className="es">
                          Nothing in memories or documents matched. Try a
                          different word.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="empty">
                      <div className="et">Nothing here yet</div>
                      <div className="es">Try a different word.</div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="story" style={{ marginTop: 8 }}>
                {[...s.events]
                  .sort((a, b) => b.ts - a.ts)
                  .map((ev) => (
                    <div
                      key={ev.id}
                      className={
                        "snode" +
                        (ev.warm || ev.type === "reflect" ? " warm" : "")
                      }
                    >
                      <div className="when">
                        {ev.type === "start" ? "the beginning" : ago(ev.ts)}
                      </div>
                      <div className="scard">
                        <div className="st">{ev.t}</div>
                        {ev.sub && <div className="ssub">{ev.sub}</div>}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </section>

          {/* AGENTS — Pipeline Room: a Slack-style room where agents are members */}
          {view === "agents" &&
            (() => {
              const roster = s.agents;
              const byId = (id: string) => roster.find((a) => a.id === id);
              const rosterNames = roster.map((a) => a.name);
              const tasks = [...s.tasks].sort(
                (a, b) => b.createdAt - a.createdAt,
              );
              const room =
                (roomTaskId && tasks.find((t) => t.id === roomTaskId)) ||
                tasks[0] ||
                null;
              const thread = threadTaskId
                ? (tasks.find((t) => t.id === threadTaskId) ?? null)
                : null;
              const runningId = autoTaskId ?? runningTaskId;
              const agentStatus = (id: string) => {
                if (
                  tasks.some((t) => t.assignedTo === id && t.id === runningId)
                )
                  return "working";
                if (
                  tasks.some((t) => t.assignedTo === id && t.status !== "done")
                )
                  return "active";
                return "idle";
              };
              const taskPct = (t: (typeof tasks)[number]) =>
                t.status === "done"
                  ? 100
                  : t.status === "blocked"
                    ? 35
                    : Math.min(20 + t.observations.length * 22, 92);
              const roomAgents = room
                ? roster.filter(
                    (a) =>
                      a.id === room.assignedTo ||
                      room.observations.some((o) => o.agentId === a.id),
                  )
                : [];
              const youInitials = (walletState?.label ?? "You")
                .slice(0, 2)
                .toUpperCase();
              return (
                <div className="pr-shell">
                  <aside
                    className={"pr-rail" + (roomRailOpen ? " open" : "")}
                  >
                    <div className="pr-rail-body">
                      <button
                        className="pr-new"
                        onClick={() => {
                          setRoomTaskId(null);
                          setThreadTaskId(null);
                          setAgMode("task");
                          ta.current?.focus();
                        }}
                      >
                        <svg viewBox="0 0 24 24">
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                        New task room
                      </button>
                      <div className="pr-side-scroll">
                        <div className="pr-grp">
                          <button
                            className="pr-grp-toggle"
                            onClick={() => setSecRooms((v) => !v)}
                            aria-expanded={secRooms}
                          >
                            <svg
                              className={"pr-caret" + (secRooms ? " open" : "")}
                              viewBox="0 0 24 24"
                            >
                              <path d="M9 6l6 6-6 6" />
                            </svg>
                            <span className="pr-grp-l">Task Rooms</span>
                          </button>
                          {tasks.length > ROOM_PREVIEW_CAP && secRooms && (
                            <button
                              className="pr-viewall"
                              onClick={() => setRoomsExpanded((v) => !v)}
                            >
                              {roomsExpanded ? "Show less" : "View all"}
                            </button>
                          )}
                        </div>
                        {secRooms && (
                          <>
                            {tasks.length === 0 && (
                              <div className="pr-side-empty">
                                No rooms yet. @mention an agent below.
                              </div>
                            )}
                            {(roomsExpanded
                              ? tasks
                              : tasks.slice(0, ROOM_PREVIEW_CAP)
                            ).map((t) => (
                              <button
                                key={t.id}
                                className={
                                  "pr-room" + (room?.id === t.id ? " on" : "")
                                }
                                onClick={() => setRoomTaskId(t.id)}
                              >
                                <span
                                  className={
                                    "pr-room-dot" +
                                    (room?.id === t.id ? " on" : "")
                                  }
                                />
                                <span className="pr-hash">#</span>
                                <span className="pr-room-name">
                                  {roomSlug(t.goal)}
                                </span>
                                {t.observations.length > 0 && (
                                  <span className="pr-room-badge">
                                    {t.observations.length}
                                  </span>
                                )}
                              </button>
                            ))}
                          </>
                        )}

                        <div className="pr-grp">
                          <button
                            className="pr-grp-toggle"
                            onClick={() => setSecAgents((v) => !v)}
                            aria-expanded={secAgents}
                          >
                            <svg
                              className={"pr-caret" + (secAgents ? " open" : "")}
                              viewBox="0 0 24 24"
                            >
                              <path d="M9 6l6 6-6 6" />
                            </svg>
                            <span className="pr-grp-l">
                              Agents · {roster.length}
                            </span>
                          </button>
                          <button
                            className="pr-add-agent"
                            onClick={() => setAgModalOpen(true)}
                            aria-label="Create agent"
                            title="Create agent"
                          >
                            <svg viewBox="0 0 24 24">
                              <path d="M12 5v14M5 12h14" />
                            </svg>
                          </button>
                        </div>
                        {secAgents &&
                          roster.map((a) => {
                            const st = agentStatus(a.id);
                            const custom = !isBuiltInAgent(a.id);
                            return (
                              <div className="pr-member" key={a.id}>
                                <span
                                  className="pr-av"
                                  style={{ background: a.accent, color: "#fff" }}
                                >
                                  {a.name.slice(0, 2).toUpperCase()}
                                  <span className={"pr-presence " + st} />
                                </span>
                                <div className="pr-member-m">
                                  {agRenameId === a.id ? (
                                    <input
                                      className="pr-rename-input"
                                      value={agRenameVal}
                                      autoFocus
                                      onChange={(e) =>
                                        setAgRenameVal(e.target.value)
                                      }
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") commitRename(a.id);
                                        if (e.key === "Escape")
                                          setAgRenameId(null);
                                      }}
                                      onBlur={() => commitRename(a.id)}
                                    />
                                  ) : (
                                    <div className="pr-member-n">{a.name}</div>
                                  )}
                                  <div className="pr-member-r">
                                    {ROLE_LABELS[a.role]}
                                  </div>
                                </div>
                                <div className="pr-member-acts">
                                  <button
                                    className="pr-member-ic"
                                    aria-label={`Mention ${a.name}`}
                                    title={`@${a.name}`}
                                    onClick={() => {
                                      setInput((v) =>
                                        v && !v.endsWith(" ")
                                          ? `${v} @${a.name} `
                                          : `${v}@${a.name} `,
                                      );
                                      ta.current?.focus();
                                    }}
                                  >
                                    @
                                  </button>
                                  {custom && (
                                    <>
                                      <button
                                        className="pr-member-ic"
                                        aria-label={`Rename ${a.name}`}
                                        title="Rename"
                                        onClick={() => {
                                          setAgRenameId(a.id);
                                          setAgRenameVal(a.name);
                                        }}
                                      >
                                        <svg viewBox="0 0 24 24">
                                          <path d="M4 20h4l10-10-4-4L4 16z" />
                                        </svg>
                                      </button>
                                      <button
                                        className="pr-member-ic danger"
                                        aria-label={`Remove ${a.name}`}
                                        title="Remove"
                                        onClick={() => s.removeAgent(a.id)}
                                      >
                                        <svg viewBox="0 0 24 24">
                                          <path d="M6 6l12 12M18 6L6 18" />
                                        </svg>
                                      </button>
                                    </>
                                  )}
                                  {!custom && (
                                    <span className={"pr-status " + st}>
                                      {st}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}

                        <div className="pr-grp">
                          <span className="pr-grp-l">Direct</span>
                        </div>
                        <div className="pr-member">
                          <span className="pr-av human">{youInitials}</span>
                          <div className="pr-member-m">
                            <div className="pr-member-n">You</div>
                            <div className="pr-member-r">director</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <button
                      className="pr-rail-toggle"
                      onClick={() => setRoomRailOpen((v) => !v)}
                      aria-expanded={roomRailOpen}
                    >
                      <span className="pr-rail-l">
                        <svg viewBox="0 0 24 24">
                          <circle cx="9" cy="7" r="3" />
                          <circle cx="17" cy="9" r="2.4" />
                          <path d="M3 20a6 6 0 0 1 12 0M14.5 14.5a4.5 4.5 0 0 1 6.5 4.1" />
                        </svg>
                        <span className="pr-rail-t">Agents &amp; rooms</span>
                        <span className="pr-rail-count">{roster.length}</span>
                      </span>
                      <svg className="pr-rail-chev" viewBox="0 0 24 24">
                        <path d="M6 15l6-6 6 6" />
                      </svg>
                    </button>
                  </aside>

                  <div className="pr-main">
                    <div className="pr-chan-head">
                      <div className="pr-chan-id">
                        <span className="pr-hash">#</span>
                        <b>{room ? roomSlug(room.goal) : "no-room"}</b>
                        {room && (
                          <span className="pr-chan-topic">{room.goal}</span>
                        )}
                      </div>
                      <div className="pr-chan-tools">
                        <div className="pr-stack">
                          {roomAgents.map((a) => (
                            <span
                              key={a.id}
                              className="pr-av xs"
                              title={a.name}
                            >
                              {a.name.slice(0, 2).toUpperCase()}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="pr-feed">
                      {!room && (
                        <div className="pr-feed-empty">
                          No task rooms yet. @mention an agent in the box below
                          to queue the first task.
                        </div>
                      )}
                      {room && (
                        <>
                          <div className="pr-day">Today</div>
                          <div className="pr-msg">
                            <span className="pr-av human">{youInitials}</span>
                            <div className="pr-msg-body">
                              <div className="pr-msg-head">
                                <b>You</b>
                                <span className="pr-time">
                                  {clock(room.createdAt)}
                                </span>
                              </div>
                              <div className="pr-msg-text">
                                {renderMessageText(
                                    "@" +
                                      (byId(room.assignedTo)?.name ?? "team") +
                                      " " +
                                      room.goal,
                                    rosterNames,
                                  )}
                              </div>
                            </div>
                          </div>

                          {room.observations.map((o) => {
                            const oa = byId(o.agentId);
                            return (
                              <div className="pr-msg" key={o.id}>
                                <span className="pr-av">
                                  {(oa?.name ?? "??").slice(0, 2).toUpperCase()}
                                </span>
                                <div className="pr-msg-body">
                                  <div className="pr-msg-head">
                                    <b>{oa?.name ?? "Agent"}</b>
                                    {oa?.role && (
                                      <span className="pr-tag">{oa.role}</span>
                                    )}
                                    <span className="pr-time">
                                      {clock(o.ts)}
                                    </span>
                                  </div>
                                  <div className="pr-msg-text">
                                    <Markdown text={o.text} />
                                  </div>
                                  {o.memoryRefs && o.memoryRefs.length > 0 && (
                                    <SourceChips
                                      sources={o.memoryRefs.map((id, n) => ({
                                        kind: "memory" as const,
                                        label: `Memory Source ${String(
                                          n + 1,
                                        ).padStart(2, "0")}`,
                                        title: s.memories.find(
                                          (mm) => mm.id === id,
                                        )?.text,
                                      }))}
                                    />
                                  )}
                                  <button
                                    className="pr-save"
                                    onClick={() => saveFinding(room.id, o.id)}
                                  >
                                    Save to memory
                                  </button>
                                </div>
                              </div>
                            );
                          })}

                          <div className="pr-msg">
                            <span className="pr-av">
                              {(byId(room.assignedTo)?.name ?? "??")
                                .slice(0, 2)
                                .toUpperCase()}
                            </span>
                            <div className="pr-msg-body">
                              <div className="pr-msg-head">
                                <b>
                                  {byId(room.assignedTo)?.name ?? "Agent"}
                                </b>
                                <span className="pr-sysline">
                                  opened a task
                                </span>
                              </div>
                              <div className="pr-taskcard">
                                <div className="pr-tc-top">
                                  <span className="pr-tc-ic">
                                    <svg viewBox="0 0 24 24">
                                      <path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                                    </svg>
                                  </span>
                                  <span className="pr-tc-label">TASK</span>
                                  <span
                                    className={
                                      "pr-pill " +
                                      (room.status === "done"
                                        ? "done"
                                        : room.status === "blocked"
                                          ? "blocked"
                                          : "prog")
                                    }
                                  >
                                    {room.status.replace("_", " ")}
                                  </span>
                                  <span className="pr-tc-id">
                                    {taskCode(room.id)}
                                  </span>
                                </div>
                                <div className="pr-tc-title">{room.goal}</div>
                                <div className="pr-tc-assign">
                                  Assigned to{" "}
                                  <span className="pr-av xs">
                                    {(byId(room.assignedTo)?.name ?? "??")
                                      .slice(0, 2)
                                      .toUpperCase()}
                                  </span>{" "}
                                  {byId(room.assignedTo)?.name}
                                </div>
                                <div className="pr-tc-foot">
                                  <span className="pr-priority">
                                    <svg viewBox="0 0 24 24">
                                      <path d="M4 21V4h12l-2 4 2 4H6" />
                                    </svg>
                                    {room.status === "blocked"
                                      ? "Blocked"
                                      : "High priority"}
                                  </span>
                                  <button
                                    className="pr-openthread"
                                    onClick={() => setThreadTaskId(room.id)}
                                  >
                                    Open thread →
                                  </button>
                                </div>
                              </div>
                              {room.observations.length > 0 && (
                                <button
                                  className="pr-replies"
                                  onClick={() => setThreadTaskId(room.id)}
                                >
                                  <span className="pr-replies-avs">
                                    {roomAgents.slice(0, 3).map((a) => (
                                      <span key={a.id} className="pr-av xs">
                                        {a.name.slice(0, 2).toUpperCase()}
                                      </span>
                                    ))}
                                  </span>
                                  <span className="pr-replies-n">
                                    {room.observations.length}
                                    {room.observations.length === 1
                                      ? " reply"
                                      : " replies"}
                                  </span>
                                  <span className="pr-replies-t">
                                    last reply {ago(room.updatedAt)}
                                  </span>
                                </button>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="pr-composer">
                      <div className="capture pr-capture" ref={composerRef}>
                        <div className="ask-docs">
                          {s.docs.map((d, i) => (
                            <span className="ask-doc" key={i}>
                              <svg viewBox="0 0 24 24">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <path d="M14 2v6h6" />
                              </svg>
                              {d}
                              <button
                                className="adx"
                                onClick={() => s.removeDoc(i)}
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                        <textarea
                          ref={ta}
                          rows={1}
                          placeholder={
                            agMode === "ask"
                              ? "Ask anything about your shared memory…"
                              : agMode === "remember"
                                ? "Write a fact into the team's shared memory…"
                                : room
                                  ? `Message #${roomSlug(room.goal)}, or @mention an agent`
                                  : "Message the team, or @mention an agent to queue a task"
                          }
                          value={input}
                          onChange={(e) => {
                            setInput(e.target.value);
                            grow(e.target);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              void sendRoomMessage();
                            }
                          }}
                        />
                        <div className="capture-bar">
                          <button
                            className="cap-tool icon"
                            onClick={() => fileRef.current?.click()}
                            aria-label="Attach"
                          >
                            <svg viewBox="0 0 24 24">
                              <path d="M21.4 11 12 20.4a5.5 5.5 0 0 1-7.8-7.8l8.5-8.5a3.7 3.7 0 1 1 5.2 5.2l-8.5 8.5a1.8 1.8 0 1 1-2.6-2.6l7.8-7.8" />
                            </svg>
                          </button>
                          <button
                            className="cap-tool icon"
                            aria-label="Mention an agent"
                            title="Mention an agent"
                            onClick={() => {
                              setInput((v) =>
                                v && !v.endsWith(" ") ? v + " @" : v + "@",
                              );
                              ta.current?.focus();
                            }}
                          >
                            <svg viewBox="0 0 24 24">
                              <circle cx="12" cy="12" r="4" />
                              <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" />
                            </svg>
                          </button>
                          <div className="mode-toggle pr-mode">
                            <button
                              className={agMode === "task" ? "on" : ""}
                              onClick={() => setAgMode("task")}
                            >
                              <svg viewBox="0 0 24 24">
                                <path d="M9 11l3 3L20 6M20 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" />
                              </svg>
                              Task
                            </button>
                            <button
                              className={agMode === "ask" ? "on" : ""}
                              onClick={() => setAgMode("ask")}
                            >
                              <svg viewBox="0 0 24 24">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                              </svg>
                              Ask
                            </button>
                            <button
                              className={agMode === "remember" ? "on" : ""}
                              onClick={() => setAgMode("remember")}
                            >
                              <svg viewBox="0 0 24 24">
                                <path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6z" />
                              </svg>
                              Remember
                            </button>
                          </div>
                          <div className="cap-tail">
                            {agMode !== "remember" && (
                              <div className="model-anchor">
                                <button
                                  className="cap-tool model-chip"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setModelOpen((o) => !o);
                                  }}
                                >
                                  <span className="mdot" />
                                  <span>{s.model.name}</span>{" "}
                                  <span className="mchev">▾</span>
                                </button>
                                {modelOpen && (
                                  <div className="model-pop">
                                    <label className="mp-search">
                                      <svg viewBox="0 0 24 24">
                                        <circle cx="11" cy="11" r="7" />
                                        <path d="M21 21l-4.3-4.3" />
                                      </svg>
                                      <input
                                        placeholder="Search models…"
                                        value={modelSearch}
                                        onChange={(e) =>
                                          setModelSearch(e.target.value)
                                        }
                                        autoFocus
                                      />
                                    </label>
                                    <div className="mp-list">
                                      {modelList.map((m) => (
                                        <button
                                          key={m.name}
                                          className={
                                            "mp-item" +
                                            (m.name === s.model.name
                                              ? " on"
                                              : "")
                                          }
                                          onClick={() => {
                                            s.setModel(m.name);
                                            setModelOpen(false);
                                            const custom = s.customModels.find(
                                              (c) => c.label === m.name,
                                            );
                                            if (custom && !s.byokKeys[custom.id])
                                              s.unlockByok();
                                          }}
                                        >
                                          <span className="mp-av">
                                            {m.prov[0]}
                                          </span>
                                          <span className="mp-meta">
                                            <span className="mp-name">
                                              {m.name}
                                            </span>
                                            <span className="mp-desc">
                                              {m.prov} · {m.desc}
                                            </span>
                                          </span>
                                          {m.name === s.model.name && (
                                            <span className="mp-check">✓</span>
                                          )}
                                        </button>
                                      ))}
                                    </div>
                                    <button
                                      className="mp-add"
                                      onClick={() => {
                                        setModelOpen(false);
                                        openAddModel();
                                      }}
                                    >
                                      <span className="mp-add-ic">
                                        <svg viewBox="0 0 24 24">
                                          <path d="M12 5v14M5 12h14" />
                                        </svg>
                                      </span>
                                      <span className="mp-meta">
                                        <span className="mp-name">
                                          Add model
                                        </span>
                                        <span className="mp-desc">
                                          Bring your own API key
                                        </span>
                                      </span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                            {agMode !== "remember" && (
                              <button
                                className={
                                  "cap-tool icon web-chip" +
                                  (s.web ? " on" : "")
                                }
                                onClick={() => s.toggleWeb()}
                                title="Search the web"
                                aria-label="Search the web"
                              >
                                <svg viewBox="0 0 24 24">
                                  <circle cx="12" cy="12" r="9" />
                                  <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
                                </svg>
                              </button>
                            )}
                            {agMode === "remember" && (
                              <div className="imp-anchor">
                                <button
                                  className={
                                    "cap-tool imp-chip" + (impOpen ? " on" : "")
                                  }
                                  onClick={() => setImpOpen((o) => !o)}
                                  aria-haspopup="true"
                                  aria-expanded={impOpen}
                                >
                                  {s.importance === "low"
                                    ? "Passing"
                                    : s.importance === "normal"
                                      ? "Normal"
                                      : "Keep close"}
                                  <span className="mchev">▾</span>
                                </button>
                                {impOpen && (
                                  <div className="imp-pop">
                                    <div className="importance">
                                      {(["low", "normal", "high"] as const).map(
                                        (lv) => (
                                          <button
                                            key={lv}
                                            className={
                                              s.importance === lv ? "on" : ""
                                            }
                                            onClick={() => {
                                              s.setImportance(lv);
                                              setImpOpen(false);
                                            }}
                                          >
                                            {lv === "low"
                                              ? "Passing"
                                              : lv === "normal"
                                                ? "Normal"
                                                : "Keep close"}
                                          </button>
                                        ),
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                            {dictation.supported && (
                              <button
                                className={
                                  "cap-tool speak-tool" +
                                  (dictation.recording ? " on" : "")
                                }
                                onClick={() => void toggleDictation()}
                                disabled={dictation.busy}
                                title={
                                  dictation.recording
                                    ? "Stop and transcribe"
                                    : "Speak your prompt"
                                }
                              >
                                <svg viewBox="0 0 24 24">
                                  <rect x="9" y="3" width="6" height="11" rx="3" />
                                  <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
                                </svg>{" "}
                                {dictation.busy
                                  ? "…"
                                  : dictation.recording
                                    ? "Listening"
                                    : "Speak"}
                              </button>
                            )}
                            <button
                              className="cap-send"
                              disabled={!input.trim() || runningId !== null}
                              onClick={() => void sendRoomMessage()}
                              aria-label={
                                agMode === "ask"
                                  ? "Ask"
                                  : agMode === "remember"
                                    ? "Remember"
                                    : "Queue task"
                              }
                            >
                              <svg viewBox="0 0 24 24">
                                <path d="M12 19V5M5 12l7-7 7 7" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {thread && (
                    <aside className="pr-thread">
                      <div className="pr-thread-head">
                        <div className="pr-thread-crumb">
                          THREAD · {taskCode(thread.id)}
                        </div>
                        <button
                          className="pr-icon"
                          onClick={() => setThreadTaskId(null)}
                          aria-label="Close thread"
                        >
                          <svg viewBox="0 0 24 24">
                            <path d="M6 6l12 12M18 6L6 18" />
                          </svg>
                        </button>
                      </div>
                      <div className="pr-thread-scroll">
                        <div className="pr-thread-title">{thread.goal}</div>
                        <div className="pr-thread-meta">
                          <span
                            className={
                              "pr-pill " +
                              (thread.status === "done"
                                ? "done"
                                : thread.status === "blocked"
                                  ? "blocked"
                                  : "prog")
                            }
                          >
                            {thread.status.replace("_", " ")}
                          </span>
                          <span className="pr-av xs">
                            {(byId(thread.assignedTo)?.name ?? "??")
                              .slice(0, 2)
                              .toUpperCase()}
                          </span>
                          <span className="pr-thread-assignee">
                            {byId(thread.assignedTo)?.name}
                          </span>
                        </div>

                        <div className="pr-prog">
                          <div className="pr-prog-bar">
                            <span
                              style={{
                                width: taskPct(thread) + "%",
                                background: byId(thread.assignedTo)
                                  ?.accent,
                              }}
                            />
                          </div>
                          <div className="pr-prog-row">
                            <span>{thread.status.replace("_", " ")}</span>
                            <span>{taskPct(thread)}%</span>
                          </div>
                        </div>

                        {thread.observations.length === 0 && (
                          <div className="pr-side-empty">
                            No replies yet. Run a step below.
                          </div>
                        )}
                        {thread.observations.map((o) => {
                          const oa = byId(o.agentId);
                          return (
                            <div className="pr-tmsg" key={o.id}>
                              <span className="pr-av">
                                {(oa?.name ?? "??").slice(0, 2).toUpperCase()}
                              </span>
                              <div className="pr-msg-body">
                                <div className="pr-msg-head">
                                  <b>{oa?.name ?? "Agent"}</b>
                                  <span className="pr-time">{clock(o.ts)}</span>
                                </div>
                                <div className="pr-msg-text">
                                  <Markdown text={o.text} />
                                </div>
                                {o.memoryRefs && o.memoryRefs.length > 0 && (
                                  <SourceChips
                                    sources={o.memoryRefs.map((id, n) => ({
                                      kind: "memory" as const,
                                      label: `Memory Source ${String(
                                        n + 1,
                                      ).padStart(2, "0")}`,
                                      title: s.memories.find(
                                        (mm) => mm.id === id,
                                      )?.text,
                                    }))}
                                  />
                                )}
                              </div>
                            </div>
                          );
                        })}

                        <div className="pr-thread-acts">
                          {thread.status !== "done" && (
                            <button
                              className="pr-act"
                              disabled={runningId !== null}
                              onClick={() => void autoRunTask(thread.id)}
                            >
                              {runningId === thread.id
                                ? "Running…"
                                : "Run step"}
                            </button>
                          )}
                          {thread.status !== "done" && (
                            <button
                              className="pr-act"
                              onClick={() => s.completeTask(thread.id)}
                            >
                              Complete
                            </button>
                          )}
                          <div className="pr-assign">
                            <span className="pr-assign-l">Forward to</span>
                            <div className="pr-assign-sel">
                              <select
                                value=""
                                onChange={(e) => {
                                  if (e.target.value)
                                    s.handoffTask(thread.id, e.target.value);
                                }}
                              >
                                <option value="">Choose agent…</option>
                                {roster
                                  .filter((x) => x.id !== thread.assignedTo)
                                  .map((x) => (
                                    <option key={x.id} value={x.id}>
                                      @{x.name} · {ROLE_LABELS[x.role]}
                                    </option>
                                  ))}
                              </select>
                              <svg viewBox="0 0 24 24">
                                <path d="M6 9l6 6 6-6" />
                              </svg>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="pr-thread-reply">
                        <input
                          className="pr-input2"
                          placeholder="Reply in thread…"
                          value={threadReply}
                          onChange={(e) => setThreadReply(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void replyInThread();
                            }
                          }}
                        />
                        <button
                          className="pr-send sm"
                          disabled={runningId !== null}
                          onClick={() => void replyInThread()}
                          aria-label="Send reply"
                        >
                          <svg viewBox="0 0 24 24">
                            <path d="M12 19V5M5 12l7-7 7 7" />
                          </svg>
                        </button>
                      </div>
                    </aside>
                  )}
                </div>
              );
            })()}

          {/* STUDIO — compile memory into a prompt */}
          <section className={"view" + (view === "studio" ? " on" : "")}>
            <div className="st2">
              <div className="composer-dock">
                <div className="capture">
                  <textarea
                    rows={3}
                    placeholder={
                      studioMode === "loop"
                        ? "What should the loop work toward? e.g. keep my reading list summarized"
                        : "What do you need a prompt for? e.g. a hero image for my notes app"
                    }
                    value={studioTask}
                    onChange={(e) => setStudioTask(e.target.value)}
                  />
                  <div className="capture-bar studio-bar">
                    <button
                      className="cap-tool icon"
                      onClick={() => fileRef.current?.click()}
                      aria-label="Attach"
                    >
                      <svg viewBox="0 0 24 24">
                        <path d="M21.4 11 12 20.4a5.5 5.5 0 0 1-7.8-7.8l8.5-8.5a3.7 3.7 0 1 1 5.2 5.2l-8.5 8.5a1.8 1.8 0 1 1-2.6-2.6l7.8-7.8" />
                      </svg>
                    </button>
                    <div className="mode-toggle">
                      <button
                        className={studioMode === "prompt" ? "on" : ""}
                        onClick={() => setStudioMode("prompt")}
                      >
                        <svg viewBox="0 0 24 24">
                          <path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6z" />
                        </svg>
                        Prompt
                      </button>
                      <button
                        className={studioMode === "loop" ? "on" : ""}
                        onClick={() => setStudioMode("loop")}
                      >
                        <svg viewBox="0 0 24 24">
                          <path d="M3 12a9 9 0 1 1 3 6.7M3 21v-5h5" />
                        </svg>
                        Loop
                      </button>
                    </div>
                    <div className="st2-dd">
                      <button
                        className="st2-dd-btn"
                        onClick={() =>
                          setStudioDrop((d) =>
                            d === "modality" ? null : "modality",
                          )
                        }
                      >
                        <span className="st2-dd-k">For</span>
                        <span className="st2-dd-v">
                          {
                            MODALITIES.find((x) => x.id === studioModality)
                              ?.name
                          }
                        </span>
                        <span className="st2-dd-c">▾</span>
                      </button>
                      {studioDrop === "modality" && (
                        <div className="st2-dd-pop">
                          {MODALITIES.map((m) => (
                            <button
                              key={m.id}
                              className={
                                "st2-dd-item" +
                                (studioModality === m.id ? " on" : "")
                              }
                              onClick={() => {
                                setStudioModality(m.id);
                                setStudioDrop(null);
                              }}
                            >
                              <span className="st2-dd-name">{m.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="st2-dd">
                      <button
                        className="st2-dd-btn"
                        onClick={() =>
                          setStudioDrop((d) => (d === "style" ? null : "style"))
                        }
                      >
                        <span className="st2-dd-k">Style</span>
                        <span className="st2-dd-v">
                          {STYLES.find((x) => x.id === studioStyle)?.name}
                        </span>
                        <span className="st2-dd-c">▾</span>
                      </button>
                      {studioDrop === "style" && (
                        <div className="st2-dd-pop">
                          {STYLES.map((st) => (
                            <button
                              key={st.id}
                              className={
                                "st2-dd-item" +
                                (studioStyle === st.id ? " on" : "")
                              }
                              onClick={() => {
                                setStudioStyle(st.id);
                                setStudioDrop(null);
                              }}
                            >
                              <span className="st2-dd-name">{st.name}</span>
                              <span className="st2-dd-hint">{st.hint}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="st2-dd">
                      <button
                        className="st2-dd-btn"
                        onClick={() =>
                          setStudioDrop((d) => (d === "type" ? null : "type"))
                        }
                      >
                        <span className="st2-dd-k">Type</span>
                        <span className="st2-dd-v">
                          {TYPES.find((x) => x.id === studioType)?.name}
                        </span>
                        <span className="st2-dd-c">▾</span>
                      </button>
                      {studioDrop === "type" && (
                        <div className="st2-dd-pop">
                          {TYPES.map((ty) => (
                            <button
                              key={ty.id}
                              className={
                                "st2-dd-item" +
                                (studioType === ty.id ? " on" : "")
                              }
                              onClick={() => {
                                setStudioType(ty.id);
                                setStudioDrop(null);
                              }}
                            >
                              <span className="st2-dd-name">{ty.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="st2-dd">
                      <button
                        className="st2-dd-btn"
                        onClick={() =>
                          setStudioDrop((d) => (d === "model" ? null : "model"))
                        }
                      >
                        <span className="mdot" />
                        <span className="st2-dd-v">{s.model.name}</span>
                        <span className="st2-dd-c">▾</span>
                      </button>
                      {studioDrop === "model" && (
                        <div className="st2-dd-pop wide">
                          {MODELS.map((m) => (
                            <button
                              key={m.name}
                              className={
                                "st2-dd-item" +
                                (s.model.name === m.name ? " on" : "")
                              }
                              onClick={() => {
                                s.setModel(m.name);
                                setStudioDrop(null);
                              }}
                            >
                              <span className="st2-dd-name">
                                {m.name}{" "}
                                <span className="st2-dd-price">{m.price}</span>
                              </span>
                              <span className="st2-dd-hint">{m.desc}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      className={
                        "cap-tool icon web-chip" + (s.web ? " on" : "")
                      }
                      onClick={() => s.toggleWeb()}
                      title="Search the web"
                      aria-label="Search the web"
                    >
                      <svg viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
                      </svg>
                    </button>
                    <div className="cap-tail">
                      <button
                        className="st2-gen"
                        onClick={() =>
                          studioMode === "loop"
                            ? void makeLoopFromStudio()
                            : void generateStudio()
                        }
                        disabled={
                          studioMode === "loop"
                            ? loopBusy || !studioTask.trim()
                            : studioLoading
                        }
                        aria-label={
                          studioMode === "loop" ? "Generate loop" : "Generate"
                        }
                        title={
                          studioMode === "loop"
                            ? loopBusy
                              ? "Writing the loop…"
                              : "Write a self-correcting loop from this goal and your memory, then run it"
                            : studioLoading
                              ? "Generating…"
                              : "Generate a prompt from this task and your memory"
                        }
                      >
                        <svg viewBox="0 0 24 24">
                          <path d="M5 12h14M13 6l6 6-6 6" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  {studioDrop && (
                    <div
                      className="st2-dd-backdrop"
                      onClick={() => setStudioDrop(null)}
                    />
                  )}
                </div>
              </div>

              <div className="st2-scope">
                <span>
                  Grounded in <b>{studioMems.length}</b> of {live.length}{" "}
                  memories
                </span>
                <button
                  className="st2-link"
                  onClick={() => setStudioPick((p) => !p)}
                >
                  {studioPick ? "Hide" : "Choose"}
                </button>
                <button
                  className="st2-link"
                  onClick={() =>
                    setStudioSel(
                      studioMems.length === live.length
                        ? new Set()
                        : new Set(live.map((m) => m.id)),
                    )
                  }
                >
                  {studioMems.length === live.length ? "Clear" : "All"}
                </button>
              </div>
              {studioPick && (
                <div className="st2-mems">
                  {live.map((m) => (
                    <button
                      key={m.id}
                      className={
                        "st-mrow" + (studioSelected.has(m.id) ? " on" : "")
                      }
                      onClick={() => toggleStudio(m.id)}
                    >
                      <span className="st-box">
                        {studioSelected.has(m.id) ? "✓" : ""}
                      </span>
                      <span className="st-mbody">
                        <span className="st-mtext">{m.text}</span>
                        <span className="st-mmeta">
                          {m.tags[0]}
                          {m.kept ? " · kept close" : ""}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <div className="st2-output">
                <div className="st2-out-top">
                  <span className="st-tok">
                    ~{Math.round(studioOut.length / 4)} tokens
                  </span>
                </div>
                <div
                  className={
                    "st2-bubble" +
                    (CODE_TYPES.includes(studioType) ? " mono" : "") +
                    (studioLoading ? " loading" : "")
                  }
                >
                  {CODE_TYPES.includes(studioType) ? (
                    studioOut
                  ) : (
                    <Markdown text={studioOut} />
                  )}
                </div>
                <div className="st2-actions">
                  <div className="st2-copy">
                    <button
                      className="st2-copy-main"
                      onClick={() => {
                        navigator.clipboard?.writeText(studioOut);
                        flash("Prompt copied");
                      }}
                    >
                      <svg viewBox="0 0 24 24">
                        <rect x="9" y="9" width="11" height="11" rx="2" />
                        <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                      </svg>
                      Copy content
                    </button>
                    <button
                      className="st2-copy-chev"
                      onClick={() => setStudioMenu((o) => !o)}
                      aria-label="More options"
                    >
                      <svg viewBox="0 0 24 24">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                    {studioMenu && (
                      <div className="st2-menu">
                        <button
                          className="st2-menu-item"
                          onClick={() => {
                            navigator.clipboard?.writeText(
                              "```\n" + studioOut + "\n```",
                            );
                            setStudioMenu(false);
                            flash("Copied as Markdown");
                          }}
                        >
                          <span className="st2-menu-av">md</span>
                          <span className="st2-menu-tx">
                            <b>Copy as Markdown</b>
                            <span>Fenced, ready to paste into an LLM</span>
                          </span>
                        </button>
                        {STUDIO_PRODUCTS[studioModality].map((p) => (
                          <button
                            key={p.name}
                            className="st2-menu-item"
                            onClick={() => openStudioProduct(p)}
                          >
                            <span className="st2-menu-av">{p.name[0]}</span>
                            <span className="st2-menu-tx">
                              <b>Open in {p.name} ↗</b>
                              <span>Copies your prompt and opens it</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    className="st-act"
                    onClick={() => {
                      const t = TYPES.find((x) => x.id === studioType)!;
                      const file = `${studioStyle}-prompt.${t.ext}`;
                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(
                        new Blob([studioOut], { type: "text/plain" }),
                      );
                      a.download = file;
                      a.click();
                      flash("Downloaded " + file);
                    }}
                  >
                    Download
                  </button>
                </div>
              </div>
              {studioMenu && (
                <div
                  className="st2-dd-backdrop"
                  onClick={() => setStudioMenu(false)}
                />
              )}
            </div>
          </section>
          {/* KNOWLEDGE — document library (card grid) */}
          <section className={"view" + (view === "knowledge" ? " on" : "")}>
            <div className="kb2-bar">
              <div className="kb2-filters">
                {(
                  [
                    ["all", "All Sources"],
                    ["pdf", "PDFs"],
                    ["markdown", "Markdown"],
                    ["walrus", "Walrus Drives"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    className={"kb2-chip" + (kbFilter === k ? " on" : "")}
                    onClick={() => setKbFilter(k)}
                  >
                    {label}
                  </button>
                ))}
                {kbItems.some((it) => it.shared) && (
                  <button
                    className={
                      "kb2-chip shared" + (kbFilter === "shared" ? " on" : "")
                    }
                    onClick={() => setKbFilter("shared")}
                  >
                    Shared
                  </button>
                )}
                <button
                  className="kb2-add"
                  onClick={() => fileRef.current?.click()}
                  aria-label="Add source"
                >
                  <svg viewBox="0 0 24 24">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="kb2-grid">
              <button
                className="kb2-card kb2-ingest"
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.add("over");
                }}
                onDragLeave={(e) => e.currentTarget.classList.remove("over")}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove("over");
                  onFiles(e.dataTransfer.files);
                }}
              >
                <div className="ui">
                  <svg viewBox="0 0 24 24">
                    <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />
                  </svg>
                </div>
                <div className="it">Ingest Source</div>
                <div className="is">
                  Drag &amp; drop PDFs, TXT, or MD files here
                </div>
                <span className="kb2-browse">Browse Files</span>
              </button>
              {kbFiltered.map((it) => (
                <div className="kb2-card" key={it.id}>
                  <div className="kb2-top">
                    <div className="kb2-badges">
                      <span
                        className={
                          "kb2-badge" +
                          (it.walrus ? " walrus" : "") +
                          (it.shared ? " shared" : "")
                        }
                      >
                        {it.walrus && (
                          <svg
                            viewBox="0 0 24 24"
                            style={{
                              width: 12,
                              height: 12,
                              marginRight: 5,
                              verticalAlign: "-1px",
                              stroke: "currentColor",
                              fill: "none",
                              strokeWidth: 1.8,
                            }}
                          >
                            <path d="M7 18a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1.5A3.5 3.5 0 0 1 18 18z" />
                          </svg>
                        )}
                        {it.shared
                          ? `Shared${it.sharedBy ? ` · ${it.sharedBy}` : ""}`
                          : it.badge}
                      </span>
                      <span className="kb2-dot ok" />
                    </div>
                    <div className="kb2-menu-wrap">
                      <button
                        className="kb2-menu"
                        aria-label="More"
                        aria-haspopup="menu"
                        aria-expanded={kbMenu === it.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setKbMenu((o) => (o === it.id ? null : it.id));
                        }}
                      >
                        <svg viewBox="0 0 24 24">
                          <circle cx="12" cy="5" r="1" />
                          <circle cx="12" cy="12" r="1" />
                          <circle cx="12" cy="19" r="1" />
                        </svg>
                      </button>
                      {kbMenu === it.id && (
                        <div className="kb2-menu-pop" role="menu">
                          <button
                            onClick={() => {
                              s.attachDoc(it.title);
                              setKbMenu(null);
                              flash("Added to your working memory.");
                            }}
                          >
                            <svg viewBox="0 0 24 24">
                              <path d="M12 5v14M5 12h14" />
                            </svg>
                            Add to memory
                          </button>
                          {!it.shared && it.memIds.length > 0 && (
                            <button
                              onClick={() => {
                                setShareSel(new Set(it.memIds));
                                setKbMenu(null);
                                setView("memories");
                                flash("Pick who to share this with.");
                              }}
                            >
                              <svg viewBox="0 0 24 24">
                                <circle cx="18" cy="5" r="2.5" />
                                <circle cx="6" cy="12" r="2.5" />
                                <circle cx="18" cy="19" r="2.5" />
                                <path d="M8.2 10.8l7.6-4.6M8.2 13.2l7.6 4.6" />
                              </svg>
                              Share
                            </button>
                          )}
                          <button
                            onClick={() => {
                              downloadKb(it);
                              setKbMenu(null);
                            }}
                          >
                            <svg viewBox="0 0 24 24">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                            </svg>
                            Download
                          </button>
                          {!it.shared && (
                            <button
                              className="danger"
                              onClick={() => {
                                it.memIds.forEach((id) => s.forgetMem(id));
                                setKbMenu(null);
                                flash("Deleted from your memory.");
                              }}
                            >
                              <svg viewBox="0 0 24 24">
                                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" />
                              </svg>
                              Delete
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="kb2-title">{it.title}</div>
                  {it.key === "markdown" ? (
                    <div className="kb2-mock">{it.desc}</div>
                  ) : (
                    <div className="kb2-desc">{it.desc}</div>
                  )}
                  <div className="kb2-foot">
                    {it.url ? (
                      <a
                        className="l"
                        href={it.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <svg viewBox="0 0 24 24">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                        </svg>
                        {it.foot}
                      </a>
                    ) : (
                      <button
                        className="l"
                        onClick={() => {
                          if (it.shared) {
                            setMemFilter("__shared");
                            setView("memories");
                          } else if (it.name) {
                            setQuery(it.name);
                            setView("memories");
                          }
                        }}
                      >
                        <svg viewBox="0 0 24 24">
                          <ellipse cx="12" cy="6" rx="8" ry="3" />
                          <path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6" />
                        </svg>
                        {it.foot}
                      </button>
                    )}
                    <span>{it.date}</span>
                  </div>
                </div>
              ))}
            </div>
            {kbFiltered.length === 0 && (
              <div className="empty" style={{ marginTop: 24 }}>
                {q ? (
                  <>
                    <div className="et">No documents match “{query}”</div>
                    {memMatchCount > 0 ? (
                      <>
                        <div className="es">
                          But {memMatchCount}{" "}
                          {memMatchCount === 1 ? "memory" : "memories"} match.
                          Were you looking in your memories?
                        </div>
                        <button
                          className="pill-btn keep"
                          style={{ marginTop: 14 }}
                          onClick={() => setView("memories")}
                        >
                          View {memMatchCount} in Memories
                        </button>
                      </>
                    ) : (
                      <div className="es">
                        Nothing in documents or memories matched. Try a
                        different word.
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="et">No documents yet</div>
                    <div className="es">Drop a file above to get started.</div>
                  </>
                )}
              </div>
            )}
          </section>

          {/* SHARING — SuiNS identity, share memories, inbox + outbox */}
          {shareHubOpen && (
            <div
              className="share-backdrop"
              onClick={() => setShareHubOpen(false)}
            >
              <div className="share-modal" onClick={(e) => e.stopPropagation()}>
                <button
                  className="share-x"
                  onClick={() => setShareHubOpen(false)}
                  aria-label="Close"
                >
                  <svg viewBox="0 0 24 24">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
                <h1 className="h1">Sharing</h1>
                <p className="lede show">
                  Claim a name under cortex.sui, share memories with people by
                  name, and see what others have shared with you. Everything is
                  owned by your wallet on Sui — you can revoke a share at any
                  time.
                </p>

                {!wallet ? (
                  <div className="empty" style={{ marginTop: 28 }}>
                    <div className="et">Sign in to start sharing</div>
                    <div className="es">
                      Sharing needs your Sui wallet so memories stay owned by
                      you. Sign in to claim a username and share memories with
                      others.
                    </div>
                    <button
                      className="pill-btn keep"
                      style={{ marginTop: 14 }}
                      onClick={doSignIn}
                    >
                      {privyOn
                        ? "Sign in with Privy"
                        : "Continue with Google (zkLogin)"}
                    </button>
                  </div>
                ) : (
                  <div className="int2">
                    {/* Your identity */}
                    <div className="int2-group">
                      <div className="int2-glabel">Your identity</div>
                      <div className="scard">
                        <div className="int2-name">
                          Username
                          {claimedName && (
                            <span className="chip shared">
                              <span className="dot" />
                              {claimedName}
                            </span>
                          )}
                        </div>
                        <div className="ssub" style={{ marginTop: 4 }}>
                          Claiming mints a real SuiNS leaf subname under
                          cortex.sui and points it at your wallet, so others can
                          share with you by name.
                        </div>
                        {claimedName ? (
                          <div className="ssub" style={{ marginTop: 10 }}>
                            You hold{" "}
                            <span
                              style={{ fontFamily: "var(--mono)" }}
                            >
                              {claimedName}
                            </span>{" "}
                            — it points to your wallet.
                          </div>
                        ) : (
                          <>
                            <div
                              style={{
                                display: "flex",
                                gap: 8,
                                marginTop: 12,
                                flexWrap: "wrap",
                              }}
                            >
                              <input
                                className="cortex-input"
                                style={{ flex: 1, minWidth: 180 }}
                                placeholder="yourname"
                                value={username}
                                disabled={claimBusy}
                                onChange={(e) => setUsername(e.target.value)}
                              />
                              <button
                                className="pill-btn keep"
                                disabled={claimBusy || !username.trim()}
                                onClick={() => void claimUsername()}
                              >
                                {claimBusy ? "Claiming…" : "Claim"}
                              </button>
                            </div>
                            <div className="ssub" style={{ marginTop: 8 }}>
                              Not claimed yet — pick a handle to get a
                              name.cortex.sui address.
                            </div>
                          </>
                        )}
                        {claimErr && (
                          <div className="ssub" style={{ marginTop: 10 }}>
                            {claimErr}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Share memories */}
                    <div className="int2-group">
                      <div className="int2-glabel">Share memories</div>
                      <div className="scard">
                        <div className="int2-name">Pick memories to share</div>
                        <div className="ssub" style={{ marginTop: 4 }}>
                          Choose one or more of your memories and send them to
                          someone by username, name.cortex.sui or 0x address.
                          They get a read-only copy.
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            margin: "14px 0",
                            flexWrap: "wrap",
                          }}
                        >
                          <input
                            className="cortex-input"
                            style={{ flex: 1, minWidth: 200 }}
                            placeholder="username or username.cortex.sui"
                            value={shareRecipient}
                            disabled={shareBusy}
                            onChange={(e) => setShareRecipient(e.target.value)}
                          />
                          <button
                            className="pill-btn keep"
                            disabled={
                              shareBusy ||
                              !shareRecipient.trim() ||
                              shareSel.size === 0
                            }
                            onClick={() => void shareSelected()}
                          >
                            {shareBusy
                              ? "Sharing…"
                              : `Share ${shareSel.size || ""}`.trim()}
                          </button>
                        </div>
                        {shareErr && (
                          <div className="ssub" style={{ marginBottom: 10 }}>
                            {shareErr}
                          </div>
                        )}
                        {live.length === 0 ? (
                          <div className="ssub">
                            You have no memories to share yet.
                          </div>
                        ) : (
                          <div
                            className="share-pick"
                            style={{
                              maxHeight: 320,
                              overflowY: "auto",
                              borderTop:
                                "1px solid var(--line, rgba(0,0,0,0.08))",
                            }}
                          >
                            {live.slice(0, 60).map((m) => {
                              const on = shareSel.has(m.id);
                              return (
                                <button
                                  key={m.id}
                                  className="share-row"
                                  onClick={() => {
                                    const next = new Set(shareSel);
                                    if (on) next.delete(m.id);
                                    else next.add(m.id);
                                    setShareSel(next);
                                  }}
                                  style={{
                                    display: "flex",
                                    alignItems: "flex-start",
                                    gap: 10,
                                    width: "100%",
                                    textAlign: "left",
                                    padding: "10px 0",
                                    borderBottom:
                                      "1px solid var(--line, rgba(0,0,0,0.08))",
                                  }}
                                >
                                  <span
                                    className={
                                      "share-check" + (on ? " on" : "")
                                    }
                                    aria-hidden
                                  >
                                    {on ? "✓" : ""}
                                  </span>
                                  <span style={{ flex: 1, minWidth: 0 }}>
                                    <span className="set-acc-n">{m.text}</span>
                                    <span
                                      className="set-acc-s"
                                      style={{ fontFamily: "var(--sans)" }}
                                    >
                                      {m.tags.join(" · ") || "note"} ·{" "}
                                      {ago(m.ts)}
                                    </span>
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Shared with me */}
                    <div className="int2-group">
                      <div className="int2-glabel">
                        Shared with you{" "}
                        <span>read-only memories others sent you</span>
                      </div>
                      <div className="scard">
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 8,
                          }}
                        >
                          <div className="int2-name">
                            Inbox · {s.sharedMemories.length}
                          </div>
                          <button
                            className="pill-btn"
                            disabled={sharedRefreshing}
                            onClick={() => void refreshShared()}
                          >
                            {sharedRefreshing ? "Refreshing…" : "Refresh"}
                          </button>
                        </div>
                        {s.sharedMemories.length === 0 ? (
                          <div className="ssub" style={{ marginTop: 10 }}>
                            Nothing shared with you yet. When someone shares a
                            memory, it shows up here.
                          </div>
                        ) : (
                          (() => {
                            const groups: Record<string, Memory[]> = {};
                            s.sharedMemories.forEach((m) => {
                              const who = m.sharedBy || "someone";
                              (groups[who] ||= []).push(m);
                            });
                            return Object.entries(groups).map(([who, mems]) => (
                              <div key={who} style={{ marginTop: 12 }}>
                                <div className="int2-name">
                                  <span className="chip shared">
                                    <span className="dot" />
                                    {who}
                                  </span>
                                </div>
                                {mems.map((m) => (
                                  <button
                                    key={m.id}
                                    className="share-row"
                                    onClick={() => setDrawer(m)}
                                    style={{
                                      display: "block",
                                      width: "100%",
                                      textAlign: "left",
                                      padding: "8px 0",
                                      borderTop:
                                        "1px solid var(--line, rgba(0,0,0,0.08))",
                                    }}
                                  >
                                    <span className="set-acc-n">{m.text}</span>
                                    <span
                                      className="set-acc-s"
                                      style={{ fontFamily: "var(--sans)" }}
                                    >
                                      {m.tags.join(" · ") || "note"} ·{" "}
                                      {ago(m.ts)}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            ));
                          })()
                        )}
                      </div>
                    </div>

                    {/* Memories you've shared */}
                    <div className="int2-group">
                      <div className="int2-glabel">
                        Memories you&apos;ve shared <span>your outbox</span>
                      </div>
                      <div className="scard">
                        <div className="int2-name">
                          Outbox · {s.shares.length}
                        </div>
                        {s.shares.length === 0 ? (
                          <div className="ssub" style={{ marginTop: 10 }}>
                            Nothing shared yet. Pick memories above, or open a
                            memory and use “Share”.
                          </div>
                        ) : (
                          s.shares.map((sh) => (
                            <div
                              key={sh.id}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                padding: "10px 0",
                                borderTop:
                                  "1px solid var(--line, rgba(0,0,0,0.08))",
                              }}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div className="set-acc-n">
                                  {sh.title || "Untitled"}
                                </div>
                                <div
                                  className="set-acc-s"
                                  style={{ fontFamily: "var(--sans)" }}
                                >
                                  {sh.itemCount}{" "}
                                  {sh.itemCount === 1 ? "memory" : "memories"} ·{" "}
                                  {sh.recipientCount}{" "}
                                  {sh.recipientCount === 1
                                    ? "recipient"
                                    : "recipients"}{" "}
                                  ·{" "}
                                  <span
                                    className={"share-status s" + sh.status}
                                  >
                                    {SHARE_STATUS_LABEL[sh.status] ?? "unknown"}
                                  </span>
                                </div>
                              </div>
                              {sh.status === 1 && (
                                <button
                                  className="pill-btn"
                                  disabled={revokingShareId === sh.id}
                                  onClick={() => void revokeShare(sh.id)}
                                >
                                  {revokingShareId === sh.id
                                    ? "Revoking…"
                                    : "Revoke"}
                                </button>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* INTEGRATIONS — MCP clients, storage backends, sources */}
          <section className={"view" + (view === "integrations" ? " on" : "")}>
            <div className="int2">
              {openDetail ? (
                <div className="int2-detail">
                  <button
                    className="int2-back"
                    onClick={() => setIntOpen(null)}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.7}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M15 18l-6-6 6-6" />
                    </svg>
                    Back to integrations
                  </button>
                  <div className="int2-dhead">
                    <span
                      className={"int2-dav" + (openDetail.av ? " logo" : "")}
                    >
                      {openDetail.av ?? openDetail.avLetter}
                    </span>
                    <div className="int2-dmeta">
                      <h1 className="int2-dtitle">{openDetail.name}</h1>
                      <p className="int2-dsub">{openDetail.blurb}</p>
                    </div>
                    <button
                      className="pill-btn keep int2-dconnect"
                      onClick={() =>
                        copyText(openDetail.snippet, "Setup copied to clipboard")
                      }
                    >
                      {openDetail.connectLabel}
                    </button>
                  </div>
                  <p className="int2-over">{openDetail.overview}</p>
                  <div className="int2-by">
                    Built by <strong>Cortex</strong> · Connects to your managed
                    memory over an encrypted channel. Your memory stays sealed on
                    Walrus, owned by you.
                  </div>
                  <div className="int2-dsec">
                    <div className="int2-dsl">
                      Set up <span>{openDetail.steps.length} steps</span>
                    </div>
                    <ol className="int2-flow">
                      {openDetail.steps.map((step, i) => (
                        <li className="int2-fstep" key={i}>
                          <span className="int2-fn">{i + 1}</span>
                          <span className="int2-ft">{step}</span>
                        </li>
                      ))}
                    </ol>
                    <div className="int2-snip-h">
                      <span>{openDetail.snippetLabel}</span>
                      <button
                        className="int2-copy"
                        onClick={() =>
                          copyText(
                            openDetail.snippet,
                            "Setup copied to clipboard",
                          )
                        }
                      >
                        Copy
                      </button>
                    </div>
                    <pre>{openDetail.snippet}</pre>
                  </div>
                  <div className="int2-dsec">
                    <div className="int2-dsl">
                      Tools <span>{MCP_TOOL_COUNT}</span>
                    </div>
                    {MCP_TOOL_GROUPS.map((g) => (
                      <div className="int2-tg" key={g.label}>
                        <div className="int2-tgl">{g.label}</div>
                        {g.tools.map((t) => (
                          <div className="int2-trow" key={t.name}>
                            <span className="int2-tn">{t.name}</span>
                            <span className="int2-td">{t.desc}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                  <div className="int2-dsec">
                    <div className="int2-dsl">Details</div>
                    <div className="int2-det">
                      <div className="int2-detk">
                        {hostedMcp ? "Connector URL" : "Local command"}
                      </div>
                      <div className="int2-detv">
                        <code>{hostedMcp ? CORTEX_MCP_URL : CORTEX_MCP_CMD}</code>
                        <button
                          className="int2-copy"
                          onClick={() =>
                            hostedMcp
                              ? copyText(CORTEX_MCP_URL, "Connector URL copied")
                              : copyText(CORTEX_MCP_CMD, "Command copied")
                          }
                        >
                          Copy
                        </button>
                      </div>
                      <div className="int2-detk">Built by</div>
                      <div className="int2-detv">Cortex</div>
                      <div className="int2-detk">More info</div>
                      <div className="int2-detv int2-dlinks">
                        <a
                          href="https://github.com"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Documentation ↗
                        </a>
                        <a
                          href="https://discord.com"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Support ↗
                        </a>
                        <a href="#">Privacy ↗</a>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
              <div className="int2-head">
                <h1 className="int2-title">Integrations</h1>
                <p className="int2-sub">
                  Cortex is one shared memory behind every tool you use. Connect
                  your assistants, agent frameworks and sources so they read and
                  write the same durable context — no copy-paste between chats.
                </p>
              </div>
              <div className="int2-filter">
                {(["all", "mcp", "frameworks", "sources"] as const).map((t) => (
                  <button
                    key={t}
                    className={"int2-f" + (intTab === t ? " on" : "")}
                    onClick={() => setIntTab(t)}
                  >
                    {t === "all"
                      ? "All"
                      : t === "mcp"
                        ? "AI tools"
                        : t === "frameworks"
                          ? "Frameworks"
                          : "Sources"}
                  </button>
                ))}
              </div>

              {(intTab === "all" || intTab === "mcp") && (
                <div className="int2-group">
                  <div className="int2-glabel">AI tools</div>
                  <div className="scard" style={{ marginBottom: 16 }}>
                    <div className="int2-name">What your MCP can do</div>
                    <div
                      className="ssub"
                      style={{ marginTop: 4, marginBottom: 6 }}
                    >
                      One server exposes your whole memory plane to any MCP host
                      — read and write memory, drive the agent team, and (once
                      you authorize it) read your details, memory and context.
                    </div>
                    <div className="int2-tools">
                      {MCP_TOOL_GROUPS.flatMap((g) => g.tools).map((t) => (
                        <span className="int2-tool" key={t.name}>
                          {t.name}
                        </span>
                      ))}
                    </div>
                    {MCP_TOOL_GROUPS.map((g) => (
                      <div
                        key={g.label}
                        style={{
                          display: "flex",
                          gap: 10,
                          padding: "6px 0",
                          borderTop: "1px solid var(--line, rgba(0,0,0,0.08))",
                        }}
                      >
                        <span style={{ minWidth: 92, fontWeight: 600 }}>
                          {g.label}
                        </span>
                        <span className="ssub">{g.blurb}</span>
                      </div>
                    ))}
                  </div>
                  <div className="int2-list">
                    {MCP_CLIENTS.map((c) => (
                      <div className="int2-item" key={c.key}>
                        <div className="int2-row">
                          <span className="int2-av logo">
                            {clientLogo(c.key)}
                          </span>
                          <div className="int2-meta">
                            <div className="int2-name">{c.name}</div>
                            <div className="int2-desc">{c.blurb}</div>
                          </div>
                          <button
                            className="int2-btn"
                            onClick={() => intConnect(c.key)}
                          >
                            Connect
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="scard" style={{ marginTop: 16 }}>
                    <div className="int2-name">Authorize MCP</div>
                    <div className="ssub" style={{ marginTop: 4 }}>
                      One click grants your MCP everything it needs: your
                      profile, your memory, and your shared agent workspace
                      (board + bus). You can revoke anytime.
                    </div>
                    <div
                      className="ssub"
                      style={{
                        marginTop: 10,
                        fontFamily: "var(--mono)",
                      }}
                    >
                      {CORTEX_ENV.mcpAddress
                        ? CORTEX_ENV.mcpAddress.slice(0, 10) +
                          "…" +
                          CORTEX_ENV.mcpAddress.slice(-6)
                        : "No MCP wallet configured"}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        marginTop: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        className="pill-btn keep"
                        disabled={!mcpAuthReady || mcpAuthBusy}
                        onClick={authorizeMcp}
                      >
                        {mcpAuthBusy ? "Authorizing…" : "Authorize MCP"}
                      </button>
                      <button
                        className="pill-btn"
                        disabled={!mcpAuthReady || mcpAuthBusy}
                        onClick={revokeMcp}
                      >
                        Revoke
                      </button>
                    </div>
                    {!mcpAuthReady && (
                      <div className="ssub" style={{ marginTop: 10 }}>
                        {!walletState?.wallet
                          ? "Sign in to authorize your MCP."
                          : "Set NEXT_PUBLIC_CORTEX_MCP_ADDRESS and deploy the contracts to enable."}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {(intTab === "all" || intTab === "frameworks") && (
                <div className="int2-group">
                  <div className="int2-glabel">
                    Frameworks <span>· prompts &amp; skills</span>
                  </div>
                  <div className="int2-list">
                    {FRAMEWORKS.map((c) => (
                      <div className="int2-item" key={c.key}>
                        <div className="int2-row">
                          <span className="int2-av">{c.letter}</span>
                          <div className="int2-meta">
                            <div className="int2-name">{c.name}</div>
                            <div className="int2-desc">{c.desc}</div>
                          </div>
                          <button
                            className="int2-btn"
                            onClick={() => intConnect(c.key)}
                          >
                            Connect
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(intTab === "all" || intTab === "sources") && (
                <div className="int2-group">
                  <div className="int2-glabel">Sources</div>
                  <div className="int2-list">
                    {SOURCES.map((c) => (
                      <div className="int2-item" key={c.key}>
                        <div className="int2-row">
                          <span className="int2-av">{c.letter}</span>
                          <div className="int2-meta">
                            <div className="int2-name">{c.name}</div>
                            <div className="int2-desc">{c.desc}</div>
                          </div>
                          <button
                            className="int2-btn"
                            onClick={() => {
                              if (c.action === "add") fileRef.current?.click();
                              else if (c.action === "web") {
                                if (!s.web) s.toggleWeb();
                                flash(
                                  "Web search is on for your next question.",
                                );
                              } else {
                                setView("home");
                                s.setMode("remember");
                                flash("Type your note below and keep it.");
                              }
                            }}
                          >
                            {c.action === "add"
                              ? "Add files"
                              : c.action === "web"
                                ? "Turn on"
                                : "Write a note"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
                </>
              )}
            </div>
          </section>

          {/* SETTINGS — floating console over the current page */}
          {settingsOpen && (
            <div
              className="cset-backdrop"
              onClick={() => setSettingsOpen(false)}
            >
              <div className="cset-modal" onClick={(e) => e.stopPropagation()}>
                <aside className="cset-nav">
                  <div className="cset-search">
                    <svg viewBox="0 0 24 24">
                      <circle cx="11" cy="11" r="7" />
                      <path d="M21 21l-4.3-4.3" />
                    </svg>
                    <input
                      value={settingsSearch}
                      onChange={(e) => setSettingsSearch(e.target.value)}
                      placeholder="Search"
                    />
                  </div>
                  <div className="cset-nav-label">Settings</div>
                  <div className="cset-nav-list">
                    {SETTINGS_NAV.filter(([, label]) =>
                      label
                        .toLowerCase()
                        .includes(settingsSearch.trim().toLowerCase()),
                    ).map(([key, label, icon]) => (
                      <button
                        key={key}
                        className={
                          "cset-nav-item" +
                          (settingsSection === key ? " on" : "")
                        }
                        onClick={() => setSettingsSection(key)}
                      >
                        <svg viewBox="0 0 24 24">{icon}</svg>
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                </aside>
                <div className="cset-body">
                  <button
                    className="cset-x"
                    onClick={() => setSettingsOpen(false)}
                    aria-label="Close settings"
                  >
                    <svg viewBox="0 0 24 24">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                  <div className="cset-scroll">
                    <div
                      className={
                        "set-group" +
                        (settingsSection === "account" ? " on" : "")
                      }
                    >
                      <div className="set-gh">
                        <div className="set-gt">Account</div>
                        <div className="set-gs">
                          {privyOn
                            ? "How you sign in. Cortex uses Privy for login and a managed Sui wallet — your identity stays yours, with no seed phrase to lose."
                            : "How you sign in. Cortex uses zkLogin so your identity stays yours, with no password to leak."}
                        </div>
                      </div>
                      {sess ? (
                        <div className="set-account">
                          <span className="set-av">
                            {sess.via[0]?.toUpperCase()}
                          </span>
                          <div className="set-acc-m">
                            <div className="set-acc-n">
                              Signed in · {sess.via}
                            </div>
                            <div className="set-acc-s">
                              {sess.addr.slice(0, 10)}…{sess.addr.slice(-6)}
                            </div>
                          </div>
                          <button className="pill-btn" onClick={doSignOut}>
                            Sign out
                          </button>
                        </div>
                      ) : (
                        <div className="set-signin">
                          <button className="pill-btn keep" onClick={doSignIn}>
                            <svg viewBox="0 0 24 24">
                              <circle cx="12" cy="12" r="9" />
                              <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
                            </svg>
                            {privyOn
                              ? "Sign in with Privy"
                              : "Continue with Google (zkLogin)"}
                          </button>
                          <div className="set-note">
                            {privyOn
                              ? "Privy logs you in by email or social and provisions a managed Sui wallet that owns your memory on Walrus."
                              : "This creates a local ephemeral session right now. Add a Privy app id (NEXT_PUBLIC_PRIVY_APP_ID) to sign in with a managed Sui wallet."}
                          </div>
                        </div>
                      )}

                      {privyOn && sess?.addr && (
                        <>
                          <div className="set-subh">Connected wallet</div>
                          <div className="wcard">
                            <div className="wcard-top">
                              <span className="wcard-av">
                                {sess.via[0]?.toUpperCase() ?? "S"}
                              </span>
                              <div className="wcard-id">
                                <div className="wcard-name">
                                  {sess.via} wallet
                                </div>
                                <button
                                  className="wcard-addr"
                                  onClick={() => {
                                    void navigator.clipboard?.writeText(
                                      sess.addr,
                                    );
                                    flash("Address copied.");
                                  }}
                                  title="Copy address"
                                >
                                  {sess.addr.slice(0, 6)}…{sess.addr.slice(-4)}
                                  <svg viewBox="0 0 24 24">
                                    <rect
                                      x="9"
                                      y="9"
                                      width="11"
                                      height="11"
                                      rx="2"
                                    />
                                    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                                  </svg>
                                </button>
                              </div>
                              <div className="wcard-acts">
                                <button
                                  className="wcard-ic"
                                  onClick={() => void refreshBalances()}
                                  disabled={balancesLoading}
                                  title="Refresh balances"
                                  aria-label="Refresh balances"
                                >
                                  <svg viewBox="0 0 24 24">
                                    <path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5" />
                                  </svg>
                                </button>
                                <a
                                  className="wcard-ic"
                                  href={`https://suiscan.xyz/${CORTEX_ENV.network}/account/${sess.addr}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  title="View on explorer"
                                  aria-label="View on explorer"
                                >
                                  <svg viewBox="0 0 24 24">
                                    <path d="M7 17 17 7M9 7h8v8" />
                                  </svg>
                                </a>
                              </div>
                            </div>
                            <div className="wcard-warn">
                              <svg viewBox="0 0 24 24">
                                <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
                                <path d="M12 9v4M12 17h.01" />
                              </svg>
                              <span>
                                Only send <b>SUI</b> and <b>WAL</b> to this
                                address — they cover gas and Walrus storage.
                                Other tokens or NFTs sent here may be lost.
                              </span>
                            </div>
                            <div className="wcard-bals">
                              {[
                                {
                                  sym: "SUI",
                                  name: "Sui",
                                  sub: "network gas",
                                  raw: walletBalances?.sui,
                                },
                                {
                                  sym: "WAL",
                                  name: "Walrus",
                                  sub: "storage",
                                  raw: walletBalances?.wal,
                                },
                              ].map((b) => (
                                <div className="wbal" key={b.sym}>
                                  <span className="wbal-sym">{b.sym}</span>
                                  <div className="wbal-m">
                                    <div className="wbal-name">{b.name}</div>
                                    <div className="wbal-sub">{b.sub}</div>
                                  </div>
                                  <span className="wbal-amt">
                                    {!walletBalances && balancesLoading
                                      ? "…"
                                      : b.raw != null
                                        ? fmtCoin(b.raw)
                                        : "0"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    <div
                      className={
                        "set-group" +
                        (settingsSection === "profile" ? " on" : "")
                      }
                    >
                      <div className="set-gh">
                        <div className="set-gt">Profile</div>
                        <div className="set-gs">
                          What you share here becomes initial memory about you,
                          and grounds how Cortex and your agents respond.{" "}
                          {profileAnsweredCount(profileDraft)}/{TOTAL_QUESTIONS}{" "}
                          answered.
                        </div>
                      </div>
                      <div className="set-profile-acts">
                        <button
                          className="pill-btn"
                          onClick={() => {
                            setProfileDraft({ ...s.profile });
                            setOnboardOpen(true);
                          }}
                        >
                          Run the guided setup
                        </button>
                      </div>
                      {ONBOARDING_STEPS.map((grp) => (
                        <div className="set-profile-grp" key={grp.title}>
                          <div className="set-subh">{grp.title}</div>
                          {grp.fields.map((f) => (
                            <label className="set-pfield" key={f.key}>
                              <span className="set-pfl">{f.label}</span>
                              {f.type === "textarea" ? (
                                <textarea
                                  className="am-input"
                                  rows={2}
                                  placeholder={f.placeholder}
                                  value={profileDraft[f.key] ?? ""}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setProfileSaved(false);
                                    setProfileDraft((p) => ({
                                      ...p,
                                      [f.key]: v,
                                    }));
                                  }}
                                />
                              ) : (
                                <input
                                  className="am-input"
                                  placeholder={f.placeholder}
                                  value={profileDraft[f.key] ?? ""}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setProfileSaved(false);
                                    setProfileDraft((p) => ({
                                      ...p,
                                      [f.key]: v,
                                    }));
                                  }}
                                />
                              )}
                            </label>
                          ))}
                        </div>
                      ))}
                      <div className="set-profile-save">
                        <button
                          className="pill-btn keep"
                          onClick={saveProfileEdits}
                        >
                          {profileSaved ? "Saved" : "Save profile"}
                        </button>
                      </div>
                    </div>

                    <div
                      className={
                        "set-group" +
                        (settingsSection === "models" ? " on" : "")
                      }
                    >
                      <div className="set-gh">
                        <div className="set-gt">Models &amp; API keys</div>
                        <div className="set-gs">
                          Bring your own keys to enable any model. Keys are
                          encrypted and stored only on this device — calls run
                          straight from your browser to the provider, never our
                          servers.
                        </div>
                      </div>
                      {s.customModels.length === 0 && (
                        <div className="set-empty">No custom models yet.</div>
                      )}
                      {s.customModels.map((m) => (
                        <div className="set-srow" key={m.id}>
                          <span className="set-av store">
                            {providerInfo(m.provider).label[0]}
                          </span>
                          <div className="set-acc-m">
                            <div className="set-acc-n">
                              {m.label}{" "}
                              <span className="int-role">
                                {providerInfo(m.provider).label}
                              </span>
                            </div>
                            <div className="set-acc-s">
                              {s.byokKeys[m.id] ? "Key unlocked" : "Key locked"}{" "}
                              · {m.apiId}
                            </div>
                          </div>
                          <button
                            className="pill-btn"
                            onClick={() => s.removeCustomModel(m.id)}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <div className="set-btn-row">
                        <button className="pill-btn" onClick={openAddModel}>
                          Add model
                        </button>
                        {!s.byokUnlocked && s.customModels.length > 0 && (
                          <button
                            className="pill-btn"
                            onClick={() => s.unlockByok()}
                          >
                            Unlock keys
                          </button>
                        )}
                        {passkeySupported() && !passkeyEnrolled() && (
                          <button
                            className="pill-btn"
                            onClick={() => s.enrollByokPasskey()}
                          >
                            Protect with passkey
                          </button>
                        )}
                        {passkeyEnrolled() && (
                          <span className="int-pill worm">Passkey on</span>
                        )}
                      </div>
                      {s.byokError && (
                        <div className="set-err">
                          Couldn&apos;t unlock: {s.byokError}
                        </div>
                      )}
                    </div>

                    <div
                      className={
                        "set-group" +
                        (settingsSection === "privacy" ? " on" : "")
                      }
                    >
                      <div className="set-gh">
                        <div className="set-gt">Privacy &amp; Access</div>
                        <div className="set-gs">
                          How your data is protected and who can reach it.
                          Sensitive data is encrypted client-side before it ever
                          touches Walrus — only your wallet can decrypt it.
                        </div>
                      </div>

                      <div className="scard">
                        <div className="int2-name">MCP access</div>
                        <div className="ssub" style={{ marginTop: 4 }}>
                          An authorized MCP gets your profile, your memory, and
                          your shared agent workspace (board + bus). You can
                          revoke anytime.
                        </div>
                        <div
                          className="ssub"
                          style={{
                            marginTop: 10,
                            fontFamily: "var(--mono)",
                          }}
                        >
                          {CORTEX_ENV.mcpAddress
                            ? CORTEX_ENV.mcpAddress.slice(0, 10) +
                              "…" +
                              CORTEX_ENV.mcpAddress.slice(-6)
                            : "No MCP wallet configured"}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            marginTop: 12,
                            flexWrap: "wrap",
                          }}
                        >
                          <button
                            className="pill-btn keep"
                            disabled={!mcpAuthReady || mcpAuthBusy}
                            onClick={authorizeMcp}
                          >
                            {mcpAuthBusy ? "Authorizing…" : "Authorize MCP"}
                          </button>
                          <button
                            className="pill-btn"
                            disabled={!mcpAuthReady || mcpAuthBusy}
                            onClick={revokeMcp}
                          >
                            Revoke
                          </button>
                        </div>
                        {!mcpAuthReady && (
                          <div className="ssub" style={{ marginTop: 10 }}>
                            {!walletState?.wallet
                              ? "Sign in to authorize your MCP."
                              : "Set NEXT_PUBLIC_CORTEX_MCP_ADDRESS and deploy the contracts to enable."}
                          </div>
                        )}
                      </div>

                      <div className="scard" style={{ marginTop: 16 }}>
                        <div className="int2-name">Encryption</div>
                        <div
                          className="ssub"
                          style={{ marginTop: 4, fontFamily: "var(--mono)" }}
                        >
                          {sealEnabled()
                            ? `Seal threshold (${CORTEX_ENV.seal.serverObjectIds.length} servers, threshold ${CORTEX_ENV.seal.threshold})`
                            : "AES (wallet-derived)"}
                        </div>
                      </div>
                    </div>

                    <div
                      className={
                        "set-group" +
                        (settingsSection === "username" ? " on" : "")
                      }
                    >
                      <div className="set-gh">
                        <div className="set-gt">Username &amp; sharing</div>
                        <div className="set-gs">
                          Claim a handle under cortex.sui so others can share
                          memories with you by name. Manage shares and your
                          inbox in the Sharing view.
                        </div>
                      </div>

                      <div className="scard" style={{ marginBottom: 16 }}>
                        <div className="int2-name">Username</div>
                        <div className="ssub" style={{ marginTop: 4 }}>
                          Claiming mints a real SuiNS subname under cortex.sui
                          and points it at your wallet.
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            marginTop: 12,
                            flexWrap: "wrap",
                          }}
                        >
                          <input
                            className="cortex-input"
                            style={{ flex: 1, minWidth: 180 }}
                            placeholder="yourname"
                            value={username}
                            disabled={claimBusy}
                            onChange={(e) => setUsername(e.target.value)}
                          />
                          <button
                            className="pill-btn keep"
                            disabled={!wallet || claimBusy || !username.trim()}
                            onClick={() => void claimUsername()}
                          >
                            {claimBusy ? "Claiming…" : "Claim"}
                          </button>
                        </div>
                        {claimedName && (
                          <div className="ssub" style={{ marginTop: 10 }}>
                            You hold{" "}
                            <span
                              style={{ fontFamily: "var(--mono)" }}
                            >
                              {claimedName}
                            </span>{" "}
                            — it points to your wallet.
                          </div>
                        )}
                        {claimErr && (
                          <div className="ssub" style={{ marginTop: 10 }}>
                            {claimErr}
                          </div>
                        )}
                        {!wallet && (
                          <div className="ssub" style={{ marginTop: 10 }}>
                            Sign in to claim a username.
                          </div>
                        )}
                      </div>

                      <button
                        className="pill-btn"
                        onClick={() => setShareHubOpen(true)}
                      >
                        Open Sharing
                      </button>
                    </div>

                    <div
                      className={
                        "set-group" +
                        (settingsSection === "devices" ? " on" : "")
                      }
                    >
                      <div className="set-gh">
                        <div className="set-gt">Devices &amp; Access</div>
                        <div className="set-gs">
                          Each device and agent that can read your memory has
                          its own key, derived on that device and never stored —
                          revoke any of them anytime.
                        </div>
                      </div>

                      <div className="scard">
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 8,
                          }}
                        >
                          <div className="int2-name">Authorized keys</div>
                          <button
                            className="pill-btn"
                            disabled={!walletState?.wallet || delegatesLoading}
                            onClick={() => void loadDelegates()}
                          >
                            {delegatesLoading ? "Refreshing…" : "Refresh"}
                          </button>
                        </div>
                        {!walletState?.wallet ? (
                          <div className="ssub" style={{ marginTop: 10 }}>
                            Sign in to manage access.
                          </div>
                        ) : !contractsEnabled() || delegates.length === 0 ? (
                          <div className="ssub" style={{ marginTop: 10 }}>
                            Keys appear here once your memory is provisioned.
                          </div>
                        ) : (
                          delegates.map((d) => {
                            const label = d.isThisDevice
                              ? "This device"
                              : d.publicKey === CORTEX_ENV.mcpMemwalPubkey
                                ? "MCP"
                                : "Device / agent";
                            return (
                              <div
                                key={d.publicKey}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 10,
                                  padding: "8px 0",
                                  borderTop:
                                    "1px solid var(--line, rgba(0,0,0,0.08))",
                                }}
                              >
                                <span
                                  style={{ minWidth: 110, fontWeight: 600 }}
                                >
                                  {label}
                                </span>
                                <span
                                  className="ssub"
                                  style={{
                                    flex: 1,
                                    fontFamily: "var(--mono)",
                                  }}
                                >
                                  {d.publicKey.slice(0, 10) +
                                    "…" +
                                    d.publicKey.slice(-6)}
                                </span>
                                {!d.isThisDevice && (
                                  <button
                                    className="pill-btn"
                                    disabled={revokingKey === d.publicKey}
                                    onClick={() =>
                                      void revokeDelegate(d.publicKey)
                                    }
                                  >
                                    {revokingKey === d.publicKey
                                      ? "Revoking…"
                                      : "Revoke"}
                                  </button>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    <div
                      className={
                        "set-group" +
                        (settingsSection === "memory" ? " on" : "")
                      }
                    >
                      <div className="set-gh">
                        <div className="set-gt">Memory model</div>
                        <div className="set-gs">
                          How Cortex forgets and remembers. It mirrors human
                          memory: it forgets by default and keeps what earns it.
                          These are the dials.
                        </div>
                      </div>

                      <div className="set-field">
                        <div className="set-fl">
                          <span>Recall threshold (theta)</span>
                          <span className="set-fv">{cfg.theta.toFixed(2)}</span>
                        </div>
                        <input
                          type="range"
                          min={0.05}
                          max={0.6}
                          step={0.01}
                          value={cfg.theta}
                          onChange={(e) =>
                            s.setConfig({ theta: +e.target.value })
                          }
                        />
                        <div className="set-fh">
                          A memory stays in active recall while its strength is
                          at or above this. Lower means Cortex holds on to more.
                        </div>
                      </div>
                      <div className="set-field">
                        <div className="set-fl">
                          <span>Rehearsal bump</span>
                          <span className="set-fv">
                            +{cfg.accessBump.toFixed(2)}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0.05}
                          max={0.4}
                          step={0.01}
                          value={cfg.accessBump}
                          onChange={(e) =>
                            s.setConfig({ accessBump: +e.target.value })
                          }
                        />
                        <div className="set-fh">
                          How much strength a memory gains each time you use it.
                          Higher means recall sticks faster.
                        </div>
                      </div>
                      <div className="set-field">
                        <div className="set-fl">
                          <span>Inferred decay penalty</span>
                          <span className="set-fv">
                            {cfg.inferredPenalty.toFixed(1)}×
                          </span>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={3}
                          step={0.1}
                          value={cfg.inferredPenalty}
                          onChange={(e) =>
                            s.setConfig({ inferredPenalty: +e.target.value })
                          }
                        />
                        <div className="set-fh">
                          Memories Cortex guessed (rather than you stating them)
                          fade this much faster, so the loop never launders a
                          guess into fact.
                        </div>
                      </div>
                      <div className="set-field">
                        <div className="set-fl">
                          <span>Consolidation sweep</span>
                          <span className="set-fv">
                            every {cfg.sweepHours}h
                          </span>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={72}
                          step={1}
                          value={cfg.sweepHours}
                          onChange={(e) =>
                            s.setConfig({ sweepHours: +e.target.value })
                          }
                        />
                        <div className="set-fh">
                          How often Cortex runs its quiet pass to fade, fold,
                          promote and re-link, the way sleep consolidates
                          memory.
                        </div>
                      </div>

                      <div className="set-fl" style={{ marginTop: 20 }}>
                        <span>Tiers</span>
                      </div>
                      <div className="set-tiers">
                        <div className="set-th">
                          <span>Tier</span>
                          <span>Floor</span>
                          <span>Half life</span>
                          <span>Auto forget</span>
                        </div>
                        {TIERS.map((t) => (
                          <div className="set-tr" key={t}>
                            <span>
                              <b>T{t}</b> {TIER_NAME[t]}
                            </span>
                            <span>{cfg.floor[t].toFixed(2)}</span>
                            <span>{fmtDays(cfg.halfLife[t])}</span>
                            <span>{fmtDays(cfg.ttl[t])}</span>
                          </div>
                        ))}
                      </div>
                      <div className="set-fh" style={{ marginTop: 8 }}>
                        Floor is the strength a tier can never fall below. Tier
                        4 sits at 1.0, so a core memory (an allergy, a hard
                        rule) can never drop out of recall.
                      </div>

                      <div className="set-actions">
                        <button
                          className="pill-btn keep"
                          onClick={() => {
                            const sum = s.runSweep();
                            flash(
                              `Swept ${sum.scanned}: ${sum.deindexed} faded, ${sum.merged} folded, ${sum.promoted} promoted.`,
                            );
                          }}
                        >
                          Run consolidation now
                        </button>
                        <button
                          className="pill-btn"
                          onClick={() => {
                            s.resetConfig();
                            flash("Memory model reset to defaults.");
                          }}
                        >
                          Reset to defaults
                        </button>
                      </div>
                    </div>

                    <div
                      className={
                        "set-group" + (settingsSection === "reset" ? " on" : "")
                      }
                    >
                      <div className="set-gh">
                        <div className="set-gt">Reset memory</div>
                        <div className="set-gs">
                          Clear this browser&apos;s working memory and start
                          from a blank slate. Your durable record on Walrus is
                          not touched — this only wipes the local index.
                        </div>
                      </div>
                      <button
                        className="pill-btn danger"
                        onClick={() => {
                          if (
                            !window.confirm(
                              "Clear your local memory and start fresh? This wipes the working index in this browser. Your Walrus record is kept.",
                            )
                          )
                            return;
                          s.resetMemory();
                          setSettingsOpen(false);
                          setView("home");
                          flash("Memory cleared. Starting fresh.");
                        }}
                      >
                        Reset memory
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* BRAIN — full-bleed memory map */}
        {view === "brain" && (
          <div className="brain-stage">
            <MemoryMap onOpen={(m) => setDrawer(m)} theme={eff} />
          </div>
        )}

        {/* GLOBAL COMPOSER (hidden on full-page views) */}
        {view !== "studio" && view !== "integrations" && view !== "agents" && (
          <div className="composer-dock">
            <div className="capture" ref={composerRef}>
              <div className="ask-docs">
                {s.docs.map((d, i) => (
                  <span className="ask-doc" key={i}>
                    <svg viewBox="0 0 24 24">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <path d="M14 2v6h6" />
                    </svg>
                    {d}
                    <button className="adx" onClick={() => s.removeDoc(i)}>
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <textarea
                ref={ta}
                rows={1}
                placeholder={
                  s.mode === "ask"
                    ? "Ask anything about your memories…"
                    : "What's on your mind?"
                }
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  grow(e.target);
                }}
                onKeyDown={onKey}
              />
              <div className="capture-bar">
                <button
                  className="cap-tool icon"
                  onClick={() => fileRef.current?.click()}
                  aria-label="Attach"
                >
                  <svg viewBox="0 0 24 24">
                    <path d="M21.4 11 12 20.4a5.5 5.5 0 0 1-7.8-7.8l8.5-8.5a3.7 3.7 0 1 1 5.2 5.2l-8.5 8.5a1.8 1.8 0 1 1-2.6-2.6l7.8-7.8" />
                  </svg>
                </button>
                <div className="mode-toggle">
                  <button
                    className={s.mode === "ask" ? "on" : ""}
                    onClick={() => s.setMode("ask")}
                  >
                    <svg viewBox="0 0 24 24">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    Ask
                  </button>
                  {view !== "knowledge" && (
                    <button
                      className={s.mode === "remember" ? "on" : ""}
                      onClick={() => s.setMode("remember")}
                    >
                      <svg viewBox="0 0 24 24">
                        <path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6z" />
                      </svg>
                      Remember
                    </button>
                  )}
                </div>
                <div className="cap-tail">
                  <div className="model-anchor ask-only">
                    <button
                      className="cap-tool model-chip"
                      onClick={(e) => {
                        e.stopPropagation();
                        setModelOpen((o) => !o);
                      }}
                    >
                      <span className="mdot" />
                      <span>{s.model.name}</span>{" "}
                      <span className="mchev">▾</span>
                    </button>
                    {modelOpen && (
                      <div className="model-pop">
                        <div className="mp-up">
                          <div>
                            <div className="mp-up-t">Use any model</div>
                            <div className="mp-up-s">
                              Free while Cortex is in preview
                            </div>
                          </div>
                          <span className="mp-badge">Preview</span>
                        </div>
                        <label className="mp-search">
                          <svg viewBox="0 0 24 24">
                            <circle cx="11" cy="11" r="7" />
                            <path d="M21 21l-4.3-4.3" />
                          </svg>
                          <input
                            placeholder="Search models…"
                            value={modelSearch}
                            onChange={(e) => setModelSearch(e.target.value)}
                            autoFocus
                          />
                        </label>
                        <div className="mp-list">
                          {modelList.map((m) => (
                            <button
                              key={m.name}
                              className={
                                "mp-item" +
                                (m.name === s.model.name ? " on" : "")
                              }
                              onClick={() => {
                                s.setModel(m.name);
                                setModelOpen(false);
                                const custom = s.customModels.find(
                                  (c) => c.label === m.name,
                                );
                                if (custom && !s.byokKeys[custom.id])
                                  s.unlockByok();
                              }}
                            >
                              <span className="mp-av">{m.prov[0]}</span>
                              <span className="mp-meta">
                                <span className="mp-name">
                                  {m.name}{" "}
                                  <span
                                    className={
                                      "mp-price" +
                                      (m.price.length > 2 ? " hi" : "")
                                    }
                                  >
                                    {m.price}
                                  </span>
                                </span>
                                <span className="mp-desc">
                                  {m.prov} · {m.desc}
                                </span>
                              </span>
                              {m.name === s.model.name && (
                                <span className="mp-check">✓</span>
                              )}
                            </button>
                          ))}
                        </div>
                        <button
                          className="mp-add"
                          onClick={() => {
                            setModelOpen(false);
                            openAddModel();
                          }}
                        >
                          <span className="mp-add-ic">
                            <svg viewBox="0 0 24 24">
                              <path d="M12 5v14M5 12h14" />
                            </svg>
                          </span>
                          <span className="mp-meta">
                            <span className="mp-name">Add model</span>
                            <span className="mp-desc">
                              Bring your own API key
                            </span>
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    className={
                      "cap-tool icon web-chip ask-only" + (s.web ? " on" : "")
                    }
                    onClick={() => s.toggleWeb()}
                    title="Search the web"
                    aria-label="Search the web"
                  >
                    <svg viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
                    </svg>
                  </button>
                  <div className="imp-anchor remember-only">
                    <button
                      className={"cap-tool imp-chip" + (impOpen ? " on" : "")}
                      onClick={() => setImpOpen((o) => !o)}
                      aria-haspopup="true"
                      aria-expanded={impOpen}
                    >
                      {s.importance === "low"
                        ? "Passing"
                        : s.importance === "normal"
                          ? "Normal"
                          : "Keep close"}
                      <span className="mchev">▾</span>
                    </button>
                    {impOpen && (
                      <div className="imp-pop">
                        <div className="importance">
                          {(["low", "normal", "high"] as const).map((lv) => (
                            <button
                              key={lv}
                              className={s.importance === lv ? "on" : ""}
                              onClick={() => {
                                s.setImportance(lv);
                                setImpOpen(false);
                              }}
                            >
                              {lv === "low"
                                ? "Passing"
                                : lv === "normal"
                                  ? "Normal"
                                  : "Keep close"}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {dictation.supported && (
                    <button
                      className={
                        "cap-tool speak-tool" +
                        (dictation.recording ? " on" : "")
                      }
                      onClick={() => void toggleDictation()}
                      disabled={dictation.busy}
                      title={
                        dictation.recording
                          ? "Stop and transcribe"
                          : "Speak your prompt"
                      }
                    >
                      <svg viewBox="0 0 24 24">
                        <rect x="9" y="3" width="6" height="11" rx="3" />
                        <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
                      </svg>{" "}
                      {dictation.busy
                        ? "…"
                        : dictation.recording
                          ? "Listening"
                          : "Speak"}
                    </button>
                  )}
                  <button
                    className="cap-send"
                    onClick={submit}
                    aria-label={s.mode === "ask" ? "Ask" : "Remember"}
                  >
                    <svg viewBox="0 0 24 24">
                      <path d="M12 19V5M5 12l7-7 7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* shared file input — available on every view (Studio attach, etc.) */}
        <input
          ref={fileRef}
          type="file"
          multiple
          hidden
          onChange={(e) => onFiles(e.target.files)}
        />
      </main>

      {captureOpen && (
        <CaptureModal
          wallet={wallet}
          flash={flash}
          onClose={() => setCaptureOpen(false)}
        />
      )}

      {onboardOpen && (
        <Onboarding
          initial={s.profile}
          onComplete={completeOnboarding}
          onSkip={skipOnboarding}
        />
      )}

      {/* CREATE AGENT */}
      {agModalOpen && (
        <div className="am-scrim" onClick={() => setAgModalOpen(false)}>
          <div className="am-modal" onClick={(e) => e.stopPropagation()}>
            <div className="am-head">
              <div className="am-title">Create agent</div>
              <button
                className="am-x"
                onClick={() => setAgModalOpen(false)}
                aria-label="Close"
              >
                <svg viewBox="0 0 24 24">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <div className="am-body">
              <div className="ag-preview">
                <span
                  className="pr-av"
                  style={{ background: agAccent, color: "#fff" }}
                >
                  {(agName || "New").slice(0, 2).toUpperCase()}
                </span>
                <div className="ag-preview-m">
                  <div className="ag-preview-n">{agName || "New agent"}</div>
                  <div className="ag-preview-r">{ROLE_LABELS[agRole]}</div>
                </div>
              </div>
              <label className="am-field">
                <span className="am-label">
                  <i className="am-req">*</i> Name
                </span>
                <input
                  className="ag-input"
                  placeholder="e.g. Sable"
                  value={agName}
                  autoFocus
                  onChange={(e) => setAgName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") createAgentFromForm();
                  }}
                />
              </label>
              <label className="am-field">
                <span className="am-label">Role</span>
                <div className="am-select">
                  <select
                    value={agRole}
                    onChange={(e) => setAgRole(e.target.value as AgentRole)}
                  >
                    {(
                      Object.keys(ROLE_LABELS) as (keyof typeof ROLE_LABELS)[]
                    ).map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                  <svg viewBox="0 0 24 24">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </div>
              </label>
              <label className="am-field">
                <span className="am-label">Specialty</span>
                <textarea
                  className="ag-input"
                  rows={2}
                  placeholder="One line on what this agent is best at (optional)."
                  value={agBlurb}
                  onChange={(e) => setAgBlurb(e.target.value)}
                />
              </label>
              <div className="am-field">
                <span className="am-label">Accent</span>
                <div className="ag-accents">
                  {ACCENTS.map((c) => (
                    <button
                      key={c}
                      className={"ag-accent" + (agAccent === c ? " on" : "")}
                      style={{ background: c }}
                      aria-label={`Accent ${c}`}
                      onClick={() => setAgAccent(c)}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="am-foot">
              <button
                className="am-cancel"
                onClick={() => setAgModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="am-save"
                disabled={!agName.trim()}
                onClick={createAgentFromForm}
              >
                Create agent
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD MODEL (bring your own key) */}
      {addModelOpen && (
        <div
          className="am-scrim"
          onClick={() => !amBusy && setAddModelOpen(false)}
        >
          <div className="am-modal" onClick={(e) => e.stopPropagation()}>
            <div className="am-head">
              <div className="am-title">Add Model</div>
              <button
                className="am-x"
                onClick={() => setAddModelOpen(false)}
                aria-label="Close"
              >
                <svg viewBox="0 0 24 24">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <div className="am-body">
              <label className="am-field">
                <span className="am-label">
                  <i className="am-req">*</i> Provider
                </span>
                <div className="am-select">
                  <select
                    value={amProvider}
                    onChange={(e) => {
                      setAmProvider(e.target.value as Provider);
                      setAmApiId("");
                    }}
                  >
                    <option value="">Model Provider</option>
                    {PROVIDERS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                  <svg viewBox="0 0 24 24">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </div>
              </label>
              <label className="am-field">
                <span className="am-label">
                  <i className="am-req">*</i> Model
                </span>
                <div className="am-select">
                  <select
                    value={amApiId}
                    disabled={!amProvider}
                    onChange={(e) => setAmApiId(e.target.value)}
                  >
                    <option value="">Model</option>
                    {amProvider &&
                      providerModels(amProvider).map((m) => (
                        <option key={m.apiId} value={m.apiId}>
                          {m.name}
                        </option>
                      ))}
                  </select>
                  <svg viewBox="0 0 24 24">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </div>
              </label>
              <label className="am-field">
                <span className="am-label">
                  <i className="am-req">*</i> API Key
                </span>
                <input
                  className="am-input"
                  type="password"
                  autoComplete="off"
                  placeholder={
                    amProvider
                      ? providerInfo(amProvider).keyPlaceholder
                      : "Fill API Key here"
                  }
                  value={amKey}
                  onChange={(e) => setAmKey(e.target.value)}
                />
              </label>
              <label className="am-field">
                <span className="am-label">Custom Request URL</span>
                <input
                  className="am-input"
                  placeholder="e.g., https://api.openai.com/v1/chat/completions"
                  value={amUrl}
                  onChange={(e) => setAmUrl(e.target.value)}
                />
              </label>
              {amError && <div className="am-err">{amError}</div>}
              <div className="am-note">
                Your key is encrypted and stored only on this device
                {passkeySupported() ? ", unlocked with a passkey" : ""}. It
                never touches our servers — calls go straight from your browser
                to the provider.
              </div>
            </div>
            <button
              className="am-submit"
              onClick={submitAddModel}
              disabled={amBusy}
            >
              {amBusy ? "Adding…" : "Add Model"}
            </button>
          </div>
        </div>
      )}

      {/* DRAWER */}
      <div
        className={"scrim" + (drawer ? " show" : "")}
        onClick={() => setDrawer(null)}
      />
      <aside className={"drawer" + (drawer ? " show" : "")}>
        <div className="drawer-head">
          <div className="dt">
            {drawer === "savings"
              ? "How Cortex saves you money"
              : drawer?.shared
                ? "Shared with you"
                : "A memory"}
          </div>
          <button className="x" onClick={() => setDrawer(null)}>
            ✕
          </button>
        </div>
        <div className="drawer-body">
          {drawer &&
            drawer !== "savings" &&
            drawer.shared &&
            (() => {
              const m =
                s.sharedMemories.find((x) => x.id === drawer.id) || drawer;
              // Shared memories are display-only: no retention model, no mutating
              // controls — they belong to whoever shared them.
              return (
                <>
                  <div className="kv">
                    <div className="row">
                      <div className="k">What they shared</div>
                      <div className="v">{m.text}</div>
                    </div>
                    <div className="row">
                      <div className="k">Shared by</div>
                      <div className="v">{m.sharedBy || "someone"}</div>
                    </div>
                    <div className="row">
                      <div className="k">When</div>
                      <div className="v">{ago(m.ts)}</div>
                    </div>
                    <div className="row">
                      <div className="k">Themes</div>
                      <div className="v">
                        {m.tags.map((t) => (
                          <span className="mtag" key={t}>
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="mm-note" style={{ marginTop: 16 }}>
                    Shared with you, read-only. It lives in{" "}
                    {m.sharedBy || "the"}
                    {m.sharedBy ? "’s" : " owner’s"} memory — you can read it,
                    but only they can change it.
                  </div>
                </>
              );
            })()}
          {drawer &&
            drawer !== "savings" &&
            !drawer.shared &&
            (() => {
              const m = live.find((x) => x.id === drawer.id) || drawer;
              const st = memState(m);
              const tier = (m.tier ?? 2) as Tier;
              const ret = Math.round(retention(m, now, cfg) * 100);
              const isCore = tier === 4;
              return (
                <>
                  <div className="kv">
                    <div className="row">
                      <div className="k">What you kept</div>
                      <div className="v">{m.text}</div>
                    </div>
                    <div className="row">
                      <div className="k">When</div>
                      <div className="v">
                        {ago(m.ts)}
                        {m.accessCount ? ` · recalled ${m.accessCount}×` : ""}
                      </div>
                    </div>
                    <div className="row">
                      <div className="k">Themes</div>
                      <div className="v">
                        {m.tags.map((t) => (
                          <span className="mtag" key={t}>
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="mem-model">
                    <div className="mm-row">
                      <span className="mm-k">Retention</span>
                      <div className="mm-bar">
                        <span
                          style={{ width: ret + "%" }}
                          className={"mm-fill " + st}
                        />
                      </div>
                      <span className="mm-pct">{ret}%</span>
                    </div>
                    <div className="mm-tags">
                      <span className={"mm-pill state-" + st}>
                        {STATE_LABEL[st]}
                      </span>
                      <span className="mm-pill">
                        Tier {tier} · {TIER_NAME[tier]}
                      </span>
                      <span className="mm-pill">{m.facet || "casual"}</span>
                      <span
                        className={"mm-pill trust-" + (m.trust || "stated")}
                      >
                        {m.trust === "inferred" ? "inferred" : "you said this"}
                      </span>
                    </div>
                    <div className="mm-note">
                      {isCore
                        ? "Core memory. It sits at full strength and never fades."
                        : st === "forgotten"
                          ? "Out of active recall. The raw record is still safe on Walrus, you can bring it back."
                          : st === "fading"
                            ? "Fading from recall. Use it or keep it to hold on."
                            : st === "pinned"
                              ? "Pinned. Exempt from fading and the daily sweep."
                              : `Strength rises each time you use it, and eases toward its Tier ${tier} floor when you don't.`}
                    </div>
                  </div>
                  <div className="mm-controls">
                    <div className="mm-ctl-h">How much it matters</div>
                    <div className="mm-ctl-row">
                      <button
                        className="pill-btn"
                        onClick={() => {
                          s.likeMem(m.id);
                          flash("Promoted. It matters more now.");
                        }}
                      >
                        <svg viewBox="0 0 24 24">
                          <path d="M7 11v9H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1zM7 11l4-8a2 2 0 0 1 2 2v3h5a2 2 0 0 1 2 2.3l-1.3 7A2 2 0 0 1 16.7 20H7" />
                        </svg>
                        Matters more
                      </button>
                      <button
                        className="pill-btn"
                        onClick={() => {
                          s.dislikeMem(m.id);
                          flash("Eased down. It will fade sooner.");
                        }}
                      >
                        <svg viewBox="0 0 24 24">
                          <path d="M17 13V4h3a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1zM17 13l-4 8a2 2 0 0 1-2-2v-3H6a2 2 0 0 1-2-2.3l1.3-7A2 2 0 0 1 7.3 4H17" />
                        </svg>
                        Matters less
                      </button>
                    </div>
                    <div className="mm-ctl-h">Keep it in mind?</div>
                    <div className="mm-ctl-row">
                      {st === "pinned" || st === "forgotten" ? null : (
                        <button
                          className="pill-btn keep"
                          onClick={() => {
                            s.rememberMem(m.id);
                            flash("Pinned. It won't fade.");
                          }}
                        >
                          Keep in mind
                        </button>
                      )}
                      {st !== "pinned" && tier < 4 && (
                        <button
                          className="pill-btn keep"
                          onClick={() => {
                            s.rememberMem(m.id, true);
                            flash("Set as a core memory.");
                          }}
                        >
                          Make it core
                        </button>
                      )}
                      {st === "forgotten" ? (
                        <button
                          className="pill-btn"
                          onClick={() => {
                            s.restoreMem(m.id);
                            flash("Brought back into recall.");
                          }}
                        >
                          Bring it back
                        </button>
                      ) : (
                        <button
                          className="pill-btn"
                          onClick={() => {
                            s.forgetMem(m.id, false);
                            flash("Set out of mind. Raw record kept.");
                          }}
                        >
                          Forget for now
                        </button>
                      )}
                    </div>
                    <button
                      className="mm-hard"
                      onClick={() => {
                        if (
                          confirm(
                            "Forget this for good? The content and its raw record on Walrus are purged. This cannot be undone.",
                          )
                        ) {
                          s.forgetMem(m.id, true);
                          setDrawer(null);
                          flash("Purged. Only a deletion event remains.");
                        }
                      }}
                    >
                      Forget for good (purge)
                    </button>
                  </div>
                  <div className="mm-controls">
                    <div className="mm-ctl-h">Share it</div>
                    {shareOpen ? (
                      <div className="mm-ctl-row" style={{ flexWrap: "wrap" }}>
                        <input
                          className="cortex-input"
                          style={{ flex: 1, minWidth: 180 }}
                          placeholder="username or username.cortex.sui"
                          value={shareRecipient}
                          disabled={shareBusy}
                          onChange={(e) => setShareRecipient(e.target.value)}
                        />
                        <button
                          className="pill-btn keep"
                          disabled={
                            !wallet || shareBusy || !shareRecipient.trim()
                          }
                          onClick={() => void shareMemory(m)}
                        >
                          {shareBusy ? "Sharing…" : "Share"}
                        </button>
                        <button
                          className="pill-btn"
                          disabled={shareBusy}
                          onClick={() => {
                            setShareOpen(false);
                            setShareErr("");
                          }}
                        >
                          Cancel
                        </button>
                        {shareErr && (
                          <div
                            className="ssub"
                            style={{ flexBasis: "100%", marginTop: 6 }}
                          >
                            {shareErr}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mm-ctl-row">
                        <button
                          className="pill-btn"
                          disabled={!wallet}
                          onClick={() => {
                            setShareErr("");
                            setShareRecipient("");
                            setShareOpen(true);
                          }}
                        >
                          Share this memory
                        </button>
                      </div>
                    )}
                    {!wallet && (
                      <div className="mm-note" style={{ marginTop: 8 }}>
                        Sign in to share a memory with someone.
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          {drawer === "savings" && (
            <>
              <p
                style={{
                  color: "var(--muted)",
                  fontSize: 14.5,
                  lineHeight: 1.7,
                  marginBottom: 20,
                }}
              >
                Every memory could be sent to an AI, and you pay per token.
                Cortex works against that in three ways:
              </p>
              <div className="save-ways">
                <div className="save-way">
                  <div className="sw-i">1</div>
                  <div>
                    <div className="sw-t">
                      It distills, not stores everything
                    </div>
                    <div className="sw-d">
                      Documents ({fmtTokens(sav.raw)} tokens) become compact
                      memories ({fmtTokens(sav.storedTok)} tokens).{" "}
                      {fmtTokens(sav.distillTok)} tokens never sent again.
                    </div>
                  </div>
                </div>
                <div className="save-way">
                  <div className="sw-i">2</div>
                  <div>
                    <div className="sw-t">It merges repeats</div>
                    <div className="sw-d">
                      {fmtTokens(sav.dedupTok)} tokens of duplicates removed so
                      far.
                    </div>
                  </div>
                </div>
                <div className="save-way">
                  <div className="sw-i">3</div>
                  <div>
                    <div className="sw-t">It sends only what matters</div>
                    <div className="sw-d">
                      {sav.reductionPct}% smaller prompts every question.
                    </div>
                  </div>
                </div>
              </div>
              <div className="save-total">
                <div className="st-l">Estimated saved so far</div>
                <div className="st-v">{fmtMoney(sav.realized$)}</div>
                <div className="st-n">
                  across {sav.asks} questions · ≈ {fmtMoney(sav.per100$)} per
                  100
                </div>
              </div>
            </>
          )}
        </div>
      </aside>

      <div className={"toast" + (toast ? " show" : "")}>
        <span className="td" />
        <span>{toast}</span>
      </div>
    </div>
  );
}
