"use client";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import dynamic from "next/dynamic";
import { useCortex } from "@/lib/cortex/store";
import { forgetLocalIdentity } from "@/lib/cortex/forget";
import {
  ago,
  computeSavings,
  fmtMoney,
  fmtTokens,
  isFileNode,
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
import { LLM_MODELS, type Modality, type Provider } from "@/lib/llm/models";
import { modelProvider } from "@/lib/cortex/avatar";
import { GenAvatar } from "./gen-avatar";
import { Logo } from "@/components/logo";
import {
  siClaude,
  siAnthropic,
  siCursor,
  siWindsurf,
  siCline,
  siVscodium,
  siX,
  siGooglegemini,
  siPerplexity,
  siSuno,
  siElevenlabs,
} from "simple-icons";

// Documentation site, surfaced as a floating widget on every page.
const DOCS_URL =
  process.env.NEXT_PUBLIC_DOCS_URL || "https://docs.usecortexai.xyz/";

// OpenAI's mark (used for ChatGPT + Codex); simple-icons dropped it for trademark.
const OPENAI_PATH =
  "M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.1419.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z";

const BRAND_LOGO_PATHS: Record<string, string> = {
  chatgpt: OPENAI_PATH,
  claude: siClaude.path,
  "claude-code": siAnthropic.path,
  cursor: siCursor.path,
  vscode: siVscodium.path,
  codex: OPENAI_PATH,
  windsurf: siWindsurf.path,
  cline: siCline.path,
};

// Brand marks for the Studio "Open in …" destinations, keyed by product name.
// Products with no published simple-icons mark (Midjourney, Ideogram, Leonardo,
// Udio, Runway, Pika) fall back to the first letter.
const STUDIO_PRODUCT_LOGOS: Record<string, string> = {
  ChatGPT: OPENAI_PATH,
  "DALL·E in ChatGPT": OPENAI_PATH,
  Sora: OPENAI_PATH,
  Claude: siClaude.path,
  Gemini: siGooglegemini.path,
  "Veo in Gemini": siGooglegemini.path,
  Perplexity: siPerplexity.path,
  Suno: siSuno.path,
  ElevenLabs: siElevenlabs.path,
};

// Custom stroked glyphs for tools whose official marks are not in simple-icons
// (trademark). These are distinct in-house emblems, not the brands' real logos;
// swap in official SVGs if licensed. Rendered with stroke=currentColor.
const STUDIO_PRODUCT_GLYPHS: Record<string, string> = {
  Midjourney: "M3 19h18l-2 2H5zM12 3v14M12 3l6 14M12 6l-5 11",
  Runway: "M8 5l11 7-11 7z",
  Pika: "M12 2l2.2 6.4L21 10l-6.8 2.1L12 19l-2.2-6.9L3 10l6.8-1.6z",
  Ideogram: "M5 5h14v14H5zM9.5 9.5h5v5h-5z",
  Leonardo: "M12 3l8 6-8 12-8-12zM4 9h16",
  Udio: "M5 10v4M9.5 7v10M14 9v6M18.5 11v2",
};

// Provider brand mark for model rows (xAI/Grok falls back to the X mark).
const PROVIDER_LOGO_PATHS: Record<Provider, string> = {
  anthropic: siClaude.path,
  openai: OPENAI_PATH,
  google: siGooglegemini.path,
  xai: siX.path,
};
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
  CORTEX_NETWORKS,
  networkAvailable,
  setPreferredNetwork,
  contractsEnabled,
  sealEnabled,
} from "@/lib/cortex/walrus/env";
import { getSuiClient } from "@/lib/cortex/walrus/clients";
import { getCachedState, setCachedState } from "@/lib/cortex/walrus/cache";
import {
  hasPendingWalrusWrites,
  subscribePendingWalrusWrites,
} from "@/lib/cortex/walrus/inflight";
import { SponsoredBanner } from "@/components/sponsored-banner";
import {
  type AgentRole,
  ACCENTS,
  roleLabel,
  isBuiltInAgent,
} from "@/lib/cortex/agents";
import type { LoopRun, LoopSpec } from "@/lib/cortex/loops";
import { useDictation, useReadAloud } from "@/lib/cortex/use-voice";
import {
  ONBOARDING_STEPS,
  TOTAL_QUESTIONS,
  profileAnsweredCount,
  type UserProfile,
} from "@/lib/cortex/profile";
import { Onboarding } from "./onboarding";
import { CaptureModal } from "./capture";
import { Markdown } from "./markdown";
import { MediaBlock } from "./media-block";
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
  | "brain"
  | "agents"
  | "studio"
  | "knowledge"
  | "integrations";
// Durable sources restored on sign-in and backed up by the debounced sync; each
// tracks its own restore status (see the `hydrate` state).
type HydrateKey =
  | "chat"
  | "events"
  | "documents"
  | "agents"
  | "loops"
  | "memories";
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

// Popular destinations per modality  -  "Open in …" from the Studio output.
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
const FENCED_BLOCK = /^```[\w:-]*\s*[\r\n][\s\S]*[\r\n]```$/;

function renderStudioOutput(text: string, type: PromptType) {
  if (!CODE_TYPES.includes(type)) return <Markdown text={text} />;

  const trimmed = text.trim();
  const fenced = FENCED_BLOCK.test(trimmed)
    ? trimmed
    : `\`\`\`${type}\n${text}\n\`\`\``;

  return <Markdown text={fenced} />;
}

const ROOM_SLUG_WORDS = 3;
const ROOM_PREVIEW_CAP = 5;
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
const MEDIA_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "video/mp4": "mp4",
};
const mediaName = (kind: string, mime: string): string =>
  `cortex-${kind}-${Date.now()}.${MEDIA_EXT[mime] ?? "bin"}`;

