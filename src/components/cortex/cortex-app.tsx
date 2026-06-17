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
import {
  passkeySupported,
  passkeyEnrolled,
} from "@/lib/llm/byok-vault";
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
import {
  AGENTS,
  agentById,
  type AgentDef,
  type TaskStatus,
} from "@/lib/cortex/agents";
import type { LoopStatus } from "@/lib/cortex/loops";
import { useDictation, useReadAloud } from "@/lib/cortex/use-voice";
import { CaptureModal } from "./capture";
import { Markdown } from "./markdown";

const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  open: "Open",
  in_progress: "Working",
  blocked: "Blocked",
  done: "Done",
};

const LOOP_STATUS_LABEL: Record<LoopStatus, string> = {
  draft: "Draft",
  running: "Running",
  paused: "Paused",
  waiting_human: "Needs you",
  done: "Done",
  gave_up: "Gave up",
};

// cortex::sharing MemoryShare.status: 0 DRAFT, 1 ACTIVE, 2 REVOKED.
const SHARE_STATUS_LABEL: Record<number, string> = {
  0: "draft",
  1: "active",
  2: "revoked",
};

const MARK = (
  <svg viewBox="0 0 120 120" fill="currentColor">
    <circle cx="60" cy="60" r="9" />
    {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
      <path
        key={a}
        d="M54 43 L54 27 L49 17 L60 24 L71 17 L66 27 L66 43 L60 48 Z"
        transform={`rotate(${a} 60 60)`}
      />
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
  | "integrations"
  | "settings";
type Theme = "light" | "dark" | "system";

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
  const [input, setInput] = useState("");
  const [memFilter, setMemFilter] = useState("all");
  const [memTab, setMemTab] = useState<"cards" | "timeline">("cards");
  const [captureOpen, setCaptureOpen] = useState(false);
  const [agentGoal, setAgentGoal] = useState("");
  const [agentAssignee, setAgentAssignee] = useState<string>(AGENTS[0]!.id);
  const [awActive, setAwActive] = useState(true);
  const [awLogs, setAwLogs] = useState(false);
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null);
  const [autoTaskId, setAutoTaskId] = useState<string | null>(null);
  const autoStop = useRef(false);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [loopBusy, setLoopBusy] = useState(false);
  const [openLoopId, setOpenLoopId] = useState<string | null>(null);
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
          "settings",
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
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [profileOpen]);
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
    flash(`Set aside ${ids.length} ${ids.length === 1 ? "memory" : "memories"}.`);
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
    flash(`Kept ${ids.length} ${ids.length === 1 ? "memory" : "memories"} close.`);
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
    if (view !== "settings") return;
    void loadDelegates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, walletState?.wallet]);

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

  function toggleChatRail() {
    setChatRailOpen((o) => {
      const n = !o;
      try {
        localStorage.setItem("cortex-chatrail", n ? "1" : "0");
      } catch {}
      return n;
    });
  }

  if (!s.ready)
    return (
      <div style={{ padding: 60, color: "var(--muted)" }}>
        Loading your memory…
      </div>
    );

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
            flash(`Saved locally; Walrus memory failed: ${(err as Error).message}`),
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
      <path
        key="i"
        d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z"
      />,
    ],
    [
      "brain",
      "Brain",
      <>
        <circle key="a" cx="12" cy="12" r="3" />
        <path
          key="b"
          d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"
        />
      </>,
    ],
    [
      "agents",
      "Agents",
      <>
        <circle key="a" cx="9" cy="7" r="3" />
        <circle key="b" cx="17" cy="9" r="2.4" />
        <path key="c" d="M3 20a6 6 0 0 1 12 0M14.5 14.5a4.5 4.5 0 0 1 6.5 4.1" />
      </>,
    ],
    [
      "knowledge",
      "Knowledge",
      <>
        <path key="a" d="M4 5a2 2 0 0 1 2-2h6v18H6a2 2 0 0 1-2-2z" />
        <path key="b" d="M20 5a2 2 0 0 0-2-2h-6v18h6a2 2 0 0 0 2-2z" />
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
        <path
          key="a"
          d="M9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M3 15h4M17 9h4M17 15h4"
        />
        <rect key="b" x="7" y="7" width="10" height="10" rx="2" />
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
  const CORTEX_MCP_URL =
    process.env.NEXT_PUBLIC_CORTEX_MCP_URL || "https://mcp.cortex.id/mcp";
  const mcpSnippet = (kind: "url" | "cli" | "config") =>
    kind === "url"
      ? CORTEX_MCP_URL
      : kind === "cli"
        ? `claude mcp add --transport http cortex ${CORTEX_MCP_URL}`
        : JSON.stringify(
            { mcpServers: { cortex: { url: CORTEX_MCP_URL } } },
            null,
            2,
          );
  const SNIPPET_LABEL: Record<"url" | "cli" | "config", string> = {
    url: "Your Cortex connector URL",
    cli: "Run this once",
    config: "Add to your MCP config",
  };
  const MCP_TOOLS = [
    "recall",
    "remember",
    "ingest",
    "forget",
    "consolidate",
    "verify",
    "run-agent",
    "store-blob",
    "read-context",
  ];
  const MCP_CLIENTS: {
    key: string;
    name: string;
    kind: "url" | "cli" | "config";
    blurb: string;
    steps: string[];
  }[] = [
    {
      key: "chatgpt",
      name: "ChatGPT",
      kind: "url",
      blurb:
        "Reach your Cortex memory from ChatGPT — and let every chat build it.",
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
      claude: (
        <path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4" />
      ),
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
    setIntOpen((o) => (o === key ? null : key));
  }
  function copySnippet(kind: "url" | "cli" | "config") {
    navigator.clipboard?.writeText(mcpSnippet(kind));
    flash("Setup copied to clipboard");
  }
  function copyText(text: string, label = "Setup copied to clipboard") {
    navigator.clipboard?.writeText(text);
    flash(label);
  }

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
    setOpenTaskId(taskId);
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
  function stopAutoRun() {
    autoStop.current = true;
  }
  async function createAndRun() {
    const goal = agentGoal.trim();
    if (!goal) return;
    const id = s.createTask(goal, agentAssignee);
    setAgentGoal("");
    if (id) await autoRunTask(id);
  }
  async function makeLoopFromStudio() {
    const goal = studioTask.trim();
    if (!goal || loopBusy) return;
    setLoopBusy(true);
    flash("Reading memory to write the loop…");
    try {
      const id = await s.generateLoop(goal, AGENTS[0]!.id);
      if (id) {
        setOpenLoopId(id);
        s.startLoop(id);
        setView("agents");
        flash("Loop running on the Agents page.");
      }
    } finally {
      setLoopBusy(false);
    }
  }
  async function createAndLoop() {
    const goal = agentGoal.trim();
    if (!goal || loopBusy) return;
    setLoopBusy(true);
    flash("Reading memory to write the loop…");
    try {
      const id = await s.generateLoop(goal, agentAssignee);
      setAgentGoal("");
      if (id) {
        setOpenLoopId(id);
        s.startLoop(id);
        flash("Loop running — it will correct itself toward the goal.");
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
        (memFilter === "__shared"
          ? !!m.shared
          : m.tags.includes(memFilter))) &&
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
        "app" +
        (onHome ? " home-rail" : "") +
        (railOn ? " rail-expanded" : "")
      }
    >
      <header className="topbar">
        <div className="topbar-inner">
          <div className="tb-left">
            <a className="tb-brand" href="#home" onClick={() => setView("home")}>
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
                          href="#settings"
                          onClick={() => {
                            setView("settings");
                            setProfileOpen(false);
                          }}
                        >
                          <span className="dot" />
                          {claimedName}
                        </a>
                      ) : sess ? (
                        <a
                          className="you-claim"
                          href="#settings"
                          onClick={() => {
                            setView("settings");
                            setProfileOpen(false);
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
                    <span style={{ flex: 1, textAlign: "left" }}>Developer</span>
                    <span className="dev-switch" />
                  </button>
                  <button
                    className="tb-menu-item"
                    onClick={() => {
                      setView("settings");
                      setProfileOpen(false);
                    }}
                  >
                    <svg viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                    <span>Settings</span>
                  </button>
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
        className={"chat-rail" + (onHome ? " on-home" : "") + (railOn ? " open" : "")}
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
          className={"cr-log" + (view === "agents" ? " on" : "")}
          onClick={() => setView("agents")}
        >
          <span className="cr-log-l">
            <svg viewBox="0 0 24 24">
              <path d="M4.5 16.5c-1.5 1.5-2 5-2 5s3.5-.5 5-2a2.1 2.1 0 0 0-3-3z" />
              <path d="M12 15l-3-3a11 11 0 0 1 7-7 11 11 0 0 1 0 7l-4 3z" />
              <path d="M9 12a3 3 0 0 1 3 3" />
            </svg>
            <span className="cr-log-t">Agent log</span>
          </span>
          <svg className="cr-log-chev" viewBox="0 0 24 24">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      </aside>

      <main className="main">
        <div className="wrap">
          {/* HOME */}
          <section className={"view" + (view === "home" ? " on" : "")}>
            {(!hasChat ? (
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
                          (m.origin
                            ? m.origin.split(/[\\/]/).pop()
                            : null) ||
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
                                  <svg
                                    className="hc-heart"
                                    viewBox="0 0 24 24"
                                  >
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
                {s.chat.map((m, i) => (
                  <div key={i}>
                    <div>
                      <div className="bubble-q">
                        {m.q}
                        {m.docs.length > 0 && (
                          <span className="q-docs">
                            {m.docs.map((d) => "📎 " + d).join(" ")}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="bubble-a">
                      <div className="atext">
                        {m.streaming ? m.a : <Markdown text={m.a} />}
                      </div>
                      {!m.streaming &&
                        (() => {
                          const webRefs = m.sources.filter(
                            (src) => src.type === "web",
                          );
                          const memRefs = m.sources.filter(
                            (src) => src.type === "memory",
                          );
                          return (
                            <>
                              {m.web && webRefs.length > 0 && (
                                <div className="ans-refs">
                                  <div className="ans-refs-head">
                                    References
                                    <span className="ans-refs-n">
                                      {webRefs.length} result
                                      {webRefs.length === 1 ? "" : "s"}
                                    </span>
                                  </div>
                                  <div className="ans-refs-list">
                                    {webRefs.map((src, n) => (
                                      <a
                                        key={n}
                                        className="ref-row"
                                        href={`https://${src.url}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      >
                                        <span className="ref-dot" />
                                        <span className="ref-txt">
                                          <b>{src.title}</b>
                                          <span className="ref-sub">
                                            {src.url}
                                          </span>
                                        </span>
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {memRefs.length > 0 && (
                                <div className="ans-refs">
                                  <div className="ans-refs-head">
                                    Memories used
                                    <span className="ans-refs-n">
                                      {memRefs.length} memor
                                      {memRefs.length === 1 ? "y" : "ies"}
                                    </span>
                                  </div>
                                  <div className="ans-refs-list">
                                    {memRefs.map((src, n) => (
                                      <span key={n} className="ref-row mem">
                                        <svg
                                          className="ref-ic"
                                          viewBox="0 0 24 24"
                                        >
                                          <path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z" />
                                        </svg>
                                        <span className="ref-txt">
                                          <b>
                                            {src.text!.length > 64
                                              ? src.text!.slice(0, 64) + "…"
                                              : src.text}
                                          </b>
                                          <span className="ref-sub">
                                            {src.label}
                                            {src.when ? ` · ${src.when}` : ""}
                                          </span>
                                        </span>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      {!m.streaming && (
                        <div className="ans-foot">
                          <button
                            className="ans-save"
                            onClick={() => {
                              s.remember(m.a, "normal");
                              flash("Saved this answer to your memory.");
                            }}
                          >
                            <svg viewBox="0 0 24 24">
                              <path d="M12 5v14M5 12h14" />
                            </svg>
                            Remember this
                          </button>
                          {readAloud.supported && m.a && (
                            <button
                              className="ans-save"
                              onClick={() =>
                                readAloud.speaking
                                  ? readAloud.stop()
                                  : readAloud.speak(m.a)
                              }
                            >
                              <svg viewBox="0 0 24 24">
                                <path d="M11 5 6 9H3v6h3l5 4zM16 9a4 4 0 0 1 0 6M19 7a8 8 0 0 1 0 10" />
                              </svg>
                              {readAloud.speaking ? "Stop" : "Read aloud"}
                            </button>
                          )}
                          <span className="src">
                            {m.model}
                            {m.savedNote && (
                              <>
                                {" "}
                                ·{" "}
                                <span className="ask-saved">{m.savedNote}</span>
                              </>
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              ))}
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

          {/* AGENTS — a team of specialists over one shared, durable memory */}
          <section
            className={"view" + (view === "agents" ? " on" : "")}
          >
            <div className="cards" style={{ marginTop: 16 }}>
              {AGENTS.map((a: AgentDef) => (
                <div
                  key={a.id}
                  className="scard"
                  style={{ borderLeft: `3px solid ${a.accent}` }}
                >
                  <div
                    className="st"
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: a.accent,
                        flex: "0 0 auto",
                      }}
                    />
                    {a.name}
                    <span
                      style={{
                        textTransform: "capitalize",
                        color: "var(--muted)",
                        fontWeight: 400,
                      }}
                    >
                      · {a.role}
                    </span>
                  </div>
                  <div className="ssub">{a.blurb}</div>
                </div>
              ))}
            </div>

            <div className="scard" style={{ marginTop: 20 }}>
              <div className="filters" style={{ marginBottom: 10 }}>
                {AGENTS.map((a) => (
                  <button
                    key={a.id}
                    className={"fchip" + (agentAssignee === a.id ? " on" : "")}
                    onClick={() => setAgentAssignee(a.id)}
                  >
                    {a.name}
                  </button>
                ))}
              </div>
              <textarea
                className="st2-task"
                rows={2}
                placeholder={`Give ${agentById(agentAssignee)?.name ?? "the team"} a goal — e.g. "find what I've kept about Walrus and summarize it"`}
                value={agentGoal}
                onChange={(e) => setAgentGoal(e.target.value)}
              />
              <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  className="pill-btn keep"
                  onClick={() => void createAndRun()}
                  disabled={
                    !agentGoal.trim() ||
                    runningTaskId !== null ||
                    autoTaskId !== null
                  }
                >
                  Assign &amp; run
                </button>
                <button
                  className="pill-btn"
                  onClick={() => void createAndLoop()}
                  disabled={!agentGoal.trim() || loopBusy}
                  title="Cortex reads this agent's memory to write a loop spec, then runs it until the goal is met"
                >
                  {loopBusy ? "Writing the loop…" : "Run as a loop"}
                </button>
              </div>
            </div>

            {s.loops.length > 0 && (
              <>
                <h2 style={{ marginTop: 28, fontSize: 18, fontWeight: 600 }}>
                  Loops
                </h2>
                <p className="ssub" style={{ marginBottom: 10 }}>
                  Self-correcting runs. The spec is generated from memory; each
                  iteration senses, acts, and verifies until a gate passes or the
                  budget runs out.
                </p>
                <div className="story">
                  {s.loops.map((r) => {
                    const owner = agentById(r.spec.agentId);
                    const open = openLoopId === r.spec.id;
                    return (
                      <div key={r.spec.id} className="snode">
                        <div className="when">{ago(r.updatedAt)}</div>
                        <div
                          className="scard"
                          style={
                            owner
                              ? { borderLeft: `3px solid ${owner.accent}` }
                              : undefined
                          }
                        >
                          <div
                            className="st"
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              flexWrap: "wrap",
                            }}
                          >
                            <span
                              className="fchip on"
                              style={{ cursor: "default" }}
                            >
                              {LOOP_STATUS_LABEL[r.status]}
                            </span>
                            {owner && (
                              <span style={{ color: owner.accent }}>
                                {owner.name}
                              </span>
                            )}
                            <span style={{ fontWeight: 400 }}>{r.spec.goal}</span>
                          </div>
                          <div className="ssub">
                            iteration {r.iterations.length}/
                            {r.spec.budget.maxIterations} ·{" "}
                            {fmtTokens(r.tokensUsed)}/
                            {fmtTokens(r.spec.budget.maxTokens)} tokens ·{" "}
                            {r.spec.loopType}
                          </div>
                          {r.status === "waiting_human" && (
                            <div
                              className="ssub"
                              style={{ marginTop: 6, color: "var(--accent,#b45309)" }}
                            >
                              Waiting on you · {r.spec.humanGate}
                            </div>
                          )}
                          <div
                            className="filters"
                            style={{ marginTop: 10, gap: 6 }}
                          >
                            {r.status === "running" ? (
                              <button
                                className="pill-btn"
                                onClick={() => s.stopLoop(r.spec.id)}
                              >
                                Stop
                              </button>
                            ) : (
                              r.status !== "done" && (
                                <button
                                  className="pill-btn keep"
                                  onClick={() => s.startLoop(r.spec.id)}
                                >
                                  {r.iterations.length ? "Resume" : "Start"}
                                </button>
                              )
                            )}
                            <button
                              className="fchip"
                              onClick={() =>
                                setOpenLoopId(open ? null : r.spec.id)
                              }
                            >
                              {open ? "Hide" : "Trace"}
                            </button>
                          </div>

                          {open && (
                            <div style={{ marginTop: 12 }}>
                              <div className="ssub" style={{ marginBottom: 6 }}>
                                Gates:{" "}
                                {r.spec.gates
                                  .map((g) => `${g.name} (${g.kind})`)
                                  .join(", ") || "none"}{" "}
                                · Guardrails: {r.spec.guardrails.join("; ")}
                              </div>
                              {r.iterations.length ? (
                                r.iterations
                                  .slice()
                                  .reverse()
                                  .map((it) => (
                                    <div
                                      key={it.n}
                                      className="scard"
                                      style={{ marginBottom: 8 }}
                                    >
                                      <div
                                        className="ssub"
                                        style={{ marginBottom: 4 }}
                                      >
                                        #{it.n} · {it.gate ?? "no gate"} ·{" "}
                                        <span
                                          style={{
                                            color:
                                              it.verdict === "pass"
                                                ? "#10b981"
                                                : it.verdict === "fail"
                                                  ? "#ef4444"
                                                  : "var(--muted)",
                                          }}
                                        >
                                          {it.verdict}
                                        </span>{" "}
                                        · {ago(it.ts)}
                                      </div>
                                      <div style={{ whiteSpace: "pre-wrap" }}>
                                        {it.acted}
                                      </div>
                                      {it.feedback && (
                                        <div
                                          className="ssub"
                                          style={{ marginTop: 6 }}
                                        >
                                          ↳ {it.feedback}
                                        </div>
                                      )}
                                    </div>
                                  ))
                              ) : (
                                <div className="ssub">
                                  No iterations yet — start the loop.
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {s.tasks.length ? (
              <div className="story" style={{ marginTop: 20 }}>
                {s.tasks.map((t) => {
                  const owner = agentById(t.assignedTo);
                  const open = openTaskId === t.id;
                  const running = runningTaskId === t.id;
                  return (
                    <div key={t.id} className="snode">
                      <div className="when">{ago(t.updatedAt)}</div>
                      <div
                        className="scard"
                        style={
                          owner
                            ? { borderLeft: `3px solid ${owner.accent}` }
                            : undefined
                        }
                      >
                        <div
                          className="st"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          <span
                            className="fchip on"
                            style={{ cursor: "default" }}
                          >
                            {TASK_STATUS_LABEL[t.status]}
                          </span>
                          {owner && (
                            <span style={{ color: owner.accent }}>
                              {owner.name}
                            </span>
                          )}
                          <span style={{ fontWeight: 400 }}>{t.goal}</span>
                        </div>
                        <div className="ssub">
                          {t.observations.length}{" "}
                          {t.observations.length === 1 ? "step" : "steps"} ·
                          created {ago(t.createdAt)}
                        </div>

                        <div
                          className="filters"
                          style={{ marginTop: 10, gap: 6 }}
                        >
                          {autoTaskId === t.id ? (
                            <button
                              className="pill-btn"
                              onClick={stopAutoRun}
                            >
                              {running ? "Working…" : "Stopping…"} · Stop
                            </button>
                          ) : (
                            <button
                              className="pill-btn keep"
                              onClick={() => void autoRunTask(t.id)}
                              disabled={
                                autoTaskId !== null || runningTaskId !== null
                              }
                            >
                              Run
                            </button>
                          )}
                          <button
                            className="fchip"
                            onClick={() => void runStep(t.id)}
                            disabled={
                              running ||
                              runningTaskId !== null ||
                              autoTaskId !== null
                            }
                          >
                            {running && autoTaskId !== t.id
                              ? "Working…"
                              : "Step once"}
                          </button>
                          <button
                            className="fchip"
                            onClick={() =>
                              setOpenTaskId(open ? null : t.id)
                            }
                          >
                            {open ? "Hide" : "Details"}
                          </button>
                          {t.status !== "done" && (
                            <button
                              className="fchip"
                              onClick={() => s.completeTask(t.id)}
                            >
                              Mark done
                            </button>
                          )}
                        </div>

                        {open && (
                          <div style={{ marginTop: 12 }}>
                            <div
                              className="ssub"
                              style={{ marginBottom: 6 }}
                            >
                              Hand off to continue:
                            </div>
                            <div
                              className="filters"
                              style={{ gap: 6, marginBottom: 12 }}
                            >
                              {AGENTS.filter(
                                (a) => a.id !== t.assignedTo,
                              ).map((a) => (
                                <button
                                  key={a.id}
                                  className="fchip"
                                  onClick={() => s.handoffTask(t.id, a.id)}
                                >
                                  → {a.name}
                                </button>
                              ))}
                            </div>
                            {t.observations.length ? (
                              t.observations.map((o) => {
                                const by = agentById(o.agentId);
                                return (
                                  <div
                                    key={o.id}
                                    className="scard"
                                    style={{ marginBottom: 8 }}
                                  >
                                    <div
                                      className="ssub"
                                      style={{
                                        color: by?.accent,
                                        marginBottom: 4,
                                      }}
                                    >
                                      {by?.name ?? "Agent"} · {ago(o.ts)}
                                    </div>
                                    <div style={{ whiteSpace: "pre-wrap" }}>
                                      {o.text}
                                    </div>
                                    <div style={{ marginTop: 8 }}>
                                      <button
                                        className="fchip"
                                        onClick={() => saveFinding(t.id, o.id)}
                                      >
                                        Save to memory
                                      </button>
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              <div className="ssub">
                                No steps yet — run one to begin.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty" style={{ marginTop: 20 }}>
                <div className="et">No tasks yet</div>
                <div className="es">
                  Assign a goal above and an agent will start working it.
                </div>
              </div>
            )}

            {s.agentMessages.length > 0 && (
              <>
                <h2
                  style={{
                    marginTop: 28,
                    fontSize: 18,
                    fontWeight: 600,
                  }}
                >
                  Message bus
                </h2>
                <p className="ssub" style={{ marginBottom: 10 }}>
                  Every handoff and result is persisted to Walrus + Sui.
                </p>
                <div className="story">
                  {s.agentMessages.slice(0, 30).map((m) => {
                    const from = agentById(m.from);
                    const to = agentById(m.to);
                    return (
                      <div key={m.id} className="snode">
                        <div className="when">{ago(m.ts)}</div>
                        <div className="scard">
                          <div className="ssub" style={{ marginBottom: 4 }}>
                            <span style={{ color: from?.accent }}>
                              {from?.name ?? (m.from === "user" ? "You" : m.from)}
                            </span>{" "}
                            →{" "}
                            <span style={{ color: to?.accent }}>
                              {to?.name ?? (m.to === "team" ? "Team" : m.to)}
                            </span>{" "}
                            · {m.kind}
                          </div>
                          <div>{m.content}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </section>

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
                      className={"cap-tool web-chip" + (s.web ? " on" : "")}
                      onClick={() => s.toggleWeb()}
                      title="Search the web"
                    >
                      <svg viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
                      </svg>{" "}
                      Web
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
                        title={
                          studioMode === "loop"
                            ? "Write a self-correcting loop from this goal and your memory, then run it"
                            : "Generate a prompt from this task and your memory"
                        }
                      >
                        {studioMode === "loop"
                          ? loopBusy
                            ? "Writing the loop…"
                            : "Generate loop"
                          : studioLoading
                            ? "Generating…"
                            : "Generate"}
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
                <div className="is">Drag &amp; drop PDFs, TXT, or MD files here</div>
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
              <div
                className="share-modal"
                onClick={(e) => e.stopPropagation()}
              >
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
                  Sharing needs your Sui wallet so memories stay owned by you.
                  Sign in to claim a username and share memories with others.
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
                      Claiming mints a real SuiNS leaf subname under cortex.sui
                      and points it at your wallet, so others can share with you
                      by name.
                    </div>
                    {claimedName ? (
                      <div className="ssub" style={{ marginTop: 10 }}>
                        You hold{" "}
                        <span style={{ fontFamily: "var(--mono,monospace)" }}>
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
                      someone by username, name.cortex.sui or 0x address. They
                      get a read-only copy.
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
                                className={"share-check" + (on ? " on" : "")}
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
                                  {m.tags.join(" · ") || "note"} · {ago(m.ts)}
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
                                  {m.tags.join(" · ") || "note"} · {ago(m.ts)}
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
                    <div className="int2-name">Outbox · {s.shares.length}</div>
                    {s.shares.length === 0 ? (
                      <div className="ssub" style={{ marginTop: 10 }}>
                        Nothing shared yet. Pick memories above, or open a memory
                        and use “Share”.
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
                                className={
                                  "share-status s" + sh.status
                                }
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
                      One server exposes your whole memory plane to any MCP host —
                      read and write memory, drive the agent team, and (once you
                      authorize it) read your details, memory and context.
                    </div>
                    <div className="int2-tools">
                      {MCP_TOOLS.map((t) => (
                        <span className="int2-tool" key={t}>
                          {t}
                        </span>
                      ))}
                    </div>
                    {(
                      [
                        [
                          "Memory",
                          "recall · remember · ingest · forget · consolidate · verify",
                        ],
                        [
                          "Agents",
                          "a researcher / curator / planner / critic team — task board + message bus",
                        ],
                        [
                          "Your data",
                          "profile · memory · context, read by an MCP you authorize",
                        ],
                        [
                          "Execution",
                          "store & read Walrus blobs · record Sui pointers · restore MemWal",
                        ],
                        [
                          "Connectors",
                          "fetch the web into memory · push events to webhooks",
                        ],
                      ] as const
                    ).map(([k, v]) => (
                      <div
                        key={k}
                        style={{
                          display: "flex",
                          gap: 10,
                          padding: "6px 0",
                          borderTop: "1px solid var(--line, rgba(0,0,0,0.08))",
                        }}
                      >
                        <span style={{ minWidth: 92, fontWeight: 600 }}>
                          {k}
                        </span>
                        <span className="ssub">{v}</span>
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
                            className={
                              "int2-btn" + (intOpen === c.key ? " on" : "")
                            }
                            onClick={() => intConnect(c.key)}
                          >
                            {intOpen === c.key ? "Hide" : "Connect"}
                          </button>
                        </div>
                        {intOpen === c.key && (
                          <div className="int2-snip">
                            <ol className="int2-steps">
                              {c.steps.map((step, i) => (
                                <li key={i}>{step}</li>
                              ))}
                            </ol>
                            <div className="int2-snip-h">
                              <span>{SNIPPET_LABEL[c.kind]}</span>
                              <button
                                className="int2-copy"
                                onClick={() => copySnippet(c.kind)}
                              >
                                Copy
                              </button>
                            </div>
                            <pre>{mcpSnippet(c.kind)}</pre>
                            <div className="int2-snip-n">
                              {c.kind === "url"
                                ? "Connects to your managed Cortex over an encrypted channel — no local server to run."
                                : "Points the client at your managed Cortex over an encrypted channel."}
                            </div>
                          </div>
                        )}
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
                      style={{ marginTop: 10, fontFamily: "var(--mono,monospace)" }}
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
                            className={
                              "int2-btn" + (intOpen === c.key ? " on" : "")
                            }
                            onClick={() => intConnect(c.key)}
                          >
                            {intOpen === c.key ? "Hide" : "Connect"}
                          </button>
                        </div>
                        {intOpen === c.key && (
                          <div className="int2-snip">
                            <div className="int2-snip-h">
                              <span>Pull prompts, skills and memory</span>
                              <button
                                className="int2-copy"
                                onClick={() => copyText(c.code)}
                              >
                                Copy
                              </button>
                            </div>
                            <pre>{c.code}</pre>
                            <div className="int2-snip-n">
                              Reads and refines the same memory, kept by you on
                              Walrus and sealed.
                            </div>
                          </div>
                        )}
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
            </div>
          </section>

          {/* SETTINGS — memory model + account & storage */}
          <section className={"view" + (view === "settings" ? " on" : "")}>
            <div className="set-group">
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
                  <span className="set-av">{sess.via[0]?.toUpperCase()}</span>
                  <div className="set-acc-m">
                    <div className="set-acc-n">Signed in · {sess.via}</div>
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
            </div>

            <div className="set-group">
              <div className="set-gh">
                <div className="set-gt">Models &amp; API keys</div>
                <div className="set-gs">
                  Bring your own keys to enable any model. Keys are encrypted and
                  stored only on this device — calls run straight from your
                  browser to the provider, never our servers.
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
                      {s.byokKeys[m.id] ? "Key unlocked" : "Key locked"} ·{" "}
                      {m.apiId}
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
                  <button className="pill-btn" onClick={() => s.unlockByok()}>
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
                <div className="set-err">Couldn&apos;t unlock: {s.byokError}</div>
              )}
            </div>

            <div className="set-group">
              <div className="set-gh">
                <div className="set-gt">Privacy &amp; Access</div>
                <div className="set-gs">
                  How your data is protected and who can reach it. Sensitive data
                  is encrypted client-side before it ever touches Walrus — only
                  your wallet can decrypt it.
                </div>
              </div>

              <div className="scard" style={{ marginBottom: 16 }}>
                <div className="int2-name">Encryption mode</div>
                <div className="ssub" style={{ marginTop: 4 }}>
                  {sealEnabled()
                    ? "Owner-only Seal encryption (threshold key servers)"
                    : "Wallet-derived AES-GCM (owner-only)"}
                </div>
              </div>

              <div className="scard" style={{ marginBottom: 16 }}>
                <div className="int2-name">What&apos;s public vs owner-only</div>
                {(
                  [
                    ["Public", "your profile (name, handle, bio)"],
                    [
                      "Owner-only",
                      "chats, memory, timeline, documents, agent tasks — encrypted; only pointers on Sui",
                    ],
                    ["Owner-only", "agent prompts & descriptions"],
                    ["Never on chain", "the MCP service key (server-side only)"],
                  ] as const
                ).map(([k, v], i) => (
                  <div
                    key={k + i}
                    style={{
                      display: "flex",
                      gap: 10,
                      padding: "6px 0",
                      borderTop: "1px solid var(--line, rgba(0,0,0,0.08))",
                    }}
                  >
                    <span style={{ minWidth: 92, fontWeight: 600 }}>{k}</span>
                    <span className="ssub">{v}</span>
                  </div>
                ))}
              </div>

              <div className="scard">
                <div className="int2-name">MCP access</div>
                <div className="ssub" style={{ marginTop: 4 }}>
                  An authorized MCP gets your profile, your memory, and your
                  shared agent workspace (board + bus). You can revoke anytime.
                </div>
                <div
                  className="ssub"
                  style={{ marginTop: 10, fontFamily: "var(--mono,monospace)" }}
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

            <div className="set-group">
              <div className="set-gh">
                <div className="set-gt">Username &amp; sharing</div>
                <div className="set-gs">
                  Claim a handle under cortex.sui so others can share memories
                  with you by name. Manage shares and your inbox in the Sharing
                  view.
                </div>
              </div>

              <div className="scard" style={{ marginBottom: 16 }}>
                <div className="int2-name">Username</div>
                <div className="ssub" style={{ marginTop: 4 }}>
                  Claiming mints a real SuiNS subname under cortex.sui and points
                  it at your wallet.
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
                    <span style={{ fontFamily: "var(--mono,monospace)" }}>
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

            <div className="set-group">
              <div className="set-gh">
                <div className="set-gt">Devices &amp; Access</div>
                <div className="set-gs">
                  Each device and agent that can read your memory has its own
                  key, derived on that device and never stored — revoke any of
                  them anytime.
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
                          borderTop: "1px solid var(--line, rgba(0,0,0,0.08))",
                        }}
                      >
                        <span style={{ minWidth: 110, fontWeight: 600 }}>
                          {label}
                        </span>
                        <span
                          className="ssub"
                          style={{
                            flex: 1,
                            fontFamily: "var(--mono,monospace)",
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
                            onClick={() => void revokeDelegate(d.publicKey)}
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

            <div className="set-group">
              <div className="set-gh">
                <div className="set-gt">Memory model</div>
                <div className="set-gs">
                  How Cortex forgets and remembers. It mirrors human memory: it
                  forgets by default and keeps what earns it. These are the
                  dials.
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
                  onChange={(e) => s.setConfig({ theta: +e.target.value })}
                />
                <div className="set-fh">
                  A memory stays in active recall while its strength is at or
                  above this. Lower means Cortex holds on to more.
                </div>
              </div>
              <div className="set-field">
                <div className="set-fl">
                  <span>Rehearsal bump</span>
                  <span className="set-fv">+{cfg.accessBump.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0.05}
                  max={0.4}
                  step={0.01}
                  value={cfg.accessBump}
                  onChange={(e) => s.setConfig({ accessBump: +e.target.value })}
                />
                <div className="set-fh">
                  How much strength a memory gains each time you use it. Higher
                  means recall sticks faster.
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
                  Memories Cortex guessed (rather than you stating them) fade
                  this much faster, so the loop never launders a guess into
                  fact.
                </div>
              </div>
              <div className="set-field">
                <div className="set-fl">
                  <span>Consolidation sweep</span>
                  <span className="set-fv">every {cfg.sweepHours}h</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={72}
                  step={1}
                  value={cfg.sweepHours}
                  onChange={(e) => s.setConfig({ sweepHours: +e.target.value })}
                />
                <div className="set-fh">
                  How often Cortex runs its quiet pass to fade, fold, promote
                  and re-link, the way sleep consolidates memory.
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
                Floor is the strength a tier can never fall below. Tier 4 sits
                at 1.0, so a core memory (an allergy, a hard rule) can never
                drop out of recall.
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

            <div className="set-group">
              <div className="set-gh">
                <div className="set-gt">Reset memory</div>
                <div className="set-gs">
                  Clear this browser&apos;s working memory and start from a blank
                  slate. Your durable record on Walrus is not touched — this only
                  wipes the local index.
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
                  setView("home");
                  flash("Memory cleared. Starting fresh.");
                }}
              >
                Reset memory
              </button>
            </div>
          </section>
        </div>

        {/* BRAIN — full-bleed memory map */}
        {view === "brain" && (
          <div className="brain-stage">
            <MemoryMap onOpen={(m) => setDrawer(m)} theme={eff} />
          </div>
        )}

        {/* GLOBAL COMPOSER (hidden on full-page views) */}
        {view !== "studio" &&
          view !== "integrations" &&
          view !== "settings" &&
          view !== "agents" && (
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
                    <button
                      className={s.mode === "remember" ? "on" : ""}
                      onClick={() => s.setMode("remember")}
                    >
                      <svg viewBox="0 0 24 24">
                        <path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6z" />
                      </svg>
                      Remember
                    </button>
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
                        "cap-tool web-chip ask-only" + (s.web ? " on" : "")
                      }
                      onClick={() => s.toggleWeb()}
                    >
                      <svg viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
                      </svg>{" "}
                      Web
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
                {passkeySupported()
                  ? ", unlocked with a passkey"
                  : ""}
                . It never touches our servers — calls go straight from your
                browser to the provider.
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
                    Shared with you, read-only. It lives in {m.sharedBy || "the"}
                    {m.sharedBy ? "’s" : " owner’s"} memory — you can read it, but
                    only they can change it.
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
                          disabled={!wallet || shareBusy || !shareRecipient.trim()}
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
