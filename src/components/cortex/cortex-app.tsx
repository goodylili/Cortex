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
import { compilePrompt, FORMATS, type PromptFormat } from "@/lib/cortex/prompt";
import {
  stateOf,
  retention,
  TIER_NAME,
  type Tier,
  type MemState,
} from "@/lib/cortex/memory-model";

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
  | "lookback"
  | "reflect"
  | "brain"
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

export function CortexApp() {
  const s = useCortex();
  const [view, setView] = useState<View>("home");
  const [theme, setTheme] = useState<Theme>("system");
  const [dev, setDev] = useState(false);
  const [input, setInput] = useState("");
  const [memFilter, setMemFilter] = useState("all");
  const [memQuery, setMemQuery] = useState("");
  const [modelOpen, setModelOpen] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [drawer, setDrawer] = useState<Memory | "savings" | null>(null);
  const [notices, setNotices] = useState<Notice[] | null>(null);
  const [studioTask, setStudioTask] = useState("");
  const [studioFmt, setStudioFmt] = useState<PromptFormat>("system");
  const [studioSel, setStudioSel] = useState<Set<string> | null>(null);
  const [intTab, setIntTab] = useState<"all" | "mcp" | "storage" | "sources">(
    "all",
  );
  const [intOpen, setIntOpen] = useState<string | null>(null);
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
          "lookback",
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
  function flash(m: string) {
    setToast(m);
    setTimeout(() => setToast(""), 2600);
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
      s.remember(input, s.importance);
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
      "lookback",
      "Looking back",
      <>
        <path key="a" d="M3 12a9 9 0 1 0 3-6.7" />
        <path key="b" d="M3 4v4h4" />
        <path key="c" d="M12 8v4l3 2" />
      </>,
    ],
    [
      "reflect",
      "Reflect",
      <path key="i" d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" />,
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
      if (m.source && m.source !== "note" && m.source !== "reflection")
        (by[m.source] ||= []).push(m);
    });
    return Object.entries(by).map(([name, mems]) => ({ name, mems }));
  })();
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
  const studioOut = compilePrompt(studioFmt, {
    task: studioTask,
    memories: studioMems,
  });
  const toggleStudio = (id: string) => {
    const next = new Set(studioSelected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setStudioSel(next);
  };

  // integrations: MCP clients, storage backends, import sources
  const mcpSnippet = (key: string) =>
    key === "claude-code"
      ? "claude mcp add cortex -- node ./backend/dist/mcp.js"
      : JSON.stringify(
          {
            mcpServers: {
              cortex: {
                command: "node",
                args: ["./backend/dist/mcp.js"],
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
  function intConnect(key: string) {
    setIntOpen((o) => (o === key ? null : key));
  }
  function copySnippet(key: string) {
    navigator.clipboard?.writeText(mcpSnippet(key));
    flash("Setup copied to clipboard");
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
    <div className="app">
      <aside className="rail" aria-label="Navigation">
        <div className="brand">
          <span className="mark">{MARK}</span>
          <b>
            Cortex<sup className="tm">TM</sup>
          </b>
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
            <span className="avatar">G</span>
            <div>
              <div className="nm">Goodness</div>
              <div className="sub">Free · just you</div>
            </div>
          </div>
        </div>
      </aside>

      <main className="main">
        <div className="wrap">
          {/* HOME */}
          <section className={"view" + (view === "home" ? " on" : "")}>
            {!hasChat ? (
              <div className="home-intro">
                <div className="eyebrow">Welcome back</div>
                <h1 className="h1">{greeting()}</h1>
                <p className="lede show">
                  Tell Cortex anything worth remembering, or ask it what you
                  already know. Your memory, gently kept.
                </p>
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
                <div className="section-title">
                  Recently remembered{" "}
                  <span className="count">{live.length} in all</span>
                </div>
                <div className="cards">{live.slice(0, 4).map(memCard)}</div>
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

          {/* MEMORIES */}
          <section className={"view" + (view === "memories" ? " on" : "")}>
            <h1 className="h1">Your memories</h1>
            <label className="search" style={{ marginTop: 24 }}>
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
          </section>

          {/* LOOKING BACK */}
          <section className={"view" + (view === "lookback" ? " on" : "")}>
            <h1 className="h1">
              Looking <span className="em">back</span>
            </h1>
            <div className="story">
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
          </section>

          {/* REFLECT */}
          <section className={"view" + (view === "reflect" ? " on" : "")}>
            <h1 className="h1">Reflect</h1>
            <div className="reflect-intro">
              <div className="ri-t">Ready when you are</div>
              <div className="ri-s">
                A gentle pass over your memories. You&apos;ll see what Cortex
                noticed before anything changes.
              </div>
              <button className="ri-go" onClick={runReflect}>
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" />
                </svg>
                Take a moment to reflect
              </button>
            </div>
            <div
              style={{
                marginTop: 22,
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              {notices?.[0]?.loading && (
                <div className="empty">
                  <div className="et">Taking a quiet moment…</div>
                  <div className="es">
                    Looking across your {live.length} memories.
                  </div>
                </div>
              )}
              {notices && !notices[0]?.loading && notices.length === 0 && (
                <div className="empty">
                  <div className="et">All tidy</div>
                  <div className="es">Nothing to consolidate right now.</div>
                </div>
              )}
              {notices &&
                !notices[0]?.loading &&
                notices.map((n, i) => (
                  <div
                    className={
                      "notice " +
                      (n.kind === "merge"
                        ? "merge"
                        : n.kind === "tidy"
                          ? "tidy"
                          : "")
                    }
                    key={i}
                  >
                    <div className="nicon">
                      <svg viewBox="0 0 24 24">
                        {n.kind === "merge" ? (
                          <path d="M7 8l5-5 5 5M7 16l5 5 5-5" />
                        ) : n.kind === "pattern" ? (
                          <path d="M12 2a7 7 0 0 0-4 12.7V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.3A7 7 0 0 0 12 2z" />
                        ) : (
                          <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M6 6l1 14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-14" />
                        )}
                      </svg>
                    </div>
                    <div className="nbody">
                      <div className="nt">{n.title}</div>
                      <div className="ns">{n.body}</div>
                      <div className="nact">
                        <button
                          className="pill-btn keep"
                          onClick={() => {
                            s.reflectKeep(
                              n.kind!,
                              n.ids || [],
                              n.keepId,
                              n.tag,
                            );
                            setNotices((cur) => cur!.filter((_, j) => j !== i));
                            flash("Done.");
                          }}
                        >
                          {n.kind === "merge"
                            ? "Keep the tidy version"
                            : n.kind === "pattern"
                              ? "Save this insight"
                              : "Set it aside"}
                        </button>
                        <button
                          className="pill-btn"
                          onClick={() =>
                            setNotices((cur) => cur!.filter((_, j) => j !== i))
                          }
                        >
                          Leave as is
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </section>
          {/* STUDIO — compile memory into a prompt */}
          <section className={"view" + (view === "studio" ? " on" : "")}>
            <h1 className="h1">
              Prompt <span className="em">studio</span>
            </h1>
            <p className="lede show">
              Turn what you know into a prompt for any AI. Pick a task, pick the
              memories that matter, copy it anywhere.
            </p>
            <div className="studio">
              <div className="studio-left">
                <div className="st-label">What do you need?</div>
                <textarea
                  className="st-task"
                  rows={2}
                  placeholder="e.g. plan my Lisbon trip using what I already know"
                  value={studioTask}
                  onChange={(e) => setStudioTask(e.target.value)}
                />
                <div className="st-label" style={{ marginTop: 18 }}>
                  Format
                </div>
                <div className="st-formats">
                  {FORMATS.map((f) => (
                    <button
                      key={f.id}
                      className={"st-fmt" + (studioFmt === f.id ? " on" : "")}
                      onClick={() => setStudioFmt(f.id)}
                    >
                      {f.name}
                      <span> · {f.sub}</span>
                    </button>
                  ))}
                </div>
                <div className="st-label" style={{ marginTop: 18 }}>
                  Memories to include{" "}
                  <span className="st-count">{studioMems.length} selected</span>
                </div>
                <div className="st-mems">
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
                      <span>
                        <span className="st-mtext">{m.text}</span>
                        <span className="st-mmeta">
                          {m.tags[0]}
                          {m.kept ? " · kept close" : ""}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="studio-right">
                <div className="st-outbar">
                  <span className="st-tok">
                    ~{Math.round(studioOut.length / 4)} tokens
                  </span>
                  <button
                    className="pill-btn"
                    onClick={() => {
                      const f = FORMATS.find((x) => x.id === studioFmt)!;
                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(
                        new Blob([studioOut], { type: "text/plain" }),
                      );
                      a.download = f.file;
                      a.click();
                      flash("Downloaded " + f.file);
                    }}
                  >
                    Download
                  </button>
                  <button
                    className="pill-btn keep"
                    onClick={() => {
                      navigator.clipboard?.writeText(studioOut);
                      flash("Prompt copied");
                    }}
                  >
                    Copy
                  </button>
                </div>
                <pre className="st-out">{studioOut}</pre>
              </div>
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
            ) : (
              <button
                className="kb-drop"
                onClick={() => fileRef.current?.click()}
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
                  No documents yet
                </div>
                <div className="es">
                  Drop a note, PDF, or markdown file here. Cortex reads it and
                  keeps what matters.
                </div>
              </button>
            )}
            <div style={{ marginTop: 18 }}>
              <button
                className="pill-btn keep"
                onClick={() => fileRef.current?.click()}
              >
                + Add documents
              </button>
            </div>
          </section>

          {/* INTEGRATIONS — MCP clients, storage backends, sources */}
          <section className={"view" + (view === "integrations" ? " on" : "")}>
            <h1 className="h1">Integrations</h1>
            <div className="int-featured">
              <span className="int-tag">Cortex MCP</span>
              <div className="int-feat-t">
                Your AI tools forget everything between chats.
              </div>
              <div className="int-feat-s">
                One setup gives Claude, Cursor and ChatGPT the same memory, kept
                by you on Walrus and sealed so only you can open it.
              </div>
            </div>
            <div className="int-layout">
              <div className="int-main">
                <div className="int-tabs">
                  {(["all", "mcp", "storage", "sources"] as const).map((t) => (
                    <button
                      key={t}
                      className={"int-tab" + (intTab === t ? " on" : "")}
                      onClick={() => setIntTab(t)}
                    >
                      {t === "all"
                        ? "All"
                        : t === "mcp"
                          ? "MCP"
                          : t === "storage"
                            ? "Storage"
                            : "Sources"}
                      <span className="int-tn">
                        {t === "all"
                          ? MCP_CLIENTS.length + STORAGE.length + SOURCES.length
                          : t === "mcp"
                            ? MCP_CLIENTS.length
                            : t === "storage"
                              ? STORAGE.length
                              : SOURCES.length}
                      </span>
                    </button>
                  ))}
                </div>

                {(intTab === "all" || intTab === "mcp") && (
                  <>
                    <div className="int-grouphead">
                      Connect an AI tool{" "}
                      <span className="int-gh-s">over MCP</span>
                    </div>
                    <div className="int-cards">
                      {MCP_CLIENTS.map((c) => (
                        <div
                          className={
                            "int-card" + (intOpen === c.key ? " open" : "")
                          }
                          key={c.key}
                        >
                          <div className="int-card-top">
                            <span className="int-av">{c.letter}</span>
                            <div className="int-cc">
                              <div className="int-name">{c.name}</div>
                              <div className="int-desc">{c.desc}</div>
                            </div>
                          </div>
                          <button
                            className="int-connect"
                            onClick={() => intConnect(c.key)}
                          >
                            {intOpen === c.key ? "Hide setup" : "Connect"}
                          </button>
                          {intOpen === c.key && (
                            <div className="int-snip">
                              <div className="int-snip-h">
                                {c.key === "claude-code"
                                  ? "Run this once"
                                  : "Add to your MCP config"}
                                <button
                                  className="int-copy"
                                  onClick={() => copySnippet(c.key)}
                                >
                                  Copy
                                </button>
                              </div>
                              <pre>{mcpSnippet(c.key)}</pre>
                              <div className="int-snip-n">
                                Runs entirely on your machine. No account, no
                                server, nothing leaves your device.
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {(intTab === "all" || intTab === "storage") && (
                  <>
                    <div className="int-grouphead">
                      Where your memory lives{" "}
                      <span className="int-gh-s">you own it</span>
                    </div>
                    <div className="int-cards">
                      {STORAGE.map((c) => (
                        <div className="int-card" key={c.key}>
                          <div className="int-card-top">
                            <span className="int-av store">{c.letter}</span>
                            <div className="int-cc">
                              <div className="int-name">
                                {c.name}{" "}
                                <span className="int-role">{c.role}</span>
                              </div>
                              <div className="int-desc">{c.desc}</div>
                            </div>
                          </div>
                          <div className="int-status">
                            <span className="int-dot" />
                            Running locally · add testnet keys in{" "}
                            <code>config/config.yaml</code> to go live
                          </div>
                          <button
                            className="int-connect ghost"
                            onClick={() =>
                              flash(
                                "Add your Sui testnet keys and a deployed allowlist in config/config.yaml, then Cortex stores live on Walrus.",
                              )
                            }
                          >
                            Configure
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {(intTab === "all" || intTab === "sources") && (
                  <>
                    <div className="int-grouphead">
                      Bring things in <span className="int-gh-s">sources</span>
                    </div>
                    <div className="int-cards">
                      {SOURCES.map((c) => (
                        <div className="int-card" key={c.key}>
                          <div className="int-card-top">
                            <span className="int-av">{c.letter}</span>
                            <div className="int-cc">
                              <div className="int-name">{c.name}</div>
                              <div className="int-desc">{c.desc}</div>
                            </div>
                          </div>
                          <button
                            className="int-connect"
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
                      ))}
                    </div>
                  </>
                )}
              </div>

              <aside className="int-side">
                <div className="int-panel">
                  <div className="int-panel-h">Active connections</div>
                  <div className="int-conns">
                    {STORAGE.map((c) => (
                      <div className="int-conn" key={c.key}>
                        <span className="int-av sm store">{c.letter}</span>
                        <div className="int-conn-m">
                          <div className="int-conn-n">{c.name}</div>
                          <div className="int-conn-s">{c.role}</div>
                        </div>
                        <span className="int-pill mock">local</span>
                      </div>
                    ))}
                  </div>
                  <div className="int-panel-n">
                    No live testnet connection yet. Everything is kept on your
                    machine.
                  </div>
                </div>
                <div className="int-panel">
                  <div className="int-panel-h">Recently added</div>
                  <div className="int-recents">
                    {live.slice(0, 4).map((m) => (
                      <button
                        className="int-recent"
                        key={m.id}
                        onClick={() => setDrawer(m)}
                      >
                        <svg viewBox="0 0 24 24">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <path d="M14 2v6h6" />
                        </svg>
                        <div className="int-recent-m">
                          <div className="int-recent-t">
                            {m.text.length > 44
                              ? m.text.slice(0, 44) + "…"
                              : m.text}
                          </div>
                          <div className="int-recent-s">
                            {m.tags[0] || "note"} · {ago(m.ts)}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </aside>
            </div>
          </section>

          {/* SETTINGS — memory model + account & storage */}
          <section className={"view" + (view === "settings" ? " on" : "")}>
            <h1 className="h1">Settings</h1>

            <div className="set-group">
              <div className="set-gh">
                <div className="set-gt">Account</div>
                <div className="set-gs">
                  How you sign in. Cortex uses zkLogin so your identity stays
                  yours, with no password to leak.
                </div>
              </div>
              {session ? (
                <div className="set-account">
                  <span className="set-av">
                    {session.via[0]?.toUpperCase()}
                  </span>
                  <div className="set-acc-m">
                    <div className="set-acc-n">Signed in · {session.via}</div>
                    <div className="set-acc-s">
                      {session.addr.slice(0, 10)}…{session.addr.slice(-6)}
                    </div>
                  </div>
                  <button className="pill-btn" onClick={endSession}>
                    Sign out
                  </button>
                </div>
              ) : (
                <div className="set-signin">
                  <button
                    className="pill-btn keep"
                    onClick={() => startSession("Google")}
                  >
                    <svg viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
                    </svg>
                    Continue with Google (zkLogin)
                  </button>
                  <div className="set-note">
                    This creates a local ephemeral session right now. To prove
                    it on Sui testnet you add a Google OAuth client id, a salt
                    service and a prover URL in <code>config/config.yaml</code>,
                    then the same button derives your real zkLogin address.
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
                {STORAGE.map((c) => (
                  <div className="set-srow" key={c.key}>
                    <span className="set-av store">{c.letter}</span>
                    <div className="set-acc-m">
                      <div className="set-acc-n">
                        {c.name} <span className="int-role">{c.role}</span>
                      </div>
                      <div className="set-acc-s">{c.desc}</div>
                    </div>
                    <span className="int-pill mock">local</span>
                  </div>
                ))}
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
          </section>
        </div>

        {/* BRAIN — full-bleed memory map */}
        {view === "brain" && (
          <div className="brain-stage">
            <div className="brain-head">
              <h1 className="h1">
                Your <span className="em">mind</span>
              </h1>
              <p className="brain-sub">
                {live.length} memories, clustered by theme. Drag to pan, scroll
                to zoom, click a node to open it.
              </p>
            </div>
            <MemoryMap onOpen={(m) => setDrawer(m)} />
          </div>
        )}

        {/* GLOBAL COMPOSER (hidden on full-page views) */}
        {view !== "brain" &&
          view !== "studio" &&
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
                    className="cap-tool icon"
                    onClick={() => fileRef.current?.click()}
                    aria-label="Attach"
                  >
                    <svg viewBox="0 0 24 24">
                      <path d="M21.4 11 12 20.4a5.5 5.5 0 0 1-7.8-7.8l8.5-8.5a3.7 3.7 0 1 1 5.2 5.2l-8.5 8.5a1.8 1.8 0 1 1-2.6-2.6l7.8-7.8" />
                    </svg>
                  </button>
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
              <input
                ref={fileRef}
                type="file"
                multiple
                hidden
                onChange={(e) => onFiles(e.target.files)}
              />
            </div>
          )}
      </main>

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