const LOOP_STATUS_LABEL: Record<LoopRun["status"], string> = {
  draft: "draft",
  running: "running",
  paused: "paused",
  waiting_human: "waiting on you",
  done: "done",
  gave_up: "gave up",
};
const LOOP_MINUTE_MS = 60_000;
// Turn the structured spec into the plain-language summary the spawn flow shows
// before a loop runs: what it does, how it knows it's done, its budget, the gate.
function loopSummary(spec: LoopSpec): {
  does: string;
  done: string;
  budget: string;
  gate: string;
} {
  const terminal =
    spec.gates.find((g) => g.kind === "command" || g.kind === "invariant") ??
    spec.gates[0];
  const done =
    spec.loopType === "deterministic" && terminal
      ? `Done when ${terminal.check}.`
      : terminal
        ? `Done when a reviewer confirms: ${terminal.check}.`
        : "Done when the goal is met.";
  const minutes = Math.round(spec.budget.maxWallClockMs / LOOP_MINUTE_MS);
  return {
    does: spec.goal,
    done,
    budget: `Up to ${spec.budget.maxIterations} iterations or ${minutes} min, then it pauses for you.`,
    gate: spec.humanGate,
  };
}
function loopSpend(run: LoopRun): string {
  const elapsed = run.startedAt ? Date.now() - run.startedAt : 0;
  const mins = Math.round(elapsed / LOOP_MINUTE_MS);
  return `${run.tokensUsed.toLocaleString()} tok · ${mins} min`;
}
function pendingGate(run: LoopRun): string | null {
  if (run.status !== "waiting_human") return null;
  const last = run.iterations[run.iterations.length - 1];
  if (last && last.verdict === "pending")
    return last.feedback || run.spec.humanGate;
  return run.spec.humanGate;
}
const dataUrlToFile = async (url: string, name: string): Promise<File> => {
  const blob = await (await fetch(url)).blob();
  return new File([blob], name, { type: blob.type });
};
// Placeholder card grid shown while a data-backed view restores from Walrus/Sui, so
// a fresh page paints structure immediately instead of an empty state that then
// fills in. Decorative only (aria-hidden); the live content replaces it on arrival.
function SkeletonCards({ count = 6 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div className="sk-card" key={i} aria-hidden="true">
          <div className="sk sk-line lg" />
          <div className="sk sk-line" />
          <div className="sk sk-line" />
          <div className="sk sk-line sm" />
        </div>
      ))}
    </>
  );
}
// Placeholder rows for list/timeline layouts (see SkeletonCards).
function SkeletonRows({ count = 5 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div className="sk-row" key={i} aria-hidden="true">
          <div className="sk sk-dot" />
          <div className="sk-col">
            <div className="sk sk-line lg" />
            <div className="sk sk-line sm" />
          </div>
        </div>
      ))}
    </>
  );
}
// A fresh Privy embedded wallet holds no SUI or WAL, so every on-chain write and
// every Walrus blob write would revert for lack of gas. The gas station (POST
// /api/gas) tops the wallet up from the executor wallet. Called once per address
// on sign-in, before the debounced background sync runs. Degrades silently when
// the route is unconfigured (503) or unreachable so the app still loads.
const ensureGas = async (
  address: string,
  network: "testnet" | "mainnet",
): Promise<{ funded: boolean; reason?: string }> => {
  try {
    const res = await fetch("/api/gas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, network }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      funded?: boolean;
      reason?: string;
    };
    return { funded: data.funded === true, reason: data.reason };
  } catch {
    return { funded: false, reason: "unreachable" };
  }
};
const renderMessageText = (
  text: string,
  names: string[] = [],
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
  // Per-source restore status, driving skeletons (loading) and the save gate
  // (only "ready" sources may be backed up, so a failed restore never overwrites an
  // intact on-chain blob with an empty/partial local copy). Sources start "loading"
  // for an already-signed-in user so a fresh page paints skeletons, "ready" in mock
  // mode where there is nothing to restore.
  const [hydrate, setHydrate] = useState<
    Record<HydrateKey, "loading" | "ready" | "failed">
  >(() => {
    const init = walletState?.wallet ? "loading" : "ready";
    return {
      chat: init,
      events: init,
      documents: init,
      agents: init,
      loops: init,
      memories: init,
    };
  });
  const markHydrate = (key: HydrateKey, status: "ready" | "failed") =>
    setHydrate((h) => (h[key] === status ? h : { ...h, [key]: status }));
  const [theme, setTheme] = useState<Theme>("system");
  const [profileOpen, setProfileOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
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
  const [claiming, setClaiming] = useState(false);
  const openSettings = (section: SettingsSection) => {
    setSettingsSection(section);
    setSettingsSearch("");
    setSettingsOpen(true);
    setProfileOpen(false);
  };
  const [input, setInput] = useState("");
  const [memFilter, setMemFilter] = useState("all");
  const [memTab, setMemTab] = useState<"cards" | "timeline">("cards");
  const [memSyncBusy, setMemSyncBusy] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [agentAssignee, setAgentAssignee] = useState<string>("");
  const [roomTaskId, setRoomTaskId] = useState<string | null>(null);
  const [threadTaskId, setThreadTaskId] = useState<string | null>(null);
  const [threadReply, setThreadReply] = useState("");
  const [roomRailOpen, setRoomRailOpen] = useState(true);
  const [roomsExpanded, setRoomsExpanded] = useState(false);
  const [secRooms, setSecRooms] = useState(true);
  const [secAgents, setSecAgents] = useState(true);
  const [agModalOpen, setAgModalOpen] = useState(false);
  const [agName, setAgName] = useState("");
  const [agRole, setAgRole] = useState<AgentRole>("");
  const [agBlurb, setAgBlurb] = useState("");
  const [agAccent, setAgAccent] = useState<string>(ACCENTS[0]!);
  const [agRenameId, setAgRenameId] = useState<string | null>(null);
  const [agRenameVal, setAgRenameVal] = useState("");
  const [agMode, setAgMode] = useState<"task" | "ask" | "remember">("ask");
  // @-mention autocomplete in the agents composer: the current "@token" being
  // typed (null when closed) and the highlighted match.
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null);
  const [autoTaskId, setAutoTaskId] = useState<string | null>(null);
  const [loopBusy, setLoopBusy] = useState(false);
  const [loopPreviewId, setLoopPreviewId] = useState<string | null>(null);
  const [loopAdvanced, setLoopAdvanced] = useState(false);
  const [loopOpenId, setLoopOpenId] = useState<string | null>(null);
  const dictation = useDictation();
  const readAloud = useReadAloud();
  const [modelOpen, setModelOpen] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [impOpen, setImpOpen] = useState(false);
  const [addModelOpen, setAddModelOpen] = useState(false);
  const [amProvider, setAmProvider] = useState<Provider | "">("");
  const [amApiId, setAmApiId] = useState("");
  const [amKind, setAmKind] = useState<Modality>("text");
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
  const [intOpen, setIntOpen] = useState<string | null>(null);
  const [mcpAuthBusy, setMcpAuthBusy] = useState(false);
  const [mcpToken, setMcpToken] = useState("");
  const [mcpTokenCopied, setMcpTokenCopied] = useState(false);
  const [mcpConnections, setMcpConnections] = useState<
    { id: string; client: string; createdAt: number }[]
  >([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [workspaceBusy, setWorkspaceBusy] = useState(false);
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
  // You hold exactly one username; changing it replaces (gives up) the old one.
  const [changingName, setChangingName] = useState(false);
  // Whether identity (handle + profile + onboarded) has been read back from the
  // Sui stack yet. Until then we hold the onboarding modal so it never flashes
  // for a returning user mid-hydration.
  const [shareSel, setShareSel] = useState<Set<string>>(new Set());
  const [sharedRefreshing, setSharedRefreshing] = useState(false);
  const [revokingShareId, setRevokingShareId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<
    {
      id: number;
      body: string;
      kind: "info" | "success" | "error";
      source: View | "settings";
      tx?: string;
    }[]
  >([]);
  const toastSeq = useRef(0);
  // Toasts auto-dismiss; the notification center keeps the full history so a user
  // who looked away doesn't lose what happened. Persisted to localStorage so it
  // survives reloads, capped so it never grows without bound.
  const [notifications, setNotifications] = useState<
    {
      id: number;
      body: string;
      kind: "info" | "success" | "error";
      source: View | "settings";
      tx?: string;
      ts: number;
      read: boolean;
    }[]
  >(() => {
    try {
      const raw = localStorage.getItem("cortex-notifications");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [notesOpen, setNotesOpen] = useState(false);
  const notesRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    try {
      localStorage.setItem(
        "cortex-notifications",
        JSON.stringify(notifications.slice(0, 50)),
      );
    } catch {}
  }, [notifications]);
  const unreadCount = notifications.filter((n) => !n.read).length;
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
  const mediaUploads = useRef<Set<string>>(new Set());
  // Sessions whose chat has already been pulled from Walrus this load, so opening
  // one again doesn't refetch. Only the most-recent session is hydrated at
  // sign-in; the rest load lazily the first time they're opened.
  const loadedSessions = useRef<Set<string>>(new Set());
  // Addresses already topped up from the gas station this session, so a re-render
  // of the init effect doesn't re-fund a wallet that already has gas.
  const fundedAddresses = useRef<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);
  // Surfaced state of the debounced background sync to Walrus/Sui, shown in the
  // toolbar so a failed write is visible instead of silently swallowed.
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  // Guard against closing the tab mid-write. A blob that is uploaded to Walrus but
  // not yet recorded on Sui (or vice versa) is silent data loss, so while any
  // durable write is in flight  -  the debounced batch, a remember, or a file
  // upload  -  trigger the browser's native "Leave site?" confirmation.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saveState === "saving" || hasPendingWalrusWrites()) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [saveState]);

  useEffect(() => {
    s.hydrate();
  }, []); // eslint-disable-line
  useEffect(() => {
    try {
      const t = localStorage.getItem("cortex-theme") as Theme;
      if (t) setTheme(t);
      if (localStorage.getItem("cortex-dev")) setDev(true);
      const cr = localStorage.getItem("cortex-chatrail");
      if (cr !== null) setChatRailOpen(cr === "1");
    } catch {}
    const apply = () => {
      const h = location.hash.slice(1) as View;
      if (
        [
          "home",
          "memories",
          "brain",
          "agents",
          "studio",
          "knowledge",
          "integrations",
        ].includes(h)
      )
        setView(h);
    };
    // Honor a deep-link hash on load (e.g. /app#agents from the landing nav),
    // then keep in-app nav and back/forward working via hashchange.
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
    setHydrate({
      chat: "loading",
      events: "loading",
      documents: "loading",
      agents: "loading",
      loops: "loading",
      memories: "loading",
    });
    // Paint the last cached snapshot for this address immediately so a fresh reload
    // shows real content (not a skeleton) while the durable loads below reconcile it
    // against the chain. Only fills a source the store hasn't already populated.
    {
      const live = useCortex.getState();
      const cm = getCachedState(w.address, "memories");
      if (Array.isArray(cm) && cm.length && !live.memories.length)
        s.setMemories(cm as Parameters<typeof s.setMemories>[0]);
      const ce = getCachedState(w.address, "events");
      if (Array.isArray(ce) && ce.length && !live.events.length)
        s.setEvents(ce as Parameters<typeof s.setEvents>[0]);
      const cd = getCachedState(w.address, "documents");
      if (Array.isArray(cd) && cd.length && !live.documents.length)
        s.setDocuments(cd as Parameters<typeof s.setDocuments>[0]);
    }
    // Fund the embedded wallet first so the writes triggered below (account
    // register, session/timeline/doc/agent/loop blobs, KB files) have gas. Loads
    // don't need gas, so this runs alongside them rather than blocking them; the
    // 6s debounce on the sync effect gives the top-up time to land.
    if (!fundedAddresses.current.has(w.address)) {
      fundedAddresses.current.add(w.address);
      void ensureGas(w.address, CORTEX_ENV.network).then(
        ({ funded, reason }) => {
          if (funded) flash("Wallet ready", "success");
          else if (reason === "sponsor_exhausted")
            flash(
              "Gas station is empty. Request testnet SUI and WAL for your wallet at faucet.suilearn.io to keep saving.",
              "error",
            );
        },
      );
    }
    void w
      .listSessions()
      .then((sessions) => {
        if (sessions.length) s.setSessions(sessions);
        const active = sessions[0];
        if (active?.blobId && !s.chat.length) {
          loadedSessions.current.add(active.id);
          return w.loadSession(active.blobId).then((chat) => {
            if (Array.isArray(chat) && chat.length) {
              s.setChat(chat as Parameters<typeof s.setChat>[0]);
            }
          });
        }
      })
      .then(() => markHydrate("chat", "ready"))
      .catch(() => markHydrate("chat", "failed"));
    // Profile + handle live on the Sui stack, not the browser. Hydrate them on
    // sign-in so the Settings profile form is prefilled. There is no auto
    // onboarding; the profile is set and edited from Settings only.
    void w
      .loadProfile()
      .then((p) => {
        if (p && typeof p === "object")
          s.saveProfile(p as Parameters<typeof s.saveProfile>[0]);
      })
      .catch(() => {});
    // The claimed handle is durable on the account, but the GraphQL read can lag a
    // fresh claim; show the locally-cached handle immediately and let the on-chain
    // read confirm/override it so the menu never falls back to "Claim username"
    // for a user who already has one.
    try {
      const cached = localStorage.getItem(`cortex.handle.${w.address}`);
      if (cached) setClaimedName(cached);
    } catch {}
    void w
      .loadHandle()
      .then((h) => {
        if (h) {
          setClaimedName(h);
          try {
            localStorage.setItem(`cortex.handle.${w.address}`, h);
          } catch {}
        }
      })
      .catch(() => {});
    void w
      .loadTimeline()
      .then((t) => {
        if (Array.isArray(t) && t.length)
          s.setEvents(t as Parameters<typeof s.setEvents>[0]);
        markHydrate("events", "ready");
      })
      .catch(() => markHydrate("events", "failed"));
    void w
      .loadDocuments()
      .then((d) => {
        if (Array.isArray(d) && d.length)
          s.setDocuments(d as Parameters<typeof s.setDocuments>[0]);
        markHydrate("documents", "ready");
      })
      .catch(() => markHydrate("documents", "failed"));
    void w
      .loadAgents()
      .then((a) => {
        if (a?.tasks?.length)
          s.setTasks(a.tasks as Parameters<typeof s.setTasks>[0]);
        if (a?.messages?.length)
          s.setAgentMessages(
            a.messages as Parameters<typeof s.setAgentMessages>[0],
          );
        if (a?.roster?.length)
          s.setAgents(a.roster as Parameters<typeof s.setAgents>[0]);
        markHydrate("agents", "ready");
      })
      .catch(() => markHydrate("agents", "failed"));
    // Restore the full memory set from Sui on sign-in, exactly like chats: read the
    // durable Walrus blob the account points to. Any memory created locally but not
    // yet in the blob (added within the last debounce window) is kept so a quick
    // reload never drops it. Only when there is no blob yet (first run, pre-backup)
    // do we seed from MemWal/on-chain, which the debounced save then writes to Sui.
    void w
      .loadMemories()
      .then((mems) => {
        if (Array.isArray(mems)) {
          const inBlob = new Set((mems as Memory[]).map((m) => m.id));
          const localOnly = useCortex
            .getState()
            .memories.filter((m) => !inBlob.has(m.id));
          s.setMemories([...localOnly, ...(mems as Memory[])]);
          markHydrate("memories", "ready");
          // The blob is the web's own backup; memories the user added from another
          // surface (the MCP server on Claude, etc.) live only in the shared MemWal
          // namespace. Pull those in and merge by text so they show up here too; the
          // debounced save then folds them into the durable blob.
          void w
            .syncMemwal()
            .then((recalled) => s.mergeRecalledMemories(recalled))
            .catch(() => {});
          return;
        }
        // No durable blob yet (null pointer): seed from MemWal so the debounced
        // save can write the first backup. This is a legitimate empty start, so
        // the source is "ready".
        markHydrate("memories", "ready");
        return w
          .allMemories()
          .then((recalled) => s.loadMemoriesFromRecall(recalled));
      })
      .catch(() => {
        // The durable read FAILED (the blob exists but couldn't be fetched). Show
        // what MemWal can recall, but keep the source "failed" so the debounced
        // save is suppressed and never overwrites the intact blob with a partial
        // recall set.
        markHydrate("memories", "failed");
        void w
          .allMemories()
          .then((recalled) => s.loadMemoriesFromRecall(recalled))
          .catch(() => {});
      });
    void w
      .loadLoops()
      .then((loops) => {
        if (Array.isArray(loops) && loops.length)
          s.setLoops(loops as Parameters<typeof s.setLoops>[0]);
        markHydrate("loops", "ready");
      })
      .catch(() => markHydrate("loops", "failed"));
    // Memories others shared with me (read-only) + the shares I created.
    void w
      .loadSharedWithMe()
      .then((shared) => s.setSharedMemories(shared))
      .catch(() => {});
    void w
      .listMyShares()
      .then((shares) => s.setShares(shares))
      .catch(() => {});
    // Apps the user has connected over OAuth (Claude, other MCP clients).
    void w
      .listConnections()
      .then(setMcpConnections)
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletState?.wallet]);
  // Debounced background sync of the active session + timeline + documents to
  // Walrus + Sui (local stays instant; the chain copy catches up after a settle).
  useEffect(() => {
    const w = walletState?.wallet;
    if (!w) return;
    const t = setTimeout(() => {
      // Mirror the current state to the local snapshot (keyed by address) so the
      // next reload paints instantly. This is a paint cache only and is always
      // reconciled against the chain, so it is written regardless of the durable
      // save gate below.
      setCachedState(w.address, "memories", s.memories);
      setCachedState(w.address, "events", s.events);
      setCachedState(w.address, "documents", s.documents);
      // Each write surfaces its own failure (a swallowed write is data loss the
      // user never sees), and the batch drives the toolbar save indicator.
      const fail = (label: string) => (e: unknown) => {
        flash(`Couldn't save your ${label}: ${(e as Error).message}`, "error");
        throw e;
      };
      const writes: Promise<unknown>[] = [];
      // Each source is backed up only once its restore is "ready". A source whose
      // restore is still loading or "failed" (the durable blob exists but couldn't
      // be fetched this session) is skipped, so a failed/partial load can never
      // overwrite the intact on-chain blob. The length checks keep an empty source
      // from writing a no-op blob.
      const active = s.sessions.find((x) => x.id === s.activeId);
      if (
        hydrate.chat === "ready" &&
        active &&
        s.chat.length &&
        !s.chat.some((m) => m.streaming)
      ) {
        writes.push(
          w
            .saveSession(
              {
                id: active.id,
                title: active.title,
                updatedAt: active.updatedAt,
              },
              s.chat,
            )
            .catch(fail("chat")),
        );
      }
      if (hydrate.events === "ready" && s.events.length)
        writes.push(w.saveTimeline(s.events).catch(fail("timeline")));
      if (hydrate.documents === "ready" && s.documents.length)
        writes.push(w.saveDocuments(s.documents).catch(fail("documents")));
      if (
        hydrate.agents === "ready" &&
        (s.tasks.length || s.agentMessages.length || s.agents.length)
      )
        writes.push(
          w
            .saveAgents(s.tasks, s.agentMessages, s.agents)
            .catch(fail("agents")),
        );
      if (hydrate.loops === "ready" && s.loops.length)
        writes.push(w.saveLoops(s.loops).catch(fail("loops")));
      if (hydrate.memories === "ready" && s.memories.length)
        writes.push(w.saveMemories(s.memories).catch(fail("memories")));
      if (!writes.length) return;
      setSaveState("saving");
      void Promise.allSettled(writes).then((results) => {
        setSaveState(
          results.some((r) => r.status === "rejected") ? "error" : "saved",
        );
      });
    }, 6000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    walletState?.wallet,
    hydrate,
    s.chat,
    s.events,
    s.documents,
    s.tasks,
    s.agentMessages,
    s.agents,
    s.loops,
    s.memories,
  ]);
  useEffect(() => {
    const w = walletState?.wallet;
    if (!w) return;
    s.chat.forEach((m, i) => {
      const md = m.media;
      if (
        !md ||
        md.status !== "done" ||
        md.blobId ||
        !md.dataUrl ||
        mediaUploads.current.has(`c:${i}:${md.dataUrl.length}`)
      )
        return;
      const key = `c:${i}:${md.dataUrl.length}`;
      mediaUploads.current.add(key);
      void dataUrlToFile(md.dataUrl, mediaName(md.kind, md.mime))
        .then((file) => w.storeFile(file))
        .then((stored) => s.setChatMediaBlob(i, stored.blobId))
        .catch((e) => {
          mediaUploads.current.delete(key);
          flash(
            `Couldn't store media on Walrus: ${(e as Error).message}`,
            "error",
          );
        });
    });
    s.tasks.forEach((t) => {
      t.observations.forEach((o) => {
        const md = o.media;
        if (
          !md ||
          md.status !== "done" ||
          md.blobId ||
          !md.dataUrl ||
          mediaUploads.current.has(`o:${o.id}`)
        )
          return;
        mediaUploads.current.add(`o:${o.id}`);
        void dataUrlToFile(md.dataUrl, mediaName(md.kind, md.mime))
          .then((file) => w.storeFile(file))
          .then((stored) => s.setObsMediaBlob(t.id, o.id, stored.blobId))
          .catch((e) => {
            mediaUploads.current.delete(`o:${o.id}`);
            flash(
              `Couldn't store media on Walrus: ${(e as Error).message}`,
              "error",
            );
          });
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletState?.wallet, s.chat, s.tasks]);
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
  useEffect(() => {
    if (!notesOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (notesRef.current && !notesRef.current.contains(e.target as Node)) {
        setNotesOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [notesOpen]);
  const isSignedIn = walletState
    ? walletState.authenticated && !!walletState.address
    : !!session;
  // Cortex keeps nothing personal in the browser and has no offline sync, so
  // there is nothing to do until you sign in. Every create / ask / generate /
  // ingest action runs through this gate: signed out, it opens the sign-in flow
  // (new users then fall into onboarding) and the action is dropped.
  function gate(): boolean {
    if (isSignedIn) return true;
    doSignIn();
    return false;
  }
  useEffect(() => {
    if (settingsOpen) {
      setProfileDraft({ ...useCortex.getState().profile });
      setProfileSaved(false);
    }
  }, [settingsOpen]);
  function flash(
    m: string,
    kind: "info" | "success" | "error" = "info",
    tx?: string,
  ) {
    const id = ++toastSeq.current;
    // The settings modal floats over whatever page is behind it, so attribute
    // its actions to Settings rather than the underlying view.
    const source: View | "settings" = settingsOpen ? "settings" : view;
    setToasts((t) => [...t, { id, body: m, kind, source, tx }].slice(-4));
    setNotifications((n) =>
      [{ id, body: m, kind, source, tx, ts: Date.now(), read: false }, ...n].slice(
        0,
        50,
      ),
    );
    setTimeout(
      () => setToasts((t) => t.filter((x) => x.id !== id)),
      tx ? 8000 : 4200,
    );
  }
  useEffect(() => {
    if (view !== "agents") return;
    const w = walletState?.wallet;
    if (!w || !contractsEnabled() || !sealEnabled()) {
      setWorkspaceId(null);
      return;
    }
    let live = true;
    w.workspaceStatus()
      .then((id) => {
        if (live) setWorkspaceId(id);
      })
      .catch(() => {
        if (live) setWorkspaceId(null);
      });
    return () => {
      live = false;
    };
  }, [view, walletState?.wallet]);

  const mcpAuthReady =
    !!walletState?.wallet &&
    contractsEnabled() &&
    CORTEX_ENV.mcpAddress.length > 0;

  // Pull memories the user added from another surface (the MCP server on Claude,
  // etc.) into this view on demand, without waiting for the next sign-in. Same
  // path as the on-login merge: restore + recall MemWal, fold in by text, and let
  // the debounced save persist the additions into the durable Sui blob.
  async function syncFromMemwal() {
    if (!gate()) return;
    const w = walletState?.wallet;
    if (!w) return;
    setMemSyncBusy(true);
    try {
      const before = useCortex.getState().memories.length;
      const recalled = await w.syncMemwal();
      useCortex.getState().mergeRecalledMemories(recalled);
      const added = useCortex.getState().memories.length - before;
      flash(
        added > 0
          ? `Synced ${added} ${added === 1 ? "memory" : "memories"} from your other apps.`
          : "Your memories are already up to date.",
        "success",
      );
    } catch (err) {
      flash(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setMemSyncBusy(false);
    }
  }

  async function authorizeMcp() {
    const w = walletState?.wallet;
    if (!w || !mcpAuthReady) return;
    setMcpAuthBusy(true);
    try {
      const token = await w.createMcpToken();
      setMcpToken(token);
      setMcpTokenCopied(false);
      flash(
        "Authorized your MCP. Copy your access token below to connect Claude or any MCP client.",
        "success",
      );
    } catch (err) {
      flash(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setMcpAuthBusy(false);
    }
  }

  async function copyMcpToken() {
    if (!mcpToken) return;
    try {
      await navigator.clipboard.writeText(mcpToken);
      setMcpTokenCopied(true);
      setTimeout(() => setMcpTokenCopied(false), 2000);
    } catch {
      flash("Couldn't copy to clipboard - select and copy the token manually.", "error");
    }
  }

  async function revokeMcp() {
    const w = walletState?.wallet;
    if (!w || !mcpAuthReady) return;
    setMcpAuthBusy(true);
    try {
      const digest = await w.revokeMcpAccess();
      setMcpToken("");
      flash(
        "Disconnected. The MCP no longer has access to your memory.",
        "success",
        digest,
      );
    } catch (err) {
      flash(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setMcpAuthBusy(false);
    }
  }

  // Disconnect one connected app (Claude / other MCP client) and drop it from the
  // list. The underlying delegate stays until the user revokes MCP access above.
  async function removeMcpConnection(id: string) {
    const w = walletState?.wallet;
    if (!w) return;
    try {
      await w.revokeConnection(id);
      setMcpConnections((cs) => cs.filter((c) => c.id !== id));
      flash("Disconnected.", "success");
    } catch (err) {
      flash(err instanceof Error ? err.message : String(err), "error");
    }
  }

  const workspaceReady =
    !!walletState?.wallet && contractsEnabled() && sealEnabled();

  async function createAgentWorkspace() {
    const w = walletState?.wallet;
    if (!w || !workspaceReady) return;
    setWorkspaceBusy(true);
    try {
      const { id, digest } = await w.setupWorkspace();
      setWorkspaceId(id);
      flash(
        "Agent workspace is live on chain  -  your team can now share a board.",
        "success",
        digest,
      );
    } catch (err) {
      flash(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setWorkspaceBusy(false);
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

  // Top the user's wallet up from the executor gas station so they have the SUI
  // (gas) and WAL (Walrus storage) their writes need. The same endpoint runs on
  // sign-in; this is the manual control when a user wants to claim on demand.
  async function claimGas() {
    const owner = walletState?.address;
    if (!owner) return;
    setClaiming(true);
    flash("Requesting testnet tokens from the executor…");
    try {
      const res = await fetch("/api/gas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: owner, network: CORTEX_ENV.network }),
      });
      const data = (await res.json()) as {
        funded?: boolean;
        walShort?: boolean;
        digest?: string;
        error?: string;
      };
      if (!res.ok) {
        flash(
          data.error
            ? `Couldn't get tokens: ${data.error}`
            : "Couldn't get tokens right now.",
          "error",
        );
      } else if (data.funded) {
        flash(
          data.walShort
            ? "Sent testnet SUI; the gas station is out of WAL, so request WAL for your wallet at faucet.suilearn.io."
            : "Sent testnet SUI and WAL to your wallet.",
          data.walShort ? "error" : "success",
          data.digest,
        );
        await refreshBalances();
      } else {
        flash("Your wallet already has enough SUI and WAL.");
      }
    } catch (e) {
      flash(`Couldn't get tokens: ${(e as Error).message}`, "error");
    } finally {
      setClaiming(false);
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
      // The claimed handle is durable on the account (account::set_handle), which
      // replaces any previous handle. Cache it locally too so the menu/greeting
      // reflect it immediately on reload even before the on-chain read catches up.
      setClaimedName(result.name);
      try {
        localStorage.setItem(`cortex.handle.${w.address}`, result.name);
      } catch {}
      setChangingName(false);
      setUsername("");
      flash(`Username set to ${result.name}.`, "success", result.digest);
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
    if (!contractsEnabled()) {
      flash("Revoking a share needs the cortex contracts configured.", "error");
      return;
    }
    setRevokingShareId(shareId);
    try {
      await w.revokeShare(shareId);
      s.setShares(await w.listMyShares());
      flash("Revoked.", "success");
    } catch (err) {
      flash(err instanceof Error ? err.message : String(err), "error");
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

  // live() filters + sorts the whole memory set; memoize it (and the arrays derived
  // from it below) on the memory list so typing in a composer  -  which only changes
  // local `input` state  -  doesn't re-run all of this on every keystroke.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const live = useMemo(() => s.live(), [s.memories]);
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

  // Single grounded-ask entry point: pull the user's durable MemWal memories in
  // first so every surface (composer, synthesize, regenerate) answers fluidly
  // over real memory, not the empty in-app store. Falls back to a plain ask if
  // recall fails or there is no live wallet.
  function askGrounded(q: string) {
    const query = q.trim();
    if (!query) return;
    if (!gate()) return;
    s.setMode("ask");
    if (!wallet) {
      s.ask(query);
      return;
    }
    wallet
      .recall(query)
      .then(async (rec) => {
        if (rec.length) return s.ask(query, rec);
        // Semantic recall misses meta-questions ("what's my most recent
        // memory?") that don't match any single fact. Fall back to the full set
        // so the model sees the user's memories instead of wrongly concluding
        // there are none.
        const all = await wallet.allMemories().catch(() => []);
        s.ask(query, all.slice(0, 12));
      })
      .catch(() => s.ask(query));
  }
  // Open a past chat. Its messages live in a Walrus blob (pointer in the session
  // index); only the most-recent one is hydrated at sign-in, so pull this one
  // from chain the first time it's opened instead of showing an empty thread.
  function openSession(se: { id: string; blobId?: string }) {
    s.switchSession(se.id);
    s.setMode("ask");
    setView("home");
    if (se.blobId && wallet && !loadedSessions.current.has(se.id)) {
      loadedSessions.current.add(se.id);
      void wallet
        .loadSession(se.blobId)
        .then((chat) => {
          if (Array.isArray(chat) && chat.length)
            s.setChat(chat as Parameters<typeof s.setChat>[0]);
        })
        .catch(() => loadedSessions.current.delete(se.id));
    }
  }
  function submit() {
    if (!input.trim()) return;
    if (!gate()) return;
    if (s.mode === "ask") {
      const q = input;
      setInput("");
      grow(ta.current);
      askGrounded(q);
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
    if (!gate()) return;
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
  // Paste support shared across every composer: a pasted file or image (e.g. a
  // screenshot) is ingested the same way a drop or browse is, while pasted text
  // keeps the textarea's native paste. Stops the binary from also landing as text.
  function onPasteFiles(e: React.ClipboardEvent) {
    const files = e.clipboardData?.files;
    if (files && files.length) {
      e.preventDefault();
      onFiles(files);
    }
  }

  const hasChat = s.chat.length > 0 && s.mode === "ask";
  const sav = useMemo(() => computeSavings(live, s.cost), [live, s.cost]);

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
  const sources = useMemo(() => {
    const by: Record<string, Memory[]> = {};
    live.forEach((m) => {
      if (
        m.source &&
        m.source !== "note" &&
        m.source !== "reflection" &&
        m.source !== "memwal" &&
        !isFileNode(m)
      )
        (by[m.source] ||= []).push(m);
    });
    return Object.entries(by).map(([name, mems]) => ({ name, mems }));
  }, [live]);
  // Files stored on Walrus (KbFile nodes synced from chain).
  const walrusFiles = useMemo(() => live.filter(isFileNode), [live]);
  // Real memories only (KB files are not memories) for the memory counts.
  const liveMemories = useMemo(() => live.filter((m) => !isFileNode(m)), [live]);
  // Overview stats (5-slide carousel) + the recent-memories carousel.
  const added24 = liveMemories.filter(
    (m) => now - (m.createdAt ?? m.ts) < 86_400_000,
  ).length;
  const added7 = liveMemories.filter(
    (m) => now - (m.createdAt ?? m.ts) < 7 * 86_400_000,
  ).length;
  const recentMems = useMemo(
    () =>
      [...live]
        .sort((a, b) => (b.createdAt ?? b.ts) - (a.createdAt ?? a.ts))
        .slice(0, 8),
    [live],
  );
  // Knowledge base cards  -  Walrus blobs + document sources, unified + filterable
  // by the general search bar in the top navigation.
  const ext = (n: string) => (n.split(".").pop() || "").toLowerCase();
  const kbItems = useMemo(
    () => [
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
          foot: "On Walrus",
          date: ago(m.ts),
          url: m.url ?? null,
          blobId: m.blobId ?? null,
          mime: m.mime ?? "",
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
          blobId: null as string | null,
          mime: "",
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
            blobId: null as string | null,
            mime: "",
            name: null as string | null,
            memIds: mems.map((x) => x.id),
            body: mems.map((x) => x.text).join("\n\n"),
          };
        });
      })(),
    ],
    [walrusFiles, sources, s.sharedMemories],
  );
  const kbFiltered = useMemo(
    () =>
      kbItems.filter(
        (it) =>
          // Knowledge lists files only. Note/text sources are memories, not files,
          // and belong in Memories  -  keep just the Walrus-backed files (and shared
          // knowledge), never plain note groups.
          (it.walrus || it.shared) &&
          (kbFilter === "all" || it.key === kbFilter) &&
          (it.title + " " + it.desc)
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [kbItems, kbFilter, query],
  );
  // Trigger a browser download from in-memory bytes (a same-origin object URL,
  // unlike the cross-origin aggregator URL which the browser just opens).
  function downloadBytes(
    data: Uint8Array | string,
    name: string,
    type: string,
  ) {
    const part: BlobPart =
      typeof data === "string" ? data : new Uint8Array(data);
    const url = URL.createObjectURL(new Blob([part], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  async function downloadKb(it: {
    id: string;
    blobId: string | null;
    mime: string;
    title: string;
    body: string;
  }) {
    // A KbFile: fetch + Seal-decrypt the real bytes (the aggregator only holds
    // ciphertext, and a cross-origin link just opens), then download as the file.
    if (it.blobId && wallet) {
      try {
        flash("Preparing download…");
        const bytes = await wallet.fetchFile({
          blobId: it.blobId,
          kbFileId: it.id.replace(/^kb_/, ""),
          name: it.title,
        });
        downloadBytes(
          bytes,
          it.title || "download",
          it.mime || "application/octet-stream",
        );
      } catch (err) {
        flash(`Couldn't download: ${(err as Error).message}`, "error");
      }
      return;
    }
    // A text-backed memory/source: download its text.
    downloadBytes(
      it.body || it.title,
      (it.title || "memory") + ".txt",
      "text/plain",
    );
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
    if (!gate()) return;
    setStudioLoading(true);
    const key = studioKey;
    try {
      // Ground in durable MemWal memory when signed in (the local store may be
      // empty for a fresh session); fall back to the locally selected memories.
      let mems = studioMems;
      if (wallet && mems.length === 0) {
        try {
          const rec = await wallet.recall(studioTask.trim() || studioStyle);
          mems = rec.map(
            (r) =>
              ({
                id: r.blobId,
                text: r.text,
                tags: [],
                ts: 0,
                createdAt: 0,
                source: "memwal",
              }) as Memory,
          );
        } catch {}
      }
      const res = await fetch("/api/studio", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          task: studioTask,
          memories: mems,
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
        data.ai ? "Generated with AI" : "Generated locally",
        data.ai ? "success" : "info",
      );
    } catch {
      flash("Generation failed", "error");
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
    flash(`Copied your prompt  -  opening ${p.name}`);
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
        : "A hosted Cortex connector is coming soon. For now use a stdio client below  -  it runs the Cortex MCP server locally over stdio."
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
    url: hostedMcp
      ? "Your Cortex connector URL"
      : "Hosted connector (coming soon)",
    cli: "Run this once (stdio)",
    config: "Add to your MCP config (stdio)",
  };
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
        "Reach your Cortex memory from ChatGPT  -  and let every chat build it.",
      overview:
        "Cortex becomes a connector inside ChatGPT. Every prompt can read your durable memory, and once the connector is authorized each chat quietly writes back what's worth keeping  -  no copy-paste between conversations, no context lost when a thread ends.",
      steps: [
        "In ChatGPT, open Settings → Connectors (enable developer mode if prompted).",
        "Choose “Add connector” and pick a custom MCP server.",
        "Paste your Cortex connector URL below, then authorize the connection.",
        "Just chat  -  Cortex reads your prompts over MCP and grows your memory on its own.",
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
        "Ask Claude to recall or keep anything  -  it flows straight through your memory.",
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
        "Restart Claude Code  -  the Cortex tools appear automatically.",
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
        "Reload Cursor  -  Cortex tools are now available to the agent.",
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
    const brand = BRAND_LOGO_PATHS[key];
    if (brand) {
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d={brand} />
        </svg>
      );
    }
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9 2v6M15 2v6M6 8h12v3a6 6 0 0 1-12 0zM12 17v5" />
      </svg>
    );
  };
  // Provider brand mark for a model row; null when the provider is unknown so the
  // caller can fall back to the initial.
  const modelLogo = (name: string) => {
    const prov = modelProvider(name, s.customModels);
    const path = prov ? PROVIDER_LOGO_PATHS[prov] : undefined;
    if (!path) return null;
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d={path} />
      </svg>
    );
  };
  function intConnect(key: string) {
    setIntOpen(key);
  }
  function copyText(text: string, label = "Setup copied to clipboard") {
    navigator.clipboard?.writeText(text);
    flash(label);
  }
  // Keep a prompt the user wrote in chat. Mirrors the composer's remember path:
  // instant local write, on-chain Walrus copy catches up after.
  function savePromptToMemory(text: string) {
    const t = text.trim();
    if (!t) return;
    s.remember(t, s.importance);
    if (wallet)
      void wallet
        .remember(t)
        .catch((err) =>
          flash(
            `Saved locally; Walrus memory failed: ${(err as Error).message}`,
          ),
        );
    flash("Prompt kept in memory.");
  }
  const detailClient = MCP_CLIENTS.find((cl) => cl.key === intOpen);
  const openDetail = detailClient
    ? {
        name: detailClient.name,
        blurb: detailClient.blurb,
        steps: detailClient.steps,
        av: clientLogo(detailClient.key) as React.ReactNode,
        avLetter: null as string | null,
        snippetLabel: SNIPPET_LABEL[detailClient.kind],
        snippet: mcpSnippet(detailClient.kind),
      }
    : null;

  function endSession() {
    setSession(null);
    try {
      localStorage.removeItem("cortex-session");
    } catch {}
    flash("Signed out.");
  }

  // When Privy is configured the account comes from a managed Sui wallet. With no
  // Privy app id the app runs in explore mode and sign-in stays disabled.
  const privyOn = !!walletState;
  const wallet = walletState?.wallet ?? null;

  async function runStep(taskId: string) {
    setRunningTaskId(taskId);
    try {
      // Smart memory for agents: recall the user's durable MemWal memories relevant
      // to this task's goal so the agent reasons over real context, not just the
      // locally-cached store. Degrades to the store's heuristic retrieve on failure.
      const task = s.tasks.find((t) => t.id === taskId);
      const recalled =
        wallet && task ? await wallet.recall(task.goal).catch(() => []) : [];
      await s.runAgentStep(taskId, recalled);
    } finally {
      setRunningTaskId(null);
    }
  }
  // Run the assigned agent a single step. Agents used to auto-chain many steps,
  // but their replies @mention each other, so the room looped on "what's the
  // plan?" forever. One step per send keeps a task in the user's control; they
  // can step it again from the thread if they want more.
  async function autoRunTask(taskId: string) {
    if (autoTaskId) return;
    setAutoTaskId(taskId);
    try {
      await runStep(taskId);
    } finally {
      setAutoTaskId(null);
    }
  }
  // The agents matching the "@token" currently being typed (empty when closed).
  const mentionMatches =
    mentionQuery === null
      ? []
      : s.agents.filter((a) =>
          a.name.toLowerCase().startsWith(mentionQuery.toLowerCase()),
        );
  // Recompute the open "@token" from the text before the caret; null closes it.
  function syncMention(el: HTMLTextAreaElement) {
    const caret = el.selectionStart ?? el.value.length;
    const token = /(?:^|\s)@(\w*)$/.exec(el.value.slice(0, caret));
    setMentionQuery(token ? (token[1] ?? "") : null);
    setMentionIndex(0);
  }
  // Replace the partial "@token" at the caret with the picked agent's handle.
  function pickMention(name: string) {
    const el = ta.current;
    if (!el) return;
    const caret = el.selectionStart ?? el.value.length;
    const before = el.value.slice(0, caret);
    const at = before.lastIndexOf("@");
    if (at < 0) return;
    const next = `${before.slice(0, at)}@${name} ${el.value.slice(caret)}`;
    setInput(next);
    setMentionQuery(null);
    const pos = at + name.length + 2;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(pos, pos);
      grow(el);
    });
  }
  async function sendRoomMessage() {
    const text = input.trim();
    if (!text) return;
    if (!gate()) return;
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
      return;
    }
    if (!roster.length) {
      setAgModalOpen(true);
      flash("Create an agent first to open a task room.");
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
    if (!gate()) return;
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
    setAgRole("");
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
    const lead = useCortex.getState().agents[0];
    if (!lead) {
      setView("agents");
      setAgModalOpen(true);
      flash("Create an agent first to run a loop.");
      return;
    }
    setLoopBusy(true);
    flash("Reading memory to write the loop…");
    try {
      const id = await s.generateLoop(goal, lead.id);
      if (id) {
        s.startLoop(id);
        setView("agents");
        flash("Loop running on the Agents page.");
      }
    } finally {
      setLoopBusy(false);
    }
  }
  // Spawn flow (AGENTIC-LOOPS §10): generate a LoopSpec from the task + recalled
  // memory, then surface a plain-language summary the user confirms or edits before
  // it runs. A no-key / offline generator falls back to a skeleton spec, never crashes.
  async function runTaskAsLoop(taskId: string) {
    const st = useCortex.getState();
    const task = st.tasks.find((t) => t.id === taskId);
    if (!task || loopBusy) return;
    setLoopBusy(true);
    flash("Reading memory to write the loop…");
    try {
      const id = await s.generateLoop(task.goal, task.assignedTo);
      if (id) {
        setLoopAdvanced(false);
        setLoopPreviewId(id);
      }
    } finally {
      setLoopBusy(false);
    }
  }
  function confirmLoop(id: string) {
    s.startLoop(id);
    setLoopPreviewId(null);
    setView("agents");
    setThreadTaskId(null);
    flash("Loop running. Watch it in the loops panel.");
  }
  function discardLoop(id: string) {
    s.discardLoop(id);
    setLoopPreviewId(null);
  }
  function saveFinding(taskId: string, obsId: string) {
    if (!gate()) return;
    const text = s.saveObservationAsMemory(taskId, obsId);
    if (text && wallet)
      void wallet
        .remember(text)
        .catch((e) =>
          flash(`Couldn't save to memory: ${(e as Error).message}`, "error"),
        );
    flash(text ? "Saved to shared memory." : "Nothing to save.");
  }
  async function toggleDictation() {
    if (dictation.recording) {
      const text = await dictation.stop();
      if (text) {
        setInput((v) => (v ? v + " " : "") + text);
        grow(ta.current);
      } else flash("Couldn't transcribe  -  set GEMINI_API_KEY for voice.");
    } else {
      if (!gate()) return;
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
    if (walletState) {
      walletState.login();
      return;
    }
    flash(
      "Sign-in is not configured. Set NEXT_PUBLIC_PRIVY_APP_ID to sign in with a managed Sui wallet.",
      "error",
    );
  }
  async function doSignOut() {
    // Never sign out mid-write: tearing down the wallet between "uploaded to Walrus"
    // and "recorded on Sui" loses the memory, and the MCP would never see it. Block
    // until every durable write has settled.
    if (hasPendingWalrusWrites()) {
      flash(
        "Saving your memory to the Sui stack. Sign out again in a moment.",
        "info",
      );
      return;
    }
    forgetLocalIdentity();
    if (walletState) await walletState.logout();
    else endSession();
    // Hard reset so no signed-in state lingers in memory: the next visitor lands
    // on the marketing site, signed out, with an empty browser.
    try {
      window.location.href = "/";
    } catch {}
  }
  function seedProfileToMemory(profile: UserProfile) {
    const texts = s.seedProfileMemories(profile);
    if (wallet) {
      // Seed one at a time, not in parallel: every wallet.remember signs from the
      // same wallet, and concurrent transactions race for the same gas coin, so a
      // parallel seed drops most of the profile memories on the floor.
      void (async () => {
        for (const t of texts) {
          try {
            await wallet.remember(t);
          } catch (e) {
            flash(
              `Couldn't seed your profile into memory: ${(e as Error).message}`,
              "error",
            );
            break;
          }
        }
      })();
    }
    return texts.length;
  }
  function completeOnboarding(profile: UserProfile) {
    s.saveProfile(profile);
    if (wallet) {
      void wallet
        .saveProfile(profile)
        .catch((e) =>
          flash(`Couldn't save your profile: ${(e as Error).message}`, "error"),
        );
      void wallet
        .markOnboarded()
        .catch((e) =>
          flash(
            `Couldn't record onboarding on-chain: ${(e as Error).message}`,
            "error",
          ),
        );
    }
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
    // Record onboarding as a durable on-chain flag, even on skip, so it never
    // re-prompts on later sign-ins. Returning users edit from Settings.
    if (wallet) {
      if (profileAnsweredCount(profile) > 0)
        void wallet.saveProfile(profile).catch(() => {});
      void wallet.markOnboarded().catch(() => {});
    }
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
    if (wallet) void wallet.saveProfile(profileDraft).catch(() => {});
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
      flash(`Stored ${file.name} on Walrus.`, "success", stored.digest);
      wallet
        .listFiles()
        .then((files) => s.syncFiles(files))
        .catch(() => {});
    } catch (err) {
      flash(`Walrus upload failed: ${(err as Error).message}`, "error");
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
  // The Memories view lists real memories only. KB files (blob-backed) belong to
  // the Knowledge base and the brain map, not the memory list or memory counts.
  const brainMemories = useMemo(
    () =>
      [...live, ...s.sharedMemories]
        .filter((m) => !isFileNode(m))
        .sort((a, b) => b.ts - a.ts),
    [live, s.sharedMemories],
  );
  const q = query.trim().toLowerCase();
  const memList = useMemo(
    () =>
      brainMemories.filter((m) => {
        const hay = (m.text + " " + m.tags.join(" ")).toLowerCase();
        return (
          (memFilter === "all" ||
            (memFilter === "__shared"
              ? !!m.shared
              : m.tags.includes(memFilter))) &&
          hay.includes(q)
        );
      }),
    [brainMemories, memFilter, q],
  );
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
  const tags = useMemo(
    () => [...new Set(brainMemories.flatMap((m) => m.tags))],
    [brainMemories],
  );
  const byokPickerModels = s.customModels.map((m) => ({
    name: m.label,
    prov: providerInfo(m.provider).label,
    price: "BYOK",
    desc: `${providerInfo(m.provider).label} · your key`,
  }));
  const modelList = [...MODELS, ...byokPickerModels].filter((m) =>
    (m.name + " " + m.prov).toLowerCase().includes(modelSearch.toLowerCase()),
  );
  const selectedCustom = s.customModels.find((m) => m.label === s.model.name);
  const videoCapable =
    !!selectedCustom && (selectedCustom.kind ?? "text") === "video";
  const openAddModel = () => {
    setAmProvider("");
    setAmKind("text");
    setAmApiId("");
    setAmKey("");
    setAmUrl("");
    setAmError("");
    setAddModelOpen(true);
  };
  // Selecting a model. Gemini is the free server model; custom (BYOK) models the
  // user added are used with their key. Any other built-in (Claude/GPT/Grok) has
  // no server key, so selecting it opens Add Model prefilled to prompt BYOK.
  const chooseModel = (name: string) => {
    const custom = s.customModels.find((c) => c.label === name);
    if (custom) {
      s.setModel(name);
      if (!s.byokKeys[custom.id]) s.unlockByok();
      return;
    }
    const builtin = LLM_MODELS.find((m) => m.name === name);
    if (!builtin || builtin.provider === "google") {
      s.setModel(name);
      return;
    }
    setAmProvider(builtin.provider);
    setAmKind("text");
    setAmApiId(builtin.apiId);
    setAmKey("");
    setAmUrl("");
    setAmError("");
    setAddModelOpen(true);
  };
  // The shared "Use any model" picker (search + brand logos + Add model), used by
  // the chat composer and the studio composer so model selection is consistent.
  const modelPicker = () => (
    <div className="model-anchor">
      <button
        className="cap-tool model-chip"
        onClick={(e) => {
          e.stopPropagation();
          setModelOpen((o) => !o);
        }}
      >
        <span className="mdot" />
        <span>{s.model.name}</span> <span className="mchev">▾</span>
      </button>
      {modelOpen && (
        <div className="model-pop">
          <div className="mp-up">
            <div>
              <div className="mp-up-t">Use any model</div>
              <div className="mp-up-s">Free while Cortex is in preview</div>
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
                className={"mp-item" + (m.name === s.model.name ? " on" : "")}
                onClick={() => {
                  setModelOpen(false);
                  chooseModel(m.name);
                }}
              >
                <span className="mp-av">{modelLogo(m.name) ?? m.prov[0]}</span>
                <span className="mp-meta">
                  <span className="mp-name">
                    {m.name}{" "}
                    <span
                      className={"mp-price" + (m.price.length > 2 ? " hi" : "")}
                    >
                      {m.price}
                    </span>
                  </span>
                  <span className="mp-desc">
                    {m.prov} · {m.desc}
                  </span>
                </span>
                {m.name === s.model.name && <span className="mp-check">✓</span>}
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
              <span className="mp-desc">Bring your own API key</span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
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
      kind: amKind,
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
  // True whenever a durable write (memory remember, file, session) is mid-flight to
  // Walrus/Sui. Sign-out is disabled while this holds so a memory is never stranded
  // half-written, which would also keep it invisible to the MCP.
  const savingToChain = useSyncExternalStore(
    subscribePendingWalrusWrites,
    hasPendingWalrusWrites,
    () => false,
  );
  return (
    <div
      className={
        "app" + (onHome ? " home-rail" : "") + (railOn ? " rail-expanded" : "")
      }
    >
      <SponsoredBanner />
      <header className="topbar">
        <div className="topbar-inner">
          <div className="tb-left">
            <button
              className="tb-burger"
              onClick={() => setNavOpen(true)}
              aria-label="Open menu"
              aria-expanded={navOpen}
              title="Menu"
            >
              <svg viewBox="0 0 24 24">
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            </button>
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
            {saveState === "saving" || saveState === "error" ? (
              <span
                title={
                  saveState === "error"
                    ? "A background save to Walrus failed"
                    : "Saving to Walrus"
                }
                style={{
                  fontSize: 12,
                  opacity: 0.7,
                  color: saveState === "error" ? "#e5484d" : "inherit",
                }}
              >
                {saveState === "error" ? "Save failed" : "Saving…"}
              </span>
            ) : null}
            <button
              className="tb-add"
              onClick={() => gate() && setCaptureOpen(true)}
            >
              <svg viewBox="0 0 24 24">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add memory
            </button>
            <div className="tb-notes" ref={notesRef}>
              <button
                className={"tb-icon tb-bell" + (notesOpen ? " on" : "")}
                onClick={() => {
                  setNotesOpen((o) => {
                    const next = !o;
                    if (next)
                      setNotifications((n) =>
                        n.map((x) => ({ ...x, read: true })),
                      );
                    return next;
                  });
                }}
                aria-haspopup="menu"
                aria-expanded={notesOpen}
                aria-label="Notifications"
                title="Notifications"
              >
                <svg viewBox="0 0 24 24">
                  <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.7 21a2 2 0 0 1-3.4 0" />
                </svg>
                {unreadCount > 0 && (
                  <span className="tb-bell-dot">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
              {notesOpen && (
                <div className="tb-menu tb-note-menu" role="menu">
                  <div className="tb-note-head">
                    <span className="nm">Notifications</span>
                    {notifications.length > 0 && (
                      <button
                        className="tb-note-clear-all"
                        onClick={() => setNotifications([])}
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <div className="tb-note-empty">
                      You&apos;re all caught up.
                    </div>
                  ) : (
                    <div className="tb-note-list">
                      {notifications.map((n) => {
                        const isSettings = n.source === "settings";
                        const meta = isSettings
                          ? undefined
                          : NAV.find(([v]) => v === n.source);
                        const title = isSettings
                          ? "Settings"
                          : (meta?.[1] ?? "Cortex");
                        return (
                          <div
                            className={"tb-note-item tb-note-" + n.kind}
                            key={n.id}
                          >
                            <span className="tb-note-dot" />
                            <div className="tb-note-body">
                              <div className="tb-note-title">{title}</div>
                              <div className="tb-note-msg">{n.body}</div>
                              {n.tx && (
                                <a
                                  className="ntf-link"
                                  href={`https://suiscan.xyz/${CORTEX_ENV.network}/tx/${n.tx}`}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  View on Suiscan ↗
                                </a>
                              )}
                            </div>
                            <button
                              className="tb-note-x"
                              onClick={() =>
                                setNotifications((cur) =>
                                  cur.filter((x) => x.id !== n.id),
                                )
                              }
                              aria-label="Clear notification"
                            >
                              <svg viewBox="0 0 24 24">
                                <path d="M18 6 6 18M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="tb-profile" ref={profileRef}>
              <button
                className={"tb-you" + (profileOpen ? " on" : "")}
                onClick={() => setProfileOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={profileOpen}
                aria-label="Account"
              >
                <GenAvatar seed={sess?.addr ?? walletState?.label ?? "you"} />
              </button>
              {profileOpen && (
                <div className="tb-menu" role="menu">
                  <div className="tb-menu-head">
                    <GenAvatar
                      seed={sess?.addr ?? walletState?.label ?? "you"}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div className="nm">
                        {claimedName
                          ? `@${claimedName.split(/[.@]/)[0]}`
                          : (walletState?.label ?? "Guest")}
                      </div>
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
                          {walletState?.label ?? claimedName}
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
                  <div className="tb-net" role="group" aria-label="Network">
                    {CORTEX_NETWORKS.map((n) => {
                      const active = CORTEX_ENV.network === n;
                      const avail = networkAvailable(n);
                      const label = n === "mainnet" ? "Mainnet" : "Testnet";
                      return (
                        <button
                          key={n}
                          className={"tb-net-opt" + (active ? " on" : "")}
                          disabled={!avail || active}
                          title={
                            avail
                              ? `Switch to ${label}`
                              : `${label} coming soon`
                          }
                          onClick={() => {
                            if (!avail || active) return;
                            setPreferredNetwork(n);
                            window.location.reload();
                          }}
                        >
                          <span>{label}</span>
                          {!avail && <span className="tb-net-soon">Soon</span>}
                        </button>
                      );
                    })}
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
                  {sess ? (
                    <button
                      className="tb-menu-item danger"
                      disabled={savingToChain}
                      title={
                        savingToChain
                          ? "Saving your memory to the Sui stack…"
                          : undefined
                      }
                      onClick={() => {
                        doSignOut();
                        setProfileOpen(false);
                      }}
                    >
                      <svg viewBox="0 0 24 24">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <path d="M16 17l5-5-5-5M21 12H9" />
                      </svg>
                      <span>
                        {savingToChain ? "Saving to Sui…" : "Sign out"}
                      </span>
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

      <div
        className={"nav-scrim" + (navOpen ? " show" : "")}
        onClick={() => setNavOpen(false)}
        aria-hidden="true"
      />
      <aside
        className={"nav-drawer" + (navOpen ? " show" : "")}
        aria-label="Navigation"
        aria-hidden={!navOpen}
      >
        <div className="nav-drawer-head">
          <a
            className="tb-brand"
            href="#home"
            onClick={() => {
              setView("home");
              setNavOpen(false);
            }}
          >
            <span className="mark">{MARK}</span>
            <b>Cortex</b>
          </a>
          <button
            className="nav-drawer-close"
            onClick={() => setNavOpen(false)}
            aria-label="Close menu"
          >
            <svg viewBox="0 0 24 24">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <nav className="nav-drawer-list" aria-label="Primary">
          {NAV.map(([v, label, icon]) => (
            <button
              key={v}
              className={"nav-drawer-item" + (view === v ? " on" : "")}
              onClick={() => {
                setView(v);
                setNavOpen(false);
              }}
            >
              <svg viewBox="0 0 24 24">{icon}</svg>
              <span>{label}</span>
            </button>
          ))}
          <button
            className="nav-drawer-item"
            onClick={() => {
              if (!onHome) setView("home");
              toggleChatRail();
              setNavOpen(false);
            }}
          >
            <svg viewBox="0 0 24 24">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span>Chat history</span>
          </button>
        </nav>
        <div className="nav-drawer-foot">
          <button
            className="nav-drawer-action primary"
            onClick={() => {
              setNavOpen(false);
              if (gate()) setCaptureOpen(true);
            }}
          >
            <svg viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span>Add memory</span>
          </button>
          <button
            className="nav-drawer-action"
            onClick={() => {
              setNavOpen(false);
              openSettings("account");
            }}
          >
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span>Settings</span>
          </button>
        </div>
      </aside>

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
                  onClick={() => openSession(se)}
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
                    {isSignedIn
                      ? claimedName
                        ? claimedName.split(/[.@]/)[0]
                        : username || "there"
                      : "anon"}
                    .
                  </h1>
                  <p className="ov-sub">
                    {isSignedIn ? (
                      <>
                        Cortex has processed{" "}
                        {(added24 || liveMemories.length).toLocaleString()}{" "}
                        {(added24 || liveMemories.length) === 1
                          ? "memory"
                          : "memories"}{" "}
                        since your last session. Ready to expand your neural
                        workspace?
                      </>
                    ) : (
                      <>
                        Sign in to open your memory. Until then we don&apos;t
                        know you, and nothing is stored.
                      </>
                    )}
                  </p>
                </div>

                {hydrate.memories === "loading" && !liveMemories.length && (
                  <>
                    <div className="hc-recent-head">
                      <h2 className="hc-recent-title">Recent Memories</h2>
                    </div>
                    <div className="hc-grid">
                      <SkeletonCards count={4} />
                    </div>
                  </>
                )}
                {liveMemories.length > 0 && (
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
                          {liveMemories.length.toLocaleString()}
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
                            ? `${dreams[0].title}  -  ${dreams[0].body}`
                            : dreamsLoading
                              ? "Cortex is looking across your memories for connections."
                              : `You've added ${added7} ${
                                  added7 === 1 ? "memory" : "memories"
                                } this week across ${liveMemories.length.toLocaleString()} total. Synthesize them into a clearer picture.`}
                        </p>
                        <button
                          className="hc-synth"
                          onClick={() =>
                            askGrounded(
                              dreams[0]
                                ? `Synthesise what I know about this: ${dreams[0].title}. ${dreams[0].body}`
                                : "Synthesise the most important things I've stored recently into a clear summary.",
                            )
                          }
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
                        const isFile = isFileNode(m);
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
                        <span className="cmsg-uav">
                          <GenAvatar
                            seed={sess?.addr ?? walletState?.label ?? "you"}
                            size={28}
                          />
                        </span>
                      </div>
                      {m.q && (
                        <div className="cmsg-q-acts">
                          <button
                            className="cmsg-ic"
                            title="Copy"
                            aria-label="Copy your message"
                            onClick={() => copyText(m.q, "Copied.")}
                          >
                            <svg viewBox="0 0 24 24">
                              <rect x="9" y="9" width="11" height="11" rx="2" />
                              <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                            </svg>
                          </button>
                          <button
                            className="cmsg-ic"
                            title="Add to memory"
                            aria-label="Add your prompt to memory"
                            onClick={() => savePromptToMemory(m.q)}
                          >
                            <svg viewBox="0 0 24 24">
                              <path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                              <path d="M12 8v6M9 11h6" />
                            </svg>
                          </button>
                        </div>
                      )}
                      <div className="cmsg-a">
                        {(() => {
                          // A BYOK / non-Gemini model answers under its own
                          // avatar; the free Gemini assistant keeps the Cortex mark.
                          const prov = modelProvider(m.model, s.customModels);
                          if (prov && prov !== "google")
                            return (
                              <span className="cmsg-av plain" title={m.model}>
                                <GenAvatar seed={m.model} size={34} />
                              </span>
                            );
                          return (
                            <span className="cmsg-av" aria-hidden="true">
                              <Logo variant="current" className="cmsg-logo" />
                            </span>
                          );
                        })()}
                        <div className="cmsg-card">
                          {m.media ? (
                            <MediaBlock media={m.media} />
                          ) : (
                            <div className="atext">
                              {m.streaming ? m.a : <Markdown text={m.a} />}
                            </div>
                          )}
                          {!m.streaming && !m.media && (
                            <SourceChips sources={items} />
                          )}
                          {!m.streaming && !m.media && (
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
                                onClick={() => m.q && askGrounded(m.q)}
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
                  className="pill-btn"
                  onClick={syncFromMemwal}
                  disabled={memSyncBusy}
                  title="Pull in memories you added from Claude or other connected apps"
                >
                  {memSyncBusy ? "Syncing…" : "Sync"}
                </button>
                <button
                  className="pill-btn keep"
                  onClick={() => gate() && setCaptureOpen(true)}
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
                  {hydrate.memories === "loading" && !memList.length ? (
                    <SkeletonCards />
                  ) : memList.length ? (
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
                {hydrate.events === "loading" && !s.events.length ? (
                  <SkeletonRows />
                ) : (
                  [...s.events]
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
                    ))
                )}
              </div>
            )}
          </section>

          {/* AGENTS  -  Pipeline Room: a Slack-style room where agents are members */}
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
              return (
                <div className="pr-shell">
                  <aside className={"pr-rail" + (roomRailOpen ? " open" : "")}>
                    <div className="pr-rail-body">
                      <button
                        className="pr-new"
                        onClick={() => {
                          if (!roster.length) {
                            setAgModalOpen(true);
                            return;
                          }
                          setRoomTaskId(null);
                          setThreadTaskId(null);
                          setAgMode("task");
                          setAgentAssignee(roster[0]!.id);
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
                              className={
                                "pr-caret" + (secAgents ? " open" : "")
                              }
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
                                <span className="pr-av">
                                  <GenAvatar seed={a.id} size={34} radius={8} />
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
                                        if (e.key === "Enter")
                                          commitRename(a.id);
                                        if (e.key === "Escape")
                                          setAgRenameId(null);
                                      }}
                                      onBlur={() => commitRename(a.id)}
                                    />
                                  ) : (
                                    <div className="pr-member-n">{a.name}</div>
                                  )}
                                  <div className="pr-member-r">
                                    {roleLabel(a.role)}
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
                          <span className="pr-av human">
                            <GenAvatar
                              seed={sess?.addr ?? walletState?.label ?? "you"}
                              size={34}
                              radius={8}
                            />
                          </span>
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
                    {(() => {
                      // The live "on-chain workspace" banner is intentionally not
                      // shown  -  once a workspace exists the board speaks for
                      // itself. Only the one-time setup CTA appears, and only
                      // until a workspace has been created.
                      if (workspaceId || !workspaceReady) return null;
                      return (
                        <div className="pr-setup">
                          <div className="pr-setup-l">
                            <b>Set up agent workspace</b>
                            <span className="pr-setup-sub">
                              Create the shared Workspace once. Its id is saved
                              to your account so the app and your MCP read the
                              same board.
                            </span>
                          </div>
                          <button
                            className="pr-setup-btn"
                            onClick={createAgentWorkspace}
                            disabled={workspaceBusy}
                          >
                            {workspaceBusy ? "Creating…" : "Create workspace"}
                          </button>
                        </div>
                      );
                    })()}
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
                            <span className="pr-av human">
                              <GenAvatar
                                seed={sess?.addr ?? walletState?.label ?? "you"}
                                size={34}
                                radius={8}
                              />
                            </span>
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
                              <div className="pr-msg-acts">
                                <button
                                  className="cmsg-ic"
                                  title="Copy"
                                  aria-label="Copy your message"
                                  onClick={() => copyText(room.goal, "Copied.")}
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
                                <button
                                  className="cmsg-ic"
                                  title="Add to memory"
                                  aria-label="Add your prompt to memory"
                                  onClick={() => savePromptToMemory(room.goal)}
                                >
                                  <svg viewBox="0 0 24 24">
                                    <path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                                    <path d="M12 8v6M9 11h6" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>

                          {room.observations.map((o) => {
                            const oa = byId(o.agentId);
                            return (
                              <div className="pr-msg" key={o.id}>
                                <span className="pr-av">
                                  <GenAvatar
                                    seed={oa?.id ?? "agent"}
                                    size={34}
                                    radius={8}
                                  />
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
                                  {o.media && <MediaBlock media={o.media} />}
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
                              <GenAvatar
                                seed={room.assignedTo}
                                size={34}
                                radius={8}
                              />
                            </span>
                            <div className="pr-msg-body">
                              <div className="pr-msg-head">
                                <b>{byId(room.assignedTo)?.name ?? "Agent"}</b>
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

                    {s.loops.length > 0 && (
                      <div className="pr-loops">
                        <div className="pr-loops-head">
                          <span className="pr-loops-t">Loops</span>
                          <span className="pr-loops-sub">
                            self-correcting runs, guarded by budget + a human
                            gate
                          </span>
                        </div>
                        {s.loops.map((run) => {
                          const la = byId(run.spec.agentId);
                          const open = loopOpenId === run.spec.id;
                          const gate = pendingGate(run);
                          const it = run.iterations.length;
                          const cap = run.spec.budget.maxIterations;
                          return (
                            <div className="pr-loop" key={run.spec.id}>
                              <div className="pr-loop-row">
                                <span className={"pr-loop-dot " + run.status} />
                                <button
                                  className="pr-loop-main"
                                  onClick={() =>
                                    setLoopOpenId(open ? null : run.spec.id)
                                  }
                                >
                                  <span className="pr-loop-goal">
                                    {run.spec.goal}
                                  </span>
                                  <span className="pr-loop-meta">
                                    <span
                                      className={"pr-loop-stat " + run.status}
                                    >
                                      {LOOP_STATUS_LABEL[run.status]}
                                    </span>
                                    <span>
                                      iter {it}/{cap}
                                    </span>
                                    <span>{loopSpend(run)}</span>
                                    {la && <span>@{la.name}</span>}
                                  </span>
                                </button>
                                <div className="pr-loop-acts">
                                  {(run.status === "draft" ||
                                    run.status === "paused" ||
                                    run.status === "waiting_human") && (
                                    <button
                                      className="pr-loop-btn"
                                      onClick={() => s.startLoop(run.spec.id)}
                                    >
                                      {run.status === "draft"
                                        ? "Start"
                                        : "Resume"}
                                    </button>
                                  )}
                                  {run.status === "running" && (
                                    <button
                                      className="pr-loop-btn stop"
                                      onClick={() => s.stopLoop(run.spec.id)}
                                    >
                                      Stop
                                    </button>
                                  )}
                                  <button
                                    className="pr-loop-btn ghost"
                                    onClick={() => s.discardLoop(run.spec.id)}
                                    aria-label="Discard loop"
                                  >
                                    ×
                                  </button>
                                </div>
                              </div>
                              {gate && (
                                <div className="pr-loop-gate">
                                  Waiting on you · {gate}
                                </div>
                              )}
                              {open && (
                                <div className="pr-loop-trace">
                                  {run.iterations.length === 0 && (
                                    <div className="pr-loop-empty">
                                      No iterations yet.
                                    </div>
                                  )}
                                  {run.iterations.map((step) => (
                                    <div className="pr-loop-it" key={step.n}>
                                      <div className="pr-loop-it-head">
                                        <b>#{step.n}</b>
                                        <span
                                          className={
                                            "pr-loop-verdict " + step.verdict
                                          }
                                        >
                                          {step.verdict}
                                        </span>
                                        {step.gate && (
                                          <span className="pr-loop-gatename">
                                            {step.gate}
                                          </span>
                                        )}
                                        {step.tokens !== undefined && (
                                          <span className="pr-loop-tok">
                                            {step.tokens} tok
                                          </span>
                                        )}
                                      </div>
                                      <ul className="pr-loop-steps">
                                        <li>
                                          <span>sense</span>
                                          {step.sensed}
                                        </li>
                                        <li>
                                          <span>decide</span>
                                          {step.decided}
                                        </li>
                                        <li>
                                          <span>act</span>
                                          {step.acted || "(no output produced)"}
                                        </li>
                                        <li>
                                          <span>gather</span>
                                          {step.feedback || " - "}
                                        </li>
                                        <li>
                                          <span>verify</span>
                                          {step.verdict}
                                        </li>
                                      </ul>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="pr-composer">
                      {mentionQuery !== null && mentionMatches.length > 0 && (
                        <div
                          className="mention-pop"
                          onMouseDown={(e) => e.preventDefault()}
                        >
                          {mentionMatches.map((a, i) => (
                            <button
                              key={a.id}
                              className={
                                "mention-row" +
                                (i === mentionIndex ? " on" : "")
                              }
                              onMouseEnter={() => setMentionIndex(i)}
                              onClick={() => pickMention(a.name)}
                            >
                              <GenAvatar seed={a.id} size={28} radius={8} />
                              <span className="mention-meta">
                                <span className="mention-name">{a.name}</span>
                                <span className="mention-role">
                                  {roleLabel(a.role)}
                                </span>
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
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
                            syncMention(e.target);
                          }}
                          onPaste={onPasteFiles}
                          onBlur={() =>
                            window.setTimeout(() => setMentionQuery(null), 120)
                          }
                          onKeyDown={(e) => {
                            const open =
                              mentionQuery !== null &&
                              mentionMatches.length > 0;
                            if (open && e.key === "ArrowDown") {
                              e.preventDefault();
                              setMentionIndex(
                                (i) => (i + 1) % mentionMatches.length,
                              );
                              return;
                            }
                            if (open && e.key === "ArrowUp") {
                              e.preventDefault();
                              setMentionIndex(
                                (i) =>
                                  (i - 1 + mentionMatches.length) %
                                  mentionMatches.length,
                              );
                              return;
                            }
                            if (
                              open &&
                              (e.key === "Enter" || e.key === "Tab")
                            ) {
                              e.preventDefault();
                              pickMention(mentionMatches[mentionIndex]!.name);
                              return;
                            }
                            if (open && e.key === "Escape") {
                              e.preventDefault();
                              setMentionQuery(null);
                              return;
                            }
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              void sendRoomMessage();
                            }
                          }}
                        />
                        <div className="capture-bar">
                          <button
                            className="cap-tool icon"
                            onClick={() => gate() && fileRef.current?.click()}
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
                                            setModelOpen(false);
                                            chooseModel(m.name);
                                          }}
                                        >
                                          <span className="mp-av">
                                            {modelLogo(m.name) ?? m.prov[0]}
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
                                  <rect
                                    x="9"
                                    y="3"
                                    width="6"
                                    height="11"
                                    rx="3"
                                  />
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
                                background: byId(thread.assignedTo)?.accent,
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
                                <GenAvatar
                                  seed={oa?.id ?? "agent"}
                                  size={34}
                                  radius={8}
                                />
                              </span>
                              <div className="pr-msg-body">
                                <div className="pr-msg-head">
                                  <b>{oa?.name ?? "Agent"}</b>
                                  <span className="pr-time">{clock(o.ts)}</span>
                                </div>
                                <div className="pr-msg-text">
                                  <Markdown text={o.text} />
                                </div>
                                {o.media && <MediaBlock media={o.media} />}
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
                          {thread.status !== "done" && (
                            <button
                              className="pr-act loop"
                              disabled={loopBusy}
                              onClick={() => void runTaskAsLoop(thread.id)}
                              title="Generate a self-correcting loop from this task and your memory"
                            >
                              {loopBusy ? "Writing loop…" : "Run as a loop"}
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
                                      @{x.name} · {roleLabel(x.role)}
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

          {/* STUDIO  -  compile memory into a prompt */}
          <section className={"view" + (view === "studio" ? " on" : "")}>
            <div className="st2">
              <div className="composer-dock">
                <div className="capture">
                  <textarea
                    rows={1}
                    placeholder={
                      studioMode === "loop"
                        ? "What should the loop work toward? e.g. keep my reading list summarized"
                        : "What do you need a prompt for? e.g. a hero image for my notes app"
                    }
                    value={studioTask}
                    onChange={(e) => {
                      setStudioTask(e.target.value);
                      grow(e.target);
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter" || e.shiftKey) return;
                      e.preventDefault();
                      if (studioMode === "loop") {
                        if (!loopBusy && studioTask.trim())
                          void makeLoopFromStudio();
                      } else if (!studioLoading) {
                        void generateStudio();
                      }
                    }}
                  />
                  <div className="capture-bar studio-bar">
                    <button
                      className="cap-tool icon"
                      onClick={() => gate() && fileRef.current?.click()}
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
                    {modelPicker()}
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
                <div className="cmsg">
                  <div className="cmsg-q">
                    <div className="bubble-q">
                      {studioTask.trim() || "Generate from my memory"}
                    </div>
                    <span className="cmsg-uav">
                      <GenAvatar
                        seed={sess?.addr ?? walletState?.label ?? "you"}
                        size={28}
                      />
                    </span>
                  </div>
                  {studioTask.trim() && (
                    <div className="cmsg-q-acts">
                      <button
                        className="cmsg-ic"
                        title="Copy"
                        aria-label="Copy your message"
                        onClick={() => copyText(studioTask, "Copied.")}
                      >
                        <svg viewBox="0 0 24 24">
                          <rect x="9" y="9" width="11" height="11" rx="2" />
                          <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                        </svg>
                      </button>
                      <button
                        className="cmsg-ic"
                        title="Add to memory"
                        aria-label="Add your prompt to memory"
                        onClick={() => savePromptToMemory(studioTask)}
                      >
                        <svg viewBox="0 0 24 24">
                          <path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                          <path d="M12 8v6M9 11h6" />
                        </svg>
                      </button>
                    </div>
                  )}
                  <div className="cmsg-a">
                    {(() => {
                      // BYOK models answer under their own avatar; the free Gemini
                      // assistant keeps the Cortex mark, exactly like the chat page.
                      const prov = modelProvider(s.model.name, s.customModels);
                      if (prov && prov !== "google")
                        return (
                          <span className="cmsg-av plain" title={s.model.name}>
                            <GenAvatar seed={s.model.name} size={34} />
                          </span>
                        );
                      return (
                        <span className="cmsg-av" aria-hidden="true">
                          <Logo variant="current" className="cmsg-logo" />
                        </span>
                      );
                    })()}
                    <div className="cmsg-card">
                      <div className="st2-out-top">
                        <span className="st-tok">
                          ~{Math.round(studioOut.length / 4)} tokens
                        </span>
                      </div>
                      <div
                        className={
                          "st2-bubble" + (studioLoading ? " loading" : "")
                        }
                      >
                        {renderStudioOutput(studioOut, studioType)}
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
                                  <span>
                                    Fenced, ready to paste into an LLM
                                  </span>
                                </span>
                              </button>
                              {STUDIO_PRODUCTS[studioModality].map((p) => (
                                <button
                                  key={p.name}
                                  className="st2-menu-item"
                                  onClick={() => openStudioProduct(p)}
                                >
                                  <span className="st2-menu-av">
                                    {STUDIO_PRODUCT_LOGOS[p.name] ? (
                                      <svg
                                        viewBox="0 0 24 24"
                                        fill="currentColor"
                                        aria-hidden="true"
                                      >
                                        <path
                                          d={STUDIO_PRODUCT_LOGOS[p.name]}
                                        />
                                      </svg>
                                    ) : STUDIO_PRODUCT_GLYPHS[p.name] ? (
                                      <svg
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth={1.7}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        aria-hidden="true"
                                      >
                                        <path
                                          d={STUDIO_PRODUCT_GLYPHS[p.name]}
                                        />
                                      </svg>
                                    ) : (
                                      p.name[0]
                                    )}
                                  </span>
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
                  </div>
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
          {/* KNOWLEDGE  -  document library (card grid) */}
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
                  onClick={() => gate() && fileRef.current?.click()}
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
                onClick={() => gate() && fileRef.current?.click()}
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
                    {/* Everything lives on Walrus, so the generic WALRUS chip is
                        noise; only show a meaningful type (PDF/MARKDOWN) or a
                        Shared provenance badge. */}
                    {(it.shared || it.badge !== "WALRUS") && (
                      <div className="kb2-badges">
                        <span
                          className={"kb2-badge" + (it.shared ? " shared" : "")}
                        >
                          {it.shared
                            ? `Shared${it.sharedBy ? ` · ${it.sharedBy}` : ""}`
                            : it.badge}
                        </span>
                      </div>
                    )}
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

          {/* SHARING  -  SuiNS identity, share memories, inbox + outbox */}
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
                  owned by your wallet on Sui - you can revoke a share at any
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
                      disabled={!privyOn}
                      title={privyOn ? undefined : "Sign-in is not configured"}
                    >
                      {privyOn
                        ? "Sign in with Privy"
                        : "Sign-in not configured"}
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
                        {claimedName && !changingName ? (
                          <>
                            <div className="ssub" style={{ marginTop: 10 }}>
                              You hold{" "}
                              <span style={{ fontFamily: "var(--mono)" }}>
                                {claimedName}
                              </span>{" "}
                              - it points to your wallet.
                            </div>
                            <button
                              className="pill-btn"
                              style={{ marginTop: 10 }}
                              onClick={() => {
                                setUsername("");
                                setClaimErr("");
                                setChangingName(true);
                              }}
                            >
                              Change username
                            </button>
                          </>
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
                                {claimBusy
                                  ? changingName
                                    ? "Changing…"
                                    : "Claiming…"
                                  : changingName
                                    ? "Change"
                                    : "Claim"}
                              </button>
                              {changingName && (
                                <button
                                  className="pill-btn"
                                  disabled={claimBusy}
                                  onClick={() => setChangingName(false)}
                                >
                                  Cancel
                                </button>
                              )}
                            </div>
                            <div className="ssub" style={{ marginTop: 8 }}>
                              {changingName
                                ? `Changing gives up ${claimedName} and points the new handle at your wallet. You hold one username at a time.`
                                : "Not claimed yet  -  pick a handle to get a name.cortex.sui address."}
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

          {/* INTEGRATIONS  -  MCP clients, storage backends, sources */}
          <section className={"view" + (view === "integrations" ? " on" : "")}>
            <div className="int2">
              <div className="int2-group">
                <div className="int2-grid">
                  {MCP_CLIENTS.map((c) => (
                    <div className="int2-card" key={c.key}>
                      <span className="int2-cav logo">{clientLogo(c.key)}</span>
                      <div className="int2-cname">{c.name}</div>
                      <div className="int2-cdesc">{c.blurb}</div>
                      <button
                        className="int2-cbtn"
                        onClick={() => intConnect(c.key)}
                      >
                        Connect
                      </button>
                    </div>
                  ))}
                </div>

                <div className="scard" style={{ marginTop: 18 }}>
                  <div className="int2-name">Authorize MCP</div>
                  <div className="ssub" style={{ marginTop: 4 }}>
                    One click grants your MCP everything it needs: your profile,
                    your memory, and your shared agent workspace (board + bus).
                    You can revoke anytime.
                  </div>
                  <div
                    className="ssub"
                    style={{ marginTop: 10, fontFamily: "var(--mono)" }}
                  >
                    {CORTEX_ENV.mcpAddress
                      ? "MCP wallet · " +
                        CORTEX_ENV.mcpAddress.slice(0, 10) +
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
                  {mcpToken && (
                    <div className="mcp-token">
                      <div className="mcp-token-label">
                        Your MCP access token
                      </div>
                      <div className="mcp-token-row">
                        <input
                          className="mcp-token-input"
                          readOnly
                          value={mcpToken}
                          onFocus={(e) => e.currentTarget.select()}
                        />
                        <button
                          className="pill-btn keep"
                          onClick={() => void copyMcpToken()}
                        >
                          {mcpTokenCopied ? "Copied" : "Copy"}
                        </button>
                      </div>
                      <div className="ssub" style={{ marginTop: 8 }}>
                        Paste this as a Bearer token in your MCP client. Keep it
                        secret; revoking access makes it stop working.
                      </div>
                    </div>
                  )}
                  {!mcpAuthReady && (
                    <div className="ssub" style={{ marginTop: 10 }}>
                      {!walletState?.wallet
                        ? "Sign in to authorize your MCP."
                        : "Set NEXT_PUBLIC_CORTEX_MCP_ADDRESS and deploy the contracts to enable."}
                    </div>
                  )}
                  <div className="conn-head">Connected apps</div>
                  {mcpConnections.length ? (
                    <div className="conn-list">
                      {mcpConnections.map((c) => (
                        <div className="conn-row" key={c.id}>
                          <span className="conn-meta">
                            <span className="conn-name">{c.client}</span>
                            <span className="conn-when">
                              Connected {ago(c.createdAt)}
                            </span>
                          </span>
                          <button
                            className="pill-btn conn-remove"
                            onClick={() => void removeMcpConnection(c.id)}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="ssub conn-empty">
                      No apps connected yet. Add Cortex as a custom connector in
                      Claude to connect.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {openDetail && (
              <div
                className="int2-modal-scrim"
                onClick={() => setIntOpen(null)}
              >
                <div
                  className="int2-modal"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="int2-mhead">
                    <span
                      className={"int2-mav" + (openDetail.av ? " logo" : "")}
                    >
                      {openDetail.av ?? openDetail.avLetter}
                    </span>
                    <div className="int2-mmeta">
                      <div className="int2-mtitle">
                        Set up {openDetail.name}
                      </div>
                      <div className="int2-msub">{openDetail.blurb}</div>
                    </div>
                    <button
                      className="int2-mx"
                      onClick={() => setIntOpen(null)}
                      aria-label="Close"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="int2-mbody">
                    <div className="int2-msteps-h">
                      Set up <span>{openDetail.steps.length} steps</span>
                    </div>
                    <ol className="int2-steps2">
                      {openDetail.steps.map((step, i) => (
                        <li className="int2-step2" key={i}>
                          <span className="int2-step2-n">{i + 1}</span>
                          <span className="int2-step2-t">{step}</span>
                        </li>
                      ))}
                    </ol>
                    <div className="int2-mcode">
                      <div className="int2-mcode-h">
                        <span>{openDetail.snippetLabel}</span>
                        <button
                          className="int2-copy"
                          onClick={() =>
                            copyText(openDetail.snippet, "Copied to clipboard")
                          }
                        >
                          Copy
                        </button>
                      </div>
                      <pre>{openDetail.snippet}</pre>
                    </div>
                  </div>
                  <div className="int2-mfoot">
                    <button
                      className="pill-btn keep"
                      onClick={() => setIntOpen(null)}
                    >
                      Done
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* SETTINGS  -  floating console over the current page */}
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
                            ? "How you sign in. Cortex uses Privy for login and a managed Sui wallet  -  your identity stays yours, with no seed phrase to lose."
                            : "Sign-in is not configured in this build, so the app runs in explore mode with no wallet and nothing persisted."}
                        </div>
                      </div>
                      {sess ? (
                        <div className="set-account">
                          <span className="set-av">
                            <GenAvatar seed={sess.addr} size={38} radius={10} />
                          </span>
                          <div className="set-acc-m">
                            <div className="set-acc-n">
                              Signed in · {sess.via}
                            </div>
                            <div className="set-acc-s">
                              {sess.addr.slice(0, 10)}…{sess.addr.slice(-6)}
                            </div>
                          </div>
                          <button
                            className="pill-btn"
                            onClick={doSignOut}
                            disabled={savingToChain}
                            title={
                              savingToChain
                                ? "Saving your memory to the Sui stack…"
                                : undefined
                            }
                          >
                            {savingToChain ? "Saving to Sui…" : "Sign out"}
                          </button>
                        </div>
                      ) : (
                        <div className="set-signin">
                          <button
                            className="pill-btn keep"
                            onClick={doSignIn}
                            disabled={!privyOn}
                            title={
                              privyOn ? undefined : "Sign-in is not configured"
                            }
                          >
                            <svg viewBox="0 0 24 24">
                              <circle cx="12" cy="12" r="9" />
                              <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
                            </svg>
                            {privyOn
                              ? "Sign in with Privy"
                              : "Sign-in not configured"}
                          </button>
                          <div className="set-note">
                            {privyOn
                              ? "Privy logs you in by email or social and provisions a managed Sui wallet that owns your memory on Walrus."
                              : "Sign-in is not configured in this build. Add a Privy app id (NEXT_PUBLIC_PRIVY_APP_ID) to sign in with a managed Sui wallet."}
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
                                address - they cover gas and Walrus storage.
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
                            {CORTEX_ENV.network === "testnet" && (
                              <>
                                <button
                                  className="wcard-claim"
                                  onClick={() => void claimGas()}
                                  disabled={claiming}
                                >
                                  {claiming
                                    ? "Sending tokens…"
                                    : "Get testnet SUI & WAL"}
                                </button>
                                <div className="wcard-claim-sub">
                                  Claim gas and Walrus storage from the Cortex
                                  executor. Transactions are sponsored on
                                  testnet, so you never need to fund this wallet
                                  yourself.
                                </div>
                              </>
                            )}
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
                          encrypted and stored only on this device - calls run
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
                          touches Walrus - only your wallet can decrypt it.
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
                            ? "MCP wallet · " +
                              CORTEX_ENV.mcpAddress.slice(0, 10) +
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
                        {mcpToken && (
                          <div className="mcp-token">
                            <div className="mcp-token-label">
                              Your MCP access token
                            </div>
                            <div className="mcp-token-row">
                              <input
                                className="mcp-token-input"
                                readOnly
                                value={mcpToken}
                                onFocus={(e) => e.currentTarget.select()}
                              />
                              <button
                                className="pill-btn keep"
                                onClick={() => void copyMcpToken()}
                              >
                                {mcpTokenCopied ? "Copied" : "Copy"}
                              </button>
                            </div>
                            <div className="ssub" style={{ marginTop: 8 }}>
                              Paste this as a Bearer token in your MCP client.
                              Keep it secret; revoking access makes it stop
                              working.
                            </div>
                          </div>
                        )}
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
                            <span style={{ fontFamily: "var(--mono)" }}>
                              {claimedName}
                            </span>{" "}
                            - it points to your wallet.
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
                          its own key, derived on that device and never stored -
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
                          not touched - this only wipes the local index.
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

        {/* BRAIN  -  full-bleed memory map */}
        {view === "brain" && (
          <div className="brain-stage">
            <MemoryMap onOpen={(m) => setDrawer(m)} theme={eff} />
          </div>
        )}

        {/* DOCS WIDGET  -  floating, visible on every page. */}
        <a
          className="docs-fab"
          href={DOCS_URL}
          target="_blank"
          rel="noreferrer"
          title="Documentation"
          aria-label="Documentation"
        >
          <svg viewBox="0 0 24 24">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
          <span>Docs</span>
        </a>

        {/* HOME COMPOSER  -  the chat box lives only on home (agents + studio have
            their own); memory, knowledge and brain are browse-only. */}
        {view === "home" && (
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
                onPaste={onPasteFiles}
              />
              <div className="capture-bar">
                <button
                  className="cap-tool icon"
                  onClick={() => gate() && fileRef.current?.click()}
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
                                setModelOpen(false);
                                chooseModel(m.name);
                              }}
                            >
                              <span className="mp-av">
                                {modelLogo(m.name) ?? m.prov[0]}
                              </span>
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
                  {videoCapable && (
                    <button
                      className={
                        "cap-tool gif-chip ask-only" + (s.gifMode ? " on" : "")
                      }
                      onClick={() => s.toggleGifMode()}
                      title={
                        s.gifMode
                          ? "Output a GIF instead of video"
                          : "Output a video"
                      }
                      aria-pressed={s.gifMode}
                    >
                      GIF
                    </button>
                  )}
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
        {/* shared file input  -  available on every view (Studio attach, etc.) */}
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
      {loopPreviewId &&
        (() => {
          const run = s.loops.find((r) => r.spec.id === loopPreviewId);
          if (!run) return null;
          const spec = run.spec;
          const sum = loopSummary(spec);
          const setField = (patch: Partial<LoopSpec>) =>
            s.updateLoopSpec(spec.id, patch);
          return (
            <div className="am-scrim" onClick={() => discardLoop(spec.id)}>
              <div className="am-modal" onClick={(e) => e.stopPropagation()}>
                <div className="am-head">
                  <div className="am-title">Run as a loop</div>
                  <button
                    className="am-x"
                    onClick={() => discardLoop(spec.id)}
                    aria-label="Close"
                  >
                    <svg viewBox="0 0 24 24">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </div>
                <div className="am-body">
                  <div className="lp-sum">
                    <div className="lp-sum-row">
                      <span className="lp-sum-l">What it does</span>
                      <span>{sum.does}</span>
                    </div>
                    <div className="lp-sum-row">
                      <span className="lp-sum-l">
                        How it knows it&apos;s done
                      </span>
                      <span>{sum.done}</span>
                    </div>
                    <div className="lp-sum-row">
                      <span className="lp-sum-l">Budget</span>
                      <span>{sum.budget}</span>
                    </div>
                    <div className="lp-sum-row">
                      <span className="lp-sum-l">Human gate</span>
                      <span>{sum.gate}</span>
                    </div>
                    {!run.iterations.length &&
                      spec.gates.some((g) => g.kind !== "reviewer") && (
                        <div className="lp-sum-note">
                          Command gates need a server/MCP executor to run, so
                          this loop pauses and escalates to you in the browser.
                        </div>
                      )}
                  </div>
                  <button
                    className="lp-adv-toggle"
                    onClick={() => setLoopAdvanced((v) => !v)}
                    aria-expanded={loopAdvanced}
                  >
                    {loopAdvanced ? "Hide advanced" : "Edit advanced"}
                  </button>
                  {loopAdvanced && (
                    <div className="lp-adv">
                      <label className="am-field">
                        <span className="am-label">Goal</span>
                        <textarea
                          className="lp-area"
                          rows={2}
                          value={spec.goal}
                          onChange={(e) => setField({ goal: e.target.value })}
                        />
                      </label>
                      <label className="am-field">
                        <span className="am-label">State source (sense)</span>
                        <input
                          value={spec.stateSource}
                          onChange={(e) =>
                            setField({ stateSource: e.target.value })
                          }
                        />
                      </label>
                      <label className="am-field">
                        <span className="am-label">Give up when</span>
                        <input
                          value={spec.giveUp}
                          onChange={(e) => setField({ giveUp: e.target.value })}
                        />
                      </label>
                      <label className="am-field">
                        <span className="am-label">Human gate</span>
                        <input
                          value={spec.humanGate}
                          onChange={(e) =>
                            setField({ humanGate: e.target.value })
                          }
                        />
                      </label>
                      <div className="lp-adv-grid">
                        <label className="am-field">
                          <span className="am-label">Max iterations</span>
                          <input
                            type="number"
                            min={1}
                            value={spec.budget.maxIterations}
                            onChange={(e) =>
                              setField({
                                budget: {
                                  ...spec.budget,
                                  maxIterations: Math.max(
                                    1,
                                    Number(e.target.value) || 1,
                                  ),
                                },
                              })
                            }
                          />
                        </label>
                        <label className="am-field">
                          <span className="am-label">Max minutes</span>
                          <input
                            type="number"
                            min={1}
                            value={Math.round(
                              spec.budget.maxWallClockMs / LOOP_MINUTE_MS,
                            )}
                            onChange={(e) =>
                              setField({
                                budget: {
                                  ...spec.budget,
                                  maxWallClockMs:
                                    Math.max(1, Number(e.target.value) || 1) *
                                    LOOP_MINUTE_MS,
                                },
                              })
                            }
                          />
                        </label>
                      </div>
                      <div className="lp-adv-gates">
                        <span className="am-label">Gates</span>
                        {spec.gates.map((g, gi) => (
                          <div className="lp-gate" key={gi}>
                            <span className={"lp-gate-kind " + g.kind}>
                              {g.kind}
                            </span>
                            <input
                              value={g.check}
                              onChange={(e) =>
                                setField({
                                  gates: spec.gates.map((x, xi) =>
                                    xi === gi
                                      ? { ...x, check: e.target.value }
                                      : x,
                                  ),
                                })
                              }
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="am-foot">
                  <button
                    className="am-cancel"
                    onClick={() => discardLoop(spec.id)}
                  >
                    Discard
                  </button>
                  <button
                    className="am-save"
                    onClick={() => confirmLoop(spec.id)}
                  >
                    Confirm &amp; run
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
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
                <span className="pr-av">
                  <GenAvatar
                    seed={agName || "new-agent"}
                    size={34}
                    radius={8}
                  />
                </span>
                <div className="ag-preview-m">
                  <div className="ag-preview-n">{agName || "New agent"}</div>
                  <div className="ag-preview-r">{roleLabel(agRole)}</div>
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
                <input
                  className="ag-input"
                  placeholder="e.g. Researcher, Strategist, QA reviewer…"
                  value={agRole}
                  onChange={(e) => setAgRole(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") createAgentFromForm();
                  }}
                />
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
                <span className="am-label">Modality</span>
                <div className="am-modality">
                  {(["text", "image", "video"] as Modality[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      className={"am-mod" + (amKind === k ? " on" : "")}
                      onClick={() => {
                        setAmKind(k);
                        setAmApiId("");
                      }}
                    >
                      {k === "text"
                        ? "Text"
                        : k === "image"
                          ? "Image"
                          : "Video"}
                    </button>
                  ))}
                </div>
              </label>
              <label className="am-field">
                <span className="am-label">
                  <i className="am-req">*</i> Model
                </span>
                {amKind === "text" ? (
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
                ) : (
                  <input
                    className="am-input"
                    placeholder={
                      amKind === "image" ? "e.g., gpt-image-1" : "e.g., sora-2"
                    }
                    value={amApiId}
                    onChange={(e) => setAmApiId(e.target.value)}
                  />
                )}
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
                never touches our servers - calls go straight from your browser
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
              // controls  -  they belong to whoever shared them.
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
                    {m.sharedBy ? "’s" : " owner’s"} memory - you can read it,
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

      <div className="toasts">
        {toasts.map((t) => {
          const isSettings = t.source === "settings";
          const meta = isSettings
            ? undefined
            : NAV.find(([v]) => v === t.source);
          const title = isSettings ? "Settings" : (meta?.[1] ?? "Cortex");
          const icon = isSettings ? (
            <>
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </>
          ) : (
            (meta?.[2] ?? <path d="M13 2 4 14h6l-1 8 9-12h-6z" />)
          );
          return (
            <div className={"ntf ntf-" + t.kind} key={t.id} role="status">
              <span className="ntf-ic">
                <svg viewBox="0 0 24 24">{icon}</svg>
              </span>
              <div className="ntf-body">
                <div className="ntf-title">{title}</div>
                <div className="ntf-msg">{t.body}</div>
                {t.tx && (
                  <a
                    className="ntf-link"
                    href={`https://suiscan.xyz/${CORTEX_ENV.network}/tx/${t.tx}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View on Suiscan ↗
                  </a>
                )}
              </div>
              <button
                className="ntf-close"
                onClick={() =>
                  setToasts((cur) => cur.filter((x) => x.id !== t.id))
                }
                aria-label="Dismiss notification"
              >
                <svg viewBox="0 0 24 24">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
