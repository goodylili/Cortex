"use client";
import { useMemo, useState } from "react";
import { useCortex } from "@/lib/cortex/store";
import { fullHandle, type TeamRole } from "@/lib/cortex/teams";
import { ago } from "@/lib/cortex/logic";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function Avatar({
  name,
  accent,
  size = 28,
}: {
  name: string;
  accent: string;
  size?: number;
}) {
  return (
    <div
      className="tm-av"
      style={{
        background: accent,
        width: size,
        height: size,
        fontSize: Math.round(size * 0.4),
      }}
    >
      {initials(name)}
    </div>
  );
}

export function TeamsView() {
  const s = useCortex();
  const {
    teams,
    activeTeamId,
    createTeam,
    setActiveTeam,
    addTeamMember,
    removeTeamMember,
    setTeamMemberRole,
    postTeamMessage,
    archiveTeam,
    deleteTeam,
    memories,
  } = s;

  const [newTeamName, setNewTeamName] = useState("");
  const [creating, setCreating] = useState(false);
  const [memberName, setMemberName] = useState("");
  const [memberRole, setMemberRole] = useState<TeamRole>("member");
  const [composer, setComposer] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);

  const active = useMemo(
    () => teams.find((t) => t.id === activeTeamId) ?? teams[0] ?? null,
    [teams, activeTeamId],
  );

  const recentMemories = useMemo(
    () =>
      memories
        .filter((m) => !m.tombstone && m.lock !== "forgotten_hard")
        .slice(0, 40),
    [memories],
  );

  const handleCreate = () => {
    const id = createTeam(newTeamName);
    if (id) {
      setNewTeamName("");
      setCreating(false);
      setActiveTeam(id);
    }
  };

  const handleAddMember = () => {
    if (!active || !memberName.trim()) return;
    addTeamMember(active.id, { name: memberName, role: memberRole });
    setMemberName("");
    setMemberRole("member");
  };

  const handleSend = () => {
    if (!active) return;
    if (!composer.trim() && picked.length === 0) return;
    postTeamMessage(active.id, composer, picked);
    setComposer("");
    setPicked([]);
    setPickerOpen(false);
  };

  const togglePick = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  if (teams.length === 0) {
    return (
      <div className="tm-shell tm-empty-shell">
        <div className="tm-empty">
          <div className="tm-empty-badge">Teams</div>
          <h2>Share memory across your organization</h2>
          <p>
            Create a team to pool memories, hand off work, and let every member
            reference the same durable context from anywhere the Cortex MCP is
            connected  -  Asana, Claude, Cursor, or the web.
          </p>
          <div className="tm-create-row">
            <input
              className="tm-input"
              placeholder="Team name (e.g. Acme Engineering)"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <button className="tm-btn primary" onClick={handleCreate}>
              Create team
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tm-shell">
      <aside className="tm-rail">
        <div className="tm-rail-head">
          <span className="tm-rail-title">Teams</span>
          <button
            className="tm-icon"
            title="New team"
            onClick={() => setCreating((v) => !v)}
          >
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path
                d="M12 5v14M5 12h14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        {creating && (
          <div className="tm-create-inline">
            <input
              className="tm-input sm"
              placeholder="Team name"
              autoFocus
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <button className="tm-btn sm primary" onClick={handleCreate}>
              Add
            </button>
          </div>
        )}
        <div className="tm-team-list">
          {teams.map((t) => (
            <button
              key={t.id}
              className={"tm-team" + (active?.id === t.id ? " on" : "")}
              onClick={() => setActiveTeam(t.id)}
            >
              <span className="tm-team-mark" style={{ background: "#6366f1" }}>
                {initials(t.name)}
              </span>
              <span className="tm-team-meta">
                <span className="tm-team-name">
                  {t.name}
                  {t.status === "archived" && (
                    <span className="tm-arch">archived</span>
                  )}
                </span>
                <span className="tm-team-sub">
                  @{t.handle} · {t.members.length}{" "}
                  {t.members.length === 1 ? "member" : "members"}
                </span>
              </span>
            </button>
          ))}
        </div>

        {active && (
          <div className="tm-roster">
            <div className="tm-grp-l">Members · {active.members.length}</div>
            <div className="tm-member-list">
              {active.members.map((m) => (
                <div key={m.id} className="tm-member">
                  <Avatar name={m.name} accent={m.accent} size={26} />
                  <div className="tm-member-meta">
                    <span className="tm-member-n">{m.name}</span>
                    <span className="tm-member-h">{fullHandle(m.handle)}</span>
                  </div>
                  {m.id === active.ownerId ? (
                    <span className="tm-role owner">owner</span>
                  ) : (
                    <>
                      <button
                        className="tm-role-toggle"
                        title="Toggle role"
                        onClick={() =>
                          setTeamMemberRole(
                            active.id,
                            m.id,
                            m.role === "admin" ? "member" : "admin",
                          )
                        }
                      >
                        {m.role}
                      </button>
                      <button
                        className="tm-member-x"
                        title="Remove member"
                        onClick={() => removeTeamMember(active.id, m.id)}
                      >
                        ×
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className="tm-add-member">
              <input
                className="tm-input sm"
                placeholder="Name or handle"
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddMember()}
              />
              <button
                className={"tm-role-pick" + (memberRole === "admin" ? " admin" : "")}
                onClick={() =>
                  setMemberRole((r) => (r === "admin" ? "member" : "admin"))
                }
                title="Role for the new member"
              >
                {memberRole}
              </button>
              <button className="tm-btn sm" onClick={handleAddMember}>
                Add
              </button>
            </div>
          </div>
        )}
      </aside>

      {active ? (
        <div className="tm-main">
          <div className="tm-chan-head">
            <div className="tm-chan-id">
              <span className="tm-hash">#</span>
              {active.handle}
            </div>
            <div className="tm-chan-topic">
              {active.name} · {active.members.length}{" "}
              {active.members.length === 1 ? "member" : "members"} ·{" "}
              {active.memoryRefs.length} shared{" "}
              {active.memoryRefs.length === 1 ? "memory" : "memories"}
            </div>
            <div className="tm-chan-acts">
              <button
                className="tm-btn ghost sm"
                onClick={() => archiveTeam(active.id)}
              >
                {active.status === "archived" ? "Reactivate" : "Archive"}
              </button>
              <button
                className="tm-btn ghost sm danger"
                onClick={() => {
                  deleteTeam(active.id);
                }}
              >
                Delete
              </button>
            </div>
          </div>

          <div className="tm-feed">
            {active.messages.map((msg) => (
              <div
                key={msg.id}
                className={"tm-msg" + (msg.kind === "system" ? " sys" : "")}
              >
                {msg.kind === "system" ? (
                  <div className="tm-sysline">{msg.text}</div>
                ) : (
                  <>
                    <Avatar name={msg.authorName} accent={msg.authorAccent} />
                    <div className="tm-msg-body">
                      <div className="tm-msg-head">
                        <span className="tm-msg-author">{msg.authorName}</span>
                        {msg.kind === "handoff" && (
                          <span className="tm-tag">handoff</span>
                        )}
                        <span className="tm-time">{ago(msg.at)}</span>
                      </div>
                      {msg.text && <div className="tm-msg-text">{msg.text}</div>}
                      {msg.refs.length > 0 && (
                        <div className="tm-refs">
                          {msg.refs.map((r) => (
                            <div key={r.id} className="tm-ref">
                              <span className="tm-ref-ic">◆</span>
                              <span className="tm-ref-text">{r.text}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="tm-composer">
            {pickerOpen && (
              <div className="tm-picker">
                <div className="tm-picker-head">
                  Reference memories · {picked.length} selected
                </div>
                <div className="tm-picker-list">
                  {recentMemories.length === 0 && (
                    <div className="tm-picker-empty">
                      No memories yet. Capture some first.
                    </div>
                  )}
                  {recentMemories.map((m) => (
                    <label key={m.id} className="tm-picker-row">
                      <input
                        type="checkbox"
                        checked={picked.includes(m.id)}
                        onChange={() => togglePick(m.id)}
                      />
                      <span>{m.text}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="tm-composer-bar">
              <button
                className={"tm-ref-btn" + (pickerOpen ? " on" : "")}
                title="Reference memories"
                onClick={() => setPickerOpen((v) => !v)}
              >
                ◆ {picked.length > 0 ? picked.length : "Reference"}
              </button>
              <textarea
                className="tm-textarea"
                placeholder={`Message #${active.handle} or reference a memory to hand off…`}
                value={composer}
                onChange={(e) => setComposer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSend();
                }}
                rows={1}
              />
              <button className="tm-btn primary" onClick={handleSend}>
                Send
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="tm-main tm-main-empty">
          <div className="tm-empty">
            <h2>Select a team</h2>
            <p>Pick a team from the left to open its shared memory workspace.</p>
          </div>
        </div>
      )}

      {active && (
        <aside className="tm-side">
          <div className="tm-side-sec">
            <div className="tm-side-title">Connect anywhere</div>
            <p className="tm-side-p">
              Members reference this team&apos;s pooled memory from any
              MCP-connected surface. Point the Cortex MCP at the team handle:
            </p>
            <code className="tm-code">@team {active.handle}</code>
            <p className="tm-side-note">
              Works in Asana, Claude, Cursor, Windsurf, and the web  -  every
              member reads and writes the same durable context.
            </p>
          </div>
          <div className="tm-side-sec">
            <div className="tm-side-title">
              Shared memory · {active.memoryRefs.length}
            </div>
            <div className="tm-side-mem">
              {active.memoryRefs.length === 0 && (
                <div className="tm-side-empty">
                  No shared memories yet. Reference some from the composer to pool
                  them for the whole team.
                </div>
              )}
              {active.memoryRefs.map((r) => (
                <div key={r.id} className="tm-side-ref">
                  <span className="tm-ref-text">{r.text}</span>
                  <span className="tm-side-by">
                    via {r.byName} · {ago(r.at)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
