"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useCortex } from "@/lib/cortex/store";
import {
  ago,
  computeSavings,
  findClusters,
  findPattern,
  fmtMoney,
  fmtTokens,
  MODELS,
  type Memory,
} from "@/lib/cortex/logic";
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
import { CaptureModal } from "./capture";

const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  open: "Open",
  in_progress: "Working",
  blocked: "Blocked",
  done: "Done",
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

// A reflection suggestion shown on the Reflect view. `loading` marks the
// transient "thinking" placeholder; the rest describe a proposed change.
type Notice = {
  loading?: boolean;
  kind?: "merge" | "pattern" | "tidy";
  title?: string;
  body?: React.ReactNode;
  ids?: string[];
  keepId?: string;
  tag?: string;
  count?: number;
};

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
  const [railOpen, setRailOpen] = useState(true);
  const [dev, setDev] = useState(false);
  const [input, setInput] = useState("");
  const [memFilter, setMemFilter] = useState("all");
  const [memQuery, setMemQuery] = useState("");
  const [memTab, setMemTab] = useState<"cards" | "timeline">("cards");
  const [captureOpen, setCaptureOpen] = useState(false);
  const [agentGoal, setAgentGoal] = useState("");
  const [agentAssignee, setAgentAssignee] = useState<string>(AGENTS[0]!.id);
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [rrIdx, setRrIdx] = useState(0);
  const [rmIdx, setRmIdx] = useState(0);
  const [reflectIdx, setReflectIdx] = useState(0);
  const [reflected, setReflected] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [drawer, setDrawer] = useState<Memory | "savings" | null>(null);
  const [notices, setNotices] = useState<Notice[] | null>(null);
  const [dreams, setDreams] = useState<
    { title: string; body: string }[] | null
  >(null);
  const [dreaming, setDreaming] = useState(false);
  const [studioTask, setStudioTask] = useState("");
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
    "all" | "mcp" | "frameworks" | "storage" | "sources"
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
  const [toast, setToast] = useState("");
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
    } catch {}
    const apply = () => {
      const h = location.hash.slice(1) as View;
      if (
        [
          "home",
          "memories",
          "reflect",
          "brain",
          "studio",
          "knowledge",
          "integrations",
          "settings",
        ].includes(h)
      )
        setView(h);
    };
    apply();
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
    }, 6000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletState?.wallet, s.chat, s.events, s.documents, s.tasks, s.agentMessages]);
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
  // Reflect on load: surface insights + tidy-ups for the Home carousel.
  useEffect(() => {
    if (s.ready && !reflected && s.live().length) {
      setReflected(true);
      runReflect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.ready, reflected]);
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

  useEffect(() => {
    if (view !== "settings") return;
    void loadDelegates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, walletState?.wallet]);

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

  // ---- reflect ----
  function runReflect() {
    setNotices([{ loading: true }]);
    // Dreams: AI-surfaced insights across your memories (with fallback).
    setDreaming(true);
    setDreams(null);
    fetch("/api/dream", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ memories: live }),
    })
      .then((r) => r.json())
      .then((d) => setDreams(d.dreams || []))
      .catch(() => setDreams([]))
      .finally(() => setDreaming(false));
    setTimeout(() => {
      const out: Notice[] = [];
      findClusters(live).forEach((g) => {
        const c = g.slice().sort((a, b) => b.text.length - a.text.length)[0]!;
        out.push({
          kind: "merge",
          ids: g.map((m) => m.id),
          keepId: c.id,
          title: `You noted something ${g.length} times`,
          body: (
            <>
              Cortex can fold these into one: <em>“{c.text}”</em>
            </>
          ),
        });
      });
      const p = findPattern(live);
      if (p)
        out.push({
          kind: "pattern",
          tag: p.tag,
          title: "A gentle pattern is forming",
          body: (
            <>
              Your memories keep circling back to <strong>{p.tag}</strong>,{" "}
              {p.count} of them now.
            </>
          ),
        });
      const old = live.find((m) => Date.now() - m.ts > 25 * 86400000);
      if (old)
        out.push({
          kind: "tidy",
          ids: [old.id],
          title: "One memory has gone quiet",
          body: (
            <>
              “{old.text}” hasn&apos;t come up in a while. Cortex can set it
              aside.
            </>
          ),
        });
      setNotices(out);
    }, 700);
  }

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
    [
      "settings",
      "Settings",
      <>
        <circle key="a" cx="12" cy="12" r="3" />
        <path
          key="b"
          d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
        />
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
  const recommendations = (() => {
    const recs: string[] = [];
    findClusters(live)
      .slice(0, 2)
      .forEach((g) => {
        const t = g[0]!.tags[0];
        if (t) recs.push(`What do I know about ${t}?`);
      });
    const p = findPattern(live);
    if (p) recs.push(`Summarize everything I've kept about ${p.tag}`);
    const tg = [...new Set(live.flatMap((m) => m.tags))].filter(
      (t) => t !== "note",
    );
    tg.slice(0, 2).forEach((t) => {
      if (!recs.some((r) => r.includes(t)))
        recs.push(`What should I remember about ${t}?`);
    });
    return [...new Set(recs)].slice(0, 5);
  })();
  function runRec(q: string) {
    setView("home");
    s.setMode("ask");
    s.ask(q);
  }

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
  const mcpSnippet = (key: string) =>
    key === "claude-code"
      ? "claude mcp add cortex -- npx tsx ./mcp/server.ts"
      : JSON.stringify(
          {
            mcpServers: {
              cortex: {
                command: "npx",
                args: ["tsx", "./mcp/server.ts"],
                env: { CORTEX_CONFIG: "./config/config.yaml" },
              },
            },
          },
          null,
          2,
        );
  const MCP_CLIENTS = [
    {
      key: "claude-desktop",
      letter: "C",
      name: "Claude Desktop",
      desc: "Let Claude read and write your Cortex memory in any chat.",
    },
    {
      key: "claude-code",
      letter: "C",
      name: "Claude Code",
      desc: "Your conventions, decisions and project context, remembered in the CLI.",
    },
    {
      key: "cursor",
      letter: "Cu",
      name: "Cursor",
      desc: "Persistent memory and MCP tools inside the editor.",
    },
    {
      key: "chatgpt",
      letter: "G",
      name: "ChatGPT",
      desc: "Reach your memory through ChatGPT developer mode.",
    },
    {
      key: "codex",
      letter: "Co",
      name: "Codex",
      desc: "Persistent memory for the Codex CLI.",
    },
  ];
  const STORAGE = [
    {
      key: "walrus",
      letter: "W",
      name: "Walrus",
      role: "Blob storage",
      desc: "Your documents and memories live here as content-addressed blobs, not on anyone's server.",
    },
    {
      key: "seal",
      letter: "S",
      name: "Seal",
      role: "Encryption",
      desc: "Every memory is sealed before it leaves your machine. Only you, and who you allow, can open it.",
    },
    {
      key: "memwal",
      letter: "M",
      name: "MemWal",
      role: "Memory layer",
      desc: "Indexes and retrieves what you've stored on Walrus, so recall stays fast.",
    },
    {
      key: "sui",
      letter: "Su",
      name: "Sui",
      role: "Ownership",
      desc: "An on-chain allowlist decides who can read your memory. You hold the keys.",
    },
  ];
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
        'mem = CortexMemory(config="./config/config.yaml")',
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
  function copySnippet(key: string) {
    navigator.clipboard?.writeText(mcpSnippet(key));
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
  async function createAndRun() {
    const goal = agentGoal.trim();
    if (!goal) return;
    const id = s.createTask(goal, agentAssignee);
    setAgentGoal("");
    setOpenTaskId(id);
    if (id) await runStep(id);
  }
  function saveFinding(taskId: string, obsId: string) {
    const text = s.saveObservationAsMemory(taskId, obsId);
    if (text && wallet) void wallet.remember(text).catch(() => {});
    flash(text ? "Saved to shared memory." : "Nothing to save.");
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

  const memCard = (m: Memory) => (
    <div className="mcard" key={m.id} onClick={() => setDrawer(m)}>
      <div className="mtext">{m.text}</div>
      <div className="mfoot">
        {(() => {
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

  const greeting = () => {
    const h = new Date().getHours();
    return h < 5
      ? "Still up?"
      : h < 12
        ? "Good morning."
        : h < 18
          ? "Good afternoon."
          : "Good evening.";
  };
  const memList = live.filter(
    (m) =>
      (memFilter === "all" || m.tags.includes(memFilter)) &&
      (m.text + " " + m.tags.join(" "))
        .toLowerCase()
        .includes(memQuery.toLowerCase()),
  );
  const tags = [...new Set(live.flatMap((m) => m.tags))];
  const modelList = MODELS.filter((m) =>
    (m.name + " " + m.prov).toLowerCase().includes(modelSearch.toLowerCase()),
  );

  return (
    <div className={"app" + (railOpen ? "" : " rail-closed")}>
      {!railOpen && (
        <button
          className="rail-open"
          onClick={() => setRailOpen(true)}
          aria-label="Open sidebar"
        >
          <svg viewBox="0 0 24 24">
            <path d="M10 4H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" />
            <path d="M20 12H10" />
            <path d="M16 8l4 4-4 4" />
          </svg>
        </button>
      )}
      <aside className="rail" aria-label="Navigation">
        <div className="brand">
          <span className="mark">{MARK}</span>
          <b>
            Cortex<sup className="tm">TM</sup>
          </b>
          <button
            className="rail-toggle"
            onClick={() => setRailOpen(false)}
            aria-label="Collapse sidebar"
          >
            <svg viewBox="0 0 24 24">
              <path d="M14 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
              <path d="M4 12h10" />
              <path d="M8 8l-4 4 4 4" />
            </svg>
          </button>
        </div>
        <nav className="nav">
          {NAV.map(([v, label, icon]) => (
            <a
              key={v}
              className={view === v ? "on" : ""}
              href={`#${v}`}
              onClick={() => setView(v)}
            >
              <svg viewBox="0 0 24 24">{icon}</svg>
              {label}
            </a>
          ))}
        </nav>
        <div className="rail-foot">
          <button
            className="softbtn"
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
            <span>{eff === "dark" ? "Light" : "Dark"}</span>
          </button>
          <button
            className="softbtn"
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
          <div className="you">
            <span className="avatar">
              {(walletState?.label?.[0] ?? "G").toUpperCase()}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="nm">{walletState?.label ?? "Guest"}</div>
              <div className="sub">
                {sess
                  ? `${sess.addr.slice(0, 6)}…${sess.addr.slice(-4)}`
                  : "Free · just you"}
              </div>
            </div>
            {sess ? (
              <button
                className="you-out"
                onClick={doSignOut}
                title="Sign out"
                aria-label="Sign out"
              >
                <svg viewBox="0 0 24 24">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <path d="M16 17l5-5-5-5M21 12H9" />
                </svg>
              </button>
            ) : privyOn ? (
              <button className="you-out you-in" onClick={doSignIn}>
                Sign in
              </button>
            ) : null}
          </div>
        </div>
      </aside>

      <main className="main">
        <div className="wrap">
          {/* HOME */}
          <section className={"view" + (view === "home" ? " on" : "")}>
            <div className="sessbar">
              <select
                className="sess-select"
                value={s.activeId}
                onChange={(e) => s.switchSession(e.target.value)}
                aria-label="Conversation"
              >
                {s.sessions.map((se) => (
                  <option key={se.id} value={se.id}>
                    {se.title || "New chat"}
                  </option>
                ))}
              </select>
              <button
                className="sess-new"
                onClick={() => s.newSession()}
                title="New conversation"
              >
                <svg viewBox="0 0 24 24">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                New chat
              </button>
            </div>
            {!hasChat ? (
              <div className="home-intro">
                <div className="eyebrow">Welcome back</div>
                <h1 className="h1">{greeting()}</h1>
                <p className="lede show">
                  Tell Cortex anything worth remembering, or ask it what you
                  already know. Your memory, gently kept.
                </p>
                <div className="savings">
                  <div className="save-head">
                    <div className="save-icon">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                      </svg>
                    </div>
                    <div>
                      <div className="save-t">
                        Cortex is keeping your AI costs down
                      </div>
                      <div className="save-s">
                        More memory could mean bigger prompts. Cortex keeps them
                        small, so your bills stay low.
                      </div>
                    </div>
                    <button
                      className="save-learn"
                      onClick={() => setDrawer("savings")}
                    >
                      How
                    </button>
                  </div>
                  <div className="save-grid">
                    <div className="save-stat">
                      <div className="sv">{sav.reductionPct}%</div>
                      <div className="sl">
                        smaller prompts than pasting it all
                      </div>
                    </div>
                    <div className="save-stat accent">
                      <div className="sv">{fmtMoney(sav.per100$)}</div>
                      <div className="sl">saved per 100 questions</div>
                    </div>
                    <div className="save-stat sage">
                      <div className="sv">{fmtTokens(sav.realizedTok)}</div>
                      <div className="sl">tokens saved so far</div>
                    </div>
                  </div>
                </div>
                <div className="glance">
                  <div className="gstat">
                    <div className="n">{live.length}</div>
                    <div className="l">memories, all yours</div>
                  </div>
                  <div className="gstat accent">
                    <div className="n">
                      {
                        live.filter((m) => Date.now() - m.ts < 7 * 86400000)
                          .length
                      }
                    </div>
                    <div className="l">added this week</div>
                  </div>
                  <div className="gstat sage">
                    <div className="n">{live.filter((m) => m.kept).length}</div>
                    <div className="l">you&apos;ve chosen to keep close</div>
                  </div>
                </div>
                {(() => {
                  type RCard = {
                    kind: string;
                    cat: string;
                    title: string;
                    body: React.ReactNode;
                    actionLabel: string;
                    onAction: () => void;
                    onDismiss: () => void;
                  };
                  const cards: RCard[] = [
                    ...(dreams || []).map((d) => ({
                      kind: "insight",
                      cat: "Insight",
                      title: d.title,
                      body: d.body as React.ReactNode,
                      actionLabel: "Save as memory",
                      onAction: () => {
                        s.remember(d.body, "normal");
                        setDreams((cur) => cur?.filter((x) => x !== d) ?? null);
                        flash("Saved as a memory.");
                      },
                      onDismiss: () =>
                        setDreams((cur) => cur?.filter((x) => x !== d) ?? null),
                    })),
                    ...(notices || [])
                      .filter((n) => !n.loading && n.kind)
                      .map((n) => ({
                        kind: n.kind as string,
                        cat:
                          n.kind === "merge"
                            ? "Duplicate"
                            : n.kind === "pattern"
                              ? "Pattern"
                              : "Tidy up",
                        title: n.title || "",
                        body: n.body as React.ReactNode,
                        actionLabel:
                          n.kind === "merge"
                            ? "Keep the tidy version"
                            : n.kind === "pattern"
                              ? "Save this insight"
                              : "Set it aside",
                        onAction: () => {
                          s.reflectKeep(n.kind!, n.ids || [], n.keepId, n.tag);
                          setNotices(
                            (cur) => cur?.filter((x) => x !== n) ?? null,
                          );
                          flash("Done.");
                        },
                        onDismiss: () =>
                          setNotices(
                            (cur) => cur?.filter((x) => x !== n) ?? null,
                          ),
                      })),
                  ];
                  const loading = dreaming || !!notices?.[0]?.loading;
                  if (!cards.length && !loading) return null;
                  const i = Math.min(reflectIdx, Math.max(0, cards.length - 1));
                  const c = cards[i];
                  return (
                    <div className="rfx">
                      <div className="rr-head">
                        <div className="section-title" style={{ margin: 0 }}>
                          Reflect{" "}
                          <span className="count">
                            catch up on what Cortex noticed
                          </span>
                        </div>
                        {cards.length > 1 && (
                          <div className="rr-nav">
                            <button
                              aria-label="Previous"
                              onClick={() =>
                                setReflectIdx(
                                  (i - 1 + cards.length) % cards.length,
                                )
                              }
                            >
                              ‹
                            </button>
                            <span className="rr-count">
                              {i + 1} of {cards.length}
                            </span>
                            <button
                              aria-label="Next"
                              onClick={() =>
                                setReflectIdx((i + 1) % cards.length)
                              }
                            >
                              ›
                            </button>
                          </div>
                        )}
                      </div>
                      {c ? (
                        <div className="rfx-card">
                          <div className="rfx-cat">
                            <span className={"rfx-ic " + c.kind} />
                            {c.cat}
                          </div>
                          <div className="rfx-title">{c.title}</div>
                          <div className="rfx-body">{c.body}</div>
                          <div className="rfx-foot">
                            <button
                              className="pill-btn keep"
                              onClick={c.onAction}
                            >
                              {c.actionLabel}
                            </button>
                            <button className="pill-btn" onClick={c.onDismiss}>
                              Dismiss
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="rfx-card">
                          <div className="rfx-cat">
                            <span className="rfx-ic insight" />
                            Reflecting
                          </div>
                          <div className="rfx-title">
                            Taking a quiet moment…
                          </div>
                          <div className="rfx-body">
                            Looking across your {live.length} memories for
                            patterns and connections.
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
                {(() => {
                  const rr = live.slice(0, 6);
                  if (!rr.length) return null;
                  const i = Math.min(rrIdx, rr.length - 1);
                  const m = rr[i]!;
                  return (
                    <div className="rr">
                      <div className="rr-head">
                        <div className="section-title" style={{ margin: 0 }}>
                          Recently Remembered{" "}
                          <span className="count">{live.length} in all</span>
                        </div>
                        <div className="rr-nav">
                          <button
                            aria-label="Previous"
                            onClick={() =>
                              setRrIdx((i - 1 + rr.length) % rr.length)
                            }
                          >
                            ‹
                          </button>
                          <span className="rr-count">
                            {i + 1} of {rr.length}
                          </span>
                          <button
                            aria-label="Next"
                            onClick={() => setRrIdx((i + 1) % rr.length)}
                          >
                            ›
                          </button>
                        </div>
                      </div>
                      <button className="rr-card" onClick={() => setDrawer(m)}>
                        <div className="rr-text">{m.text}</div>
                        <div className="rr-foot">
                          <span className="rr-tags">
                            {m.tags.join(" · ") || "note"}
                          </span>
                          <span>{ago(m.ts)}</span>
                          <span className="rr-dive">Dive in →</span>
                        </div>
                      </button>
                    </div>
                  );
                })()}
                {(() => {
                  const rm = live.slice(0, 5);
                  if (!rm.length) return null;
                  const j = Math.min(rmIdx, rm.length - 1);
                  const mm = rm[j]!;
                  return (
                    <div className="rr">
                      <div className="rr-head">
                        <div className="section-title" style={{ margin: 0 }}>
                          Recent Memories
                        </div>
                        <div className="rr-nav">
                          <button
                            aria-label="Previous"
                            onClick={() =>
                              setRmIdx((j - 1 + rm.length) % rm.length)
                            }
                          >
                            ‹
                          </button>
                          <span className="rr-count">
                            {j + 1} of {rm.length}
                          </span>
                          <button
                            aria-label="Next"
                            onClick={() => setRmIdx((j + 1) % rm.length)}
                          >
                            ›
                          </button>
                        </div>
                      </div>
                      <button className="rr-card" onClick={() => setDrawer(mm)}>
                        <div className="rr-text">{mm.text}</div>
                        <div className="rr-foot">
                          <span className="rr-tags">
                            {mm.tags.join(" · ") || "note"}
                          </span>
                          <span>{ago(mm.ts)}</span>
                          <span className="rr-dive">Dive in →</span>
                        </div>
                      </button>
                    </div>
                  );
                })()}
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
                      <div className="atext">{m.a}</div>
                      {!m.streaming && m.sources.length > 0 && (
                        <div className="ask-sources">
                          <div className="as-head">
                            Sources{m.web ? " · memory + web" : ""}
                          </div>
                          <div className="as-list">
                            {m.sources.map((src, n) =>
                              src.type === "web" ? (
                                <a
                                  key={n}
                                  className="src-chip web"
                                  href={`https://${src.url}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <span className="src-n">{n + 1}</span>
                                  <svg viewBox="0 0 24 24">
                                    <circle cx="12" cy="12" r="9" />
                                    <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
                                  </svg>
                                  <span className="src-txt">
                                    <b>{src.title}</b>
                                    <span className="src-sub">{src.url}</span>
                                  </span>
                                </a>
                              ) : (
                                <span key={n} className="src-chip mem">
                                  <span className="src-n">{n + 1}</span>
                                  <svg viewBox="0 0 24 24">
                                    <path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z" />
                                  </svg>
                                  <span className="src-txt">
                                    <b>
                                      {src.text!.length > 56
                                        ? src.text!.slice(0, 56) + "…"
                                        : src.text}
                                    </b>
                                    <span className="src-sub">
                                      your memory · {src.label} · {src.when}
                                    </span>
                                  </span>
                                </span>
                              ),
                            )}
                          </div>
                        </div>
                      )}
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
            )}
          </section>

          {/* MEMORIES + LOOKING BACK */}
          <section className={"view" + (view === "memories" ? " on" : "")}>
            <div className="rr-head">
              <h1 className="h1">Your memories</h1>
              <button
                className="pill-btn keep"
                onClick={() => setCaptureOpen(true)}
              >
                + Build memory
              </button>
            </div>
            <div className="filters" style={{ marginTop: 20 }}>
              <button
                className={"fchip" + (memTab === "cards" ? " on" : "")}
                onClick={() => setMemTab("cards")}
              >
                Memories
              </button>
              <button
                className={"fchip" + (memTab === "timeline" ? " on" : "")}
                onClick={() => setMemTab("timeline")}
              >
                Looking back
              </button>
            </div>

            {memTab === "cards" ? (
              <>
                <label className="search" style={{ marginTop: 16 }}>
                  <svg viewBox="0 0 24 24">
                    <circle cx="11" cy="11" r="7" />
                    <path d="M21 21l-4.3-4.3" />
                  </svg>
                  <input
                    placeholder="Search your memories…"
                    value={memQuery}
                    onChange={(e) => setMemQuery(e.target.value)}
                  />
                </label>
                <div className="filters">
                  {["all", ...tags].map((f) => (
                    <button
                      key={f}
                      className={"fchip" + (memFilter === f ? " on" : "")}
                      onClick={() => setMemFilter(f)}
                    >
                      {f === "all" ? "Everything" : f}
                    </button>
                  ))}
                </div>
                <div className="cards">
                  {memList.length ? (
                    memList.map(memCard)
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
          <section className={"view" + (view === "agents" ? " on" : "")}>
            <div className="rr-head">
              <h1 className="h1">
                Agent <span className="em">team</span>
              </h1>
            </div>
            <p className="lede show">
              Four specialists share one durable memory on Walrus. Assign a goal,
              watch them work, hand a task off so another continues it, and keep
              the best findings. Tasks and the message bus persist to
              Walrus + Sui, so the team picks up exactly where it left off.
            </p>

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
              <div style={{ marginTop: 10 }}>
                <button
                  className="pill-btn keep"
                  onClick={() => void createAndRun()}
                  disabled={!agentGoal.trim() || runningTaskId !== null}
                >
                  Assign &amp; run
                </button>
              </div>
            </div>

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
                          <button
                            className="pill-btn keep"
                            onClick={() => void runStep(t.id)}
                            disabled={running || runningTaskId !== null}
                          >
                            {running ? "Working…" : "Run step"}
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
            <h1 className="h1">
              Prompt <span className="em">studio</span>
            </h1>
            <p className="lede show">
              Describe what you need. Cortex writes the prompt in your voice,
              grounded in your memory.
            </p>
            <div className="st2">
              <div className="composer-dock st2-dock">
                <div className="st2-composer">
                  <textarea
                    className="st2-task"
                    rows={3}
                    placeholder="What do you need a prompt for? e.g. a hero image for my notes app"
                    value={studioTask}
                    onChange={(e) => setStudioTask(e.target.value)}
                  />
                  <div className="st2-bar">
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
                      className="st2-pill"
                      onClick={() => fileRef.current?.click()}
                      title="Attach documents"
                    >
                      <svg viewBox="0 0 24 24">
                        <path d="M21.4 11 12 20.4a5.5 5.5 0 0 1-7.8-7.8l8.5-8.5a3.7 3.7 0 1 1 5.2 5.2l-8.5 8.5a1.8 1.8 0 1 1-2.6-2.6l7.8-7.8" />
                      </svg>
                      <span>Attach</span>
                    </button>
                    <button
                      className={"st2-pill web" + (s.web ? " on" : "")}
                      onClick={() => s.toggleWeb()}
                      title="Search the web"
                    >
                      <svg viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
                      </svg>
                      <span>Web</span>
                    </button>
                    <button
                      className="st2-gen"
                      onClick={generateStudio}
                      disabled={studioLoading}
                    >
                      {studioLoading ? "Generating…" : "Generate"}
                      <svg viewBox="0 0 24 24">
                        <path d="M5 12h14M13 6l6 6-6 6" />
                      </svg>
                    </button>
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
                  {studioOut}
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
          {/* KNOWLEDGE — sources + recommendations */}
          <section className={"view" + (view === "knowledge" ? " on" : "")}>
            <h1 className="h1">Knowledge base</h1>
            <p className="lede show">
              The documents you&apos;ve given Cortex, and what it learned from
              them. Add more, or pick up a thread it suggests.
            </p>
            <div className="kb-rec">
              <div className="kb-rec-h">
                Based on what you know, you might ask
              </div>
              <div className="kb-rec-chips">
                {recommendations.length ? (
                  recommendations.map((r) => (
                    <button
                      key={r}
                      className="kb-rec-chip"
                      onClick={() => runRec(r)}
                    >
                      {r}
                      <svg viewBox="0 0 24 24">
                        <path d="M5 12h14M13 6l6 6-6 6" />
                      </svg>
                    </button>
                  ))
                ) : (
                  <span className="es" style={{ color: "var(--muted)" }}>
                    Keep a few more memories and Cortex will suggest threads
                    here.
                  </span>
                )}
              </div>
            </div>
            {walrusFiles.length > 0 && (
              <>
                <div className="section-title">
                  On Walrus{" "}
                  <span className="count">{walrusFiles.length}</span>
                </div>
                <div className="kb-sources">
                  {walrusFiles.map((m) => (
                    <div className="kb-src" key={m.id}>
                      <div className="kb-src-icon">
                        <svg viewBox="0 0 24 24">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <path d="M14 2v6h6" />
                        </svg>
                      </div>
                      <div className="kb-src-meta">
                        <div className="kb-src-name">{m.text}</div>
                        <div className="kb-src-sub">
                          {m.mime || "file"} · sealed on Walrus
                        </div>
                      </div>
                      {m.url && (
                        <a
                          className="pill-btn"
                          href={m.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Download
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
            <div className="section-title">
              Your sources <span className="count">{sources.length}</span>
            </div>
            {sources.length ? (
              <div className="kb-sources">
                {sources.map((src) => (
                  <div className="kb-src" key={src.name}>
                    <div className="kb-src-icon">
                      <svg viewBox="0 0 24 24">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <path d="M14 2v6h6" />
                      </svg>
                    </div>
                    <div className="kb-src-meta">
                      <div className="kb-src-name">{src.name}</div>
                      <div className="kb-src-sub">
                        {src.mems.length}{" "}
                        {src.mems.length === 1 ? "memory" : "memories"} kept
                      </div>
                    </div>
                    <button
                      className="pill-btn"
                      onClick={() => {
                        setMemQuery(src.name);
                        setView("memories");
                      }}
                    >
                      View
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <button
              className="kb-drop"
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
              style={{ marginTop: sources.length ? 16 : 0 }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              <div className="et" style={{ marginTop: 10 }}>
                {sources.length ? "Add more documents" : "No documents yet"}
              </div>
              <div className="es">
                Drop a note, PDF, or markdown file here, or click to browse.
                Cortex reads it and keeps what matters.
              </div>
            </button>
          </section>

          {/* INTEGRATIONS — MCP clients, storage backends, sources */}
          <section className={"view" + (view === "integrations" ? " on" : "")}>
            <h1 className="h1">Integrations</h1>
            <p className="lede show">
              Give your AI tools one shared memory, kept by you on Walrus and
              sealed so only you can open it. Everything runs locally until you
              add testnet keys.
            </p>
            <div className="int2">
              <div className="int2-filter">
                {(
                  ["all", "mcp", "frameworks", "storage", "sources"] as const
                ).map((t) => (
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
                          : t === "storage"
                            ? "Storage"
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
                              <span>
                                {c.key === "claude-code"
                                  ? "Run this once"
                                  : "Add to your MCP config"}
                              </span>
                              <button
                                className="int2-copy"
                                onClick={() => copySnippet(c.key)}
                              >
                                Copy
                              </button>
                            </div>
                            <pre>{mcpSnippet(c.key)}</pre>
                            <div className="int2-snip-n">
                              Runs entirely on your machine. Nothing leaves your
                              device.
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

              {(intTab === "all" || intTab === "storage") && (
                <div className="int2-group">
                  <div className="int2-glabel">
                    Storage <span>· you own it</span>
                  </div>
                  <div className="int2-list">
                    {STORAGE.map((c) => (
                      <div className="int2-item" key={c.key}>
                        <div className="int2-row">
                          <span className="int2-av store">{c.letter}</span>
                          <div className="int2-meta">
                            <div className="int2-name">
                              {c.name}
                              <span className="int2-role">{c.role}</span>
                            </div>
                            <div className="int2-desc">{c.desc}</div>
                          </div>
                          <span className="int2-tag">Local</span>
                          <button
                            className="int2-btn ghost"
                            onClick={() =>
                              flash(
                                "Add your Sui testnet keys and a deployed allowlist in config/config.yaml, then Cortex stores live on Walrus.",
                              )
                            }
                          >
                            Configure
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
            </div>
          </section>

          {/* SETTINGS — memory model + account & storage */}
          <section className={"view" + (view === "settings" ? " on" : "")}>
            <h1 className="h1">Settings</h1>

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
                <div className="set-gt">Storage</div>
                <div className="set-gs">
                  Where your memory actually lives. Today it runs on your
                  machine. Add testnet keys to store it on Walrus, sealed and
                  owned by you.
                </div>
              </div>
              <div className="set-store">
                {STORAGE.map((c) => {
                  const live =
                    c.key === "seal"
                      ? sealEnabled()
                      : c.key === "sui"
                        ? !!sess
                        : !!wallet;
                  return (
                    <div className="set-srow" key={c.key}>
                      <span className="set-av store">{c.letter}</span>
                      <div className="set-acc-m">
                        <div className="set-acc-n">
                          {c.name} <span className="int-role">{c.role}</span>
                        </div>
                        <div className="set-acc-s">{c.desc}</div>
                      </div>
                      <span className={"int-pill " + (live ? "live" : "mock")}>
                        {live ? "live" : "local"}
                      </span>
                    </div>
                  );
                })}
              </div>
              <button
                className="pill-btn"
                onClick={() => {
                  setView("integrations");
                  setIntTab("storage");
                }}
              >
                Configure storage
              </button>
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
            <MemoryMap onOpen={(m) => setDrawer(m)} />
          </div>
        )}

        {/* GLOBAL COMPOSER (hidden on full-page views) */}
        {view !== "studio" &&
          view !== "integrations" &&
          view !== "settings" && (
            <div className="composer-dock">
              <div className="capture" ref={composerRef}>
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
                            "mp-item" + (m.name === s.model.name ? " on" : "")
                          }
                          onClick={() => {
                            s.setModel(m.name);
                            setModelOpen(false);
                          }}
                        >
                          <span className="mp-av">{m.prov[0]}</span>
                          <span className="mp-meta">
                            <span className="mp-name">
                              {m.name}{" "}
                              <span
                                className={
                                  "mp-price" + (m.price.length > 2 ? " hi" : "")
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
                  </div>
                )}
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
                      className={s.mode === "remember" ? "on" : ""}
                      onClick={() => s.setMode("remember")}
                    >
                      Remember
                    </button>
                    <button
                      className={s.mode === "ask" ? "on" : ""}
                      onClick={() => s.setMode("ask")}
                    >
                      Ask
                    </button>
                  </div>
                  <button
                    className="cap-tool model-chip ask-only"
                    onClick={(e) => {
                      e.stopPropagation();
                      setModelOpen((o) => !o);
                    }}
                  >
                    <span className="mdot" />
                    <span>{s.model.name}</span> <span className="mchev">▾</span>
                  </button>
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
                  <div className="importance remember-only">
                    {(["low", "normal", "high"] as const).map((lv) => (
                      <button
                        key={lv}
                        className={s.importance === lv ? "on" : ""}
                        onClick={() => s.setImportance(lv)}
                      >
                        {lv === "low"
                          ? "Passing"
                          : lv === "normal"
                            ? "Normal"
                            : "Keep close"}
                      </button>
                    ))}
                  </div>
                  <button className="cap-send" onClick={submit}>
                    {s.mode === "ask" ? "Ask" : "Remember"}
                    <svg viewBox="0 0 24 24">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </button>
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

      {/* DRAWER */}
      <div
        className={"scrim" + (drawer ? " show" : "")}
        onClick={() => setDrawer(null)}
      />
      <aside className={"drawer" + (drawer ? " show" : "")}>
        <div className="drawer-head">
          <div className="dt">
            {drawer === "savings" ? "How Cortex saves you money" : "A memory"}
          </div>
          <button className="x" onClick={() => setDrawer(null)}>
            ✕
          </button>
        </div>
        <div className="drawer-body">
          {drawer &&
            drawer !== "savings" &&
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
