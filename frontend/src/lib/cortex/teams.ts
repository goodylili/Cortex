// Teams: organization-scale memory sharing. A Team pools a set of members around a
// shared, referenceable memory index and a running feed (chat + handoffs). It mirrors
// the on-chain `teams::team` module (a Team shared object with members, roles and two
// Walrus blob pointers) but is driven client-side so the workspace is usable before
// the contract is published; each mutation is mirrored to localStorage so a team
// survives reloads. The `handle` is what a member references from any MCP-connected
// surface (Asana, Claude, Cursor) to reach the team's pooled memory.
import { uid } from "./logic";

export type TeamRole = "admin" | "member";
export type TeamStatus = "active" | "archived";

export interface TeamMember {
  id: string;
  name: string;
  handle: string;
  role: TeamRole;
  accent: string;
  addedAt: number;
}

// A memory a member has referenced into the team's shared index, tagged with who
// pulled it in and when, so provenance survives the handoff.
export interface TeamMemoryRef {
  id: string;
  memoryId: string;
  text: string;
  byId: string;
  byName: string;
  at: number;
}

export type TeamMessageKind = "message" | "handoff" | "system";

export interface TeamMessage {
  id: string;
  authorId: string;
  authorName: string;
  authorAccent: string;
  text: string;
  at: number;
  kind: TeamMessageKind;
  refs: TeamMemoryRef[];
}

export interface Team {
  id: string;
  name: string;
  handle: string;
  ownerId: string;
  status: TeamStatus;
  members: TeamMember[];
  messages: TeamMessage[];
  memoryRefs: TeamMemoryRef[];
  // opaque token shared in the invite link; anyone who opens the link joins.
  invite: string;
  createdAt: number;
  updatedAt: number;
  // the on-chain Team object id, once `teams::team::create_team` has been run.
  onchainId?: string;
}

const MEMBER_ACCENTS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
];

export function memberAccent(seed: number): string {
  return MEMBER_ACCENTS[Math.abs(seed) % MEMBER_ACCENTS.length];
}

// Slugify a team or handle to the bare form used in MCP references and SuiNS
// subnames, e.g. "Acme Corp" -> "acme-corp".
export function teamSlug(input: string): string {
  const slug = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.length > 0 ? slug : "team";
}

export function newMember(input: {
  name: string;
  handle?: string;
  role: TeamRole;
  seed?: number;
}): TeamMember {
  const name = input.name.trim();
  const handle = normalizeHandle(input.handle ?? name);
  return {
    id: uid("tm"),
    name,
    handle,
    role: input.role,
    accent: memberAccent(input.seed ?? name.length),
    addedAt: Date.now(),
  };
}

// Render a bare handle as its cortex SuiNS subname, matching `teams::team::full_name`.
export function fullHandle(handle: string): string {
  const bare = normalizeHandle(handle);
  return bare.endsWith(".cortex.sui") ? bare : `${bare}.cortex.sui`;
}

function normalizeHandle(raw: string): string {
  const trimmed = raw.trim().replace(/\.cortex\.sui$/i, "");
  if (trimmed.startsWith("0x")) return trimmed;
  return teamSlug(trimmed);
}

export function newTeam(input: { name: string; owner: TeamMember }): Team {
  const now = Date.now();
  const owner = { ...input.owner, role: "admin" as TeamRole };
  return {
    id: uid("team"),
    name: input.name.trim(),
    handle: teamSlug(input.name),
    ownerId: owner.id,
    status: "active",
    members: [owner],
    messages: [
      {
        id: uid("tmsg"),
        authorId: "system",
        authorName: "Cortex",
        authorAccent: "#64748b",
        text: `Team created. Members can reference this team's memory anywhere the Cortex MCP is connected with @${teamSlug(input.name)}.`,
        at: now,
        kind: "system",
        refs: [],
      },
    ],
    memoryRefs: [],
    invite: uid("inv"),
    createdAt: now,
    updatedAt: now,
  };
}

const STORAGE_KEY = "cortex-teams";

export function loadTeams(): Team[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Team[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveTeams(teams: Team[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(teams));
  } catch {}
}
