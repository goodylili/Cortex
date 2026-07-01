"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCortex } from "@/lib/cortex/store";
import { fullHandle, teamSlug, type TeamRole } from "@/lib/cortex/teams";
import { ago } from "@/lib/cortex/logic";
import { GenAvatar } from "./gen-avatar";

type ComposerMode = "message" | "handoff";

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
    joinTeamByInvite,
    removeTeamMemory,
    memories,
    profile,
  } = s;

  const ta = useRef<HTMLTextAreaElement>(null);
  const [railOpen, setRailOpen] = useState(true);
  const [threadOpen, setThreadOpen] = useState(false);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [secTeams, setSecTeams] = useState(true);
  const [secMembers, setSecMembers] = useState(true);
  const [newTeamName, setNewTeamName] = useState("");
  const [creating, setCreating] = useState(false);
  const [memberName, setMemberName] = useState("");
  const [memberRole, setMemberRole] = useState<TeamRole>("member");
  const [mode, setMode] = useState<ComposerMode>("message");
  const [input, setInput] = useState("");
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

  // Opening an invite link (?join=<token>) joins the current user to that team,
  // then strips the param so a refresh does not re-trigger it.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const token = params.get("join");
    if (!token) return;
    const id = joinTeamByInvite(token);
    if (id) setActiveTeam(id);
    const url = new URL(window.location.href);
    url.searchParams.delete("join");
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
  }, [joinTeamByInvite, setActiveTeam]);

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  // Who "I" am within a team: matched by my profile handle. Admins (owner + any
  // admin) manage the whole team; everyone else can still manage their own
  // contributions.
  const myHandle = teamSlug(profile.handle || profile.name || "you");

  const grow = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 260) + "px";
  };

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

  const send = () => {
    if (!active) return;
    if (!input.trim() && picked.length === 0) return;
    postTeamMessage(active.id, input, picked, mode);
    setInput("");
    setPicked([]);
    setPickerOpen(false);
    if (ta.current) ta.current.style.height = "auto";
  };

  const togglePick = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  if (teams.length === 0) {
    return (
      <div className="pr-shell">
        <div
          className="pr-main"
          style={{ alignItems: "center", justifyContent: "center" }}
        >
          <div className="tm-empty">
            <div className="tm-empty-badge">Teams</div>
            <h2>Share memory across your organization</h2>
            <p>
              Create a team to pool memories, hand off work, and let every
              member reference the same durable context from anywhere the Cortex
              MCP is connected - Asana, Claude, Cursor, or the web.
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
      </div>
    );
  }

  const memberCount = active?.members.length ?? 0;
  const myMember = active?.members.find((m) => m.handle === myHandle) ?? null;
  const canManage = myMember?.role === "admin";
  const inviteUrl = active
    ? `${origin}/app?join=${active.invite ?? active.id}#teams`
    : "";
  const copyInvite = () => {
    if (!inviteUrl) return;
    void navigator.clipboard?.writeText(inviteUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };
  const canRemoveRef = (byId: string) =>
    canManage || (myMember != null && byId === myMember.id);

  return (
    <div className={"pr-shell" + (railOpen ? " rail-open" : "")}>
      <aside className={"pr-rail" + (railOpen ? " open" : "")}>
        <div className="pr-rail-body">
          <button
            className="pr-new"
            onClick={() => {
              setCreating(true);
              setActiveTeam("");
            }}
          >
            <svg viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New team
          </button>
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
          <div className="pr-side-scroll">
            <div className="pr-grp">
              <button
                className="pr-grp-toggle"
                onClick={() => setSecTeams((v) => !v)}
                aria-expanded={secTeams}
              >
                <svg
                  className={"pr-caret" + (secTeams ? " open" : "")}
                  viewBox="0 0 24 24"
                >
                  <path d="M9 6l6 6-6 6" />
                </svg>
                <span className="pr-grp-l">Teams · {teams.length}</span>
              </button>
            </div>
            {secTeams &&
              teams.map((t) => (
                <button
                  key={t.id}
                  className={"pr-room" + (active?.id === t.id ? " on" : "")}
                  onClick={() => setActiveTeam(t.id)}
                >
                  <span
                    className={
                      "pr-room-dot" + (active?.id === t.id ? " on" : "")
                    }
                  />
                  <span className="pr-hash">#</span>
                  <span className="pr-room-name">{t.handle}</span>
                  {t.members.length > 0 && (
                    <span className="pr-room-badge">{t.members.length}</span>
                  )}
                </button>
              ))}

            {active && (
              <>
                <div className="pr-grp">
                  <button
                    className="pr-grp-toggle"
                    onClick={() => setSecMembers((v) => !v)}
                    aria-expanded={secMembers}
                  >
                    <svg
                      className={"pr-caret" + (secMembers ? " open" : "")}
                      viewBox="0 0 24 24"
                    >
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                    <span className="pr-grp-l">Members · {memberCount}</span>
                  </button>
                </div>
                {secMembers && (
                  <>
                    {active.members.map((m) => {
                      const isOwner = m.id === active.ownerId;
                      return (
                        <div className="pr-member" key={m.id}>
                          <span className="pr-av">
                            <GenAvatar seed={m.handle} size={34} radius={8} />
                            <span className="pr-presence active" />
                          </span>
                          <div className="pr-member-m">
                            <div className="pr-member-n">{m.name}</div>
                            <div className="pr-member-r">
                              {fullHandle(m.handle)}
                            </div>
                          </div>
                          <div className="pr-member-acts">
                            {isOwner ? (
                              <span className="pr-status active">owner</span>
                            ) : canManage ? (
                              <>
                                <button
                                  className={
                                    "tm-role-pick" +
                                    (m.role === "admin" ? " admin" : "")
                                  }
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
                                  className="pr-member-ic danger"
                                  title="Remove member"
                                  onClick={() =>
                                    removeTeamMember(active.id, m.id)
                                  }
                                >
                                  <svg viewBox="0 0 24 24">
                                    <path d="M6 6l12 12M18 6L6 18" />
                                  </svg>
                                </button>
                              </>
                            ) : (
                              <span className="pr-status">{m.role}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {canManage && (
                      <div className="tm-add-member">
                        <input
                          className="tm-input sm"
                          placeholder="Name or handle"
                          value={memberName}
                          onChange={(e) => setMemberName(e.target.value)}
                          onKeyDown={(e) =>
                            e.key === "Enter" && handleAddMember()
                          }
                        />
                        <button
                          className={
                            "tm-role-pick" +
                            (memberRole === "admin" ? " admin" : "")
                          }
                          onClick={() =>
                            setMemberRole((r) =>
                              r === "admin" ? "member" : "admin",
                            )
                          }
                          title="Role for the new member"
                        >
                          {memberRole}
                        </button>
                        <button className="tm-btn sm" onClick={handleAddMember}>
                          Add
                        </button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
        <button
          className="pr-rail-toggle"
          onClick={() => setRailOpen((v) => !v)}
          aria-expanded={railOpen}
        >
          <span className="pr-rail-l">
            <svg viewBox="0 0 24 24">
              <circle cx="8" cy="8" r="2.6" />
              <circle cx="16" cy="8" r="2.6" />
              <path d="M3.5 19a4.5 4.5 0 0 1 9 0M11.5 19a4.5 4.5 0 0 1 9 0" />
            </svg>
            <span className="pr-rail-t">Teams &amp; members</span>
            <span className="pr-rail-count">{teams.length}</span>
          </span>
          <svg className="pr-rail-chev" viewBox="0 0 24 24">
            <path d="M6 15l6-6 6 6" />
          </svg>
        </button>
      </aside>

      <div className="pr-main">
        {active ? (
          <>
            <div className="pr-chan-head">
              <div className="pr-chan-id">
                <span className="pr-hash">#</span>
                <b>{active.handle}</b>
                <span className="pr-chan-topic">
                  {active.name} · {memberCount}{" "}
                  {memberCount === 1 ? "member" : "members"} ·{" "}
                  {active.memoryRefs.length} shared{" "}
                  {active.memoryRefs.length === 1 ? "memory" : "memories"}
                </span>
              </div>
              <div className="pr-chan-tools">
                <div className="pr-stack">
                  {active.members.slice(0, 5).map((m) => (
                    <span key={m.id} className="pr-av xs" title={m.name}>
                      {m.name.slice(0, 2).toUpperCase()}
                    </span>
                  ))}
                </div>
                <button className="pr-act primary" onClick={copyInvite}>
                  {copied ? "Link copied" : "Invite"}
                </button>
                {canManage && (
                  <button
                    className="pr-act"
                    onClick={() => archiveTeam(active.id)}
                  >
                    {active.status === "archived" ? "Reactivate" : "Archive"}
                  </button>
                )}
                {canManage && active.ownerId === myMember?.id && (
                  <button
                    className="pr-act"
                    onClick={() => deleteTeam(active.id)}
                  >
                    Delete
                  </button>
                )}
                <button
                  className={"pr-act" + (threadOpen ? " on" : "")}
                  onClick={() => setThreadOpen((v) => !v)}
                  title="Team details"
                >
                  Details
                </button>
              </div>
            </div>

            <div className="pr-feed">
              {active.messages.map((msg) =>
                msg.kind === "system" ? (
                  <div className="pr-day" key={msg.id}>
                    {msg.text}
                  </div>
                ) : (
                  <div className="pr-msg" key={msg.id}>
                    <span className="pr-av">
                      <GenAvatar
                        seed={msg.authorName || msg.authorId}
                        size={34}
                        radius={8}
                      />
                    </span>
                    <div className="pr-msg-body">
                      <div className="pr-msg-head">
                        <b>{msg.authorName}</b>
                        {msg.kind === "handoff" && (
                          <span className="pr-tag">handoff</span>
                        )}
                        <span className="pr-time">{ago(msg.at)}</span>
                      </div>
                      {msg.text && (
                        <div className="pr-msg-text">{msg.text}</div>
                      )}
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
                  </div>
                ),
              )}
            </div>

            <div className="pr-composer">
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
              <div className="capture pr-capture">
                <textarea
                  ref={ta}
                  rows={1}
                  placeholder={
                    mode === "handoff"
                      ? `Hand off work to #${active.handle}  -  reference the memories the next person needs…`
                      : `Message #${active.handle}, or reference a memory to pool it for the team…`
                  }
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    grow(e.target);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                />
                <div className="capture-bar">
                  <button
                    className={
                      "cap-tool" +
                      (pickerOpen || picked.length > 0 ? " on" : "")
                    }
                    onClick={() => setPickerOpen((v) => !v)}
                    title="Reference memories from your brain"
                  >
                    <svg viewBox="0 0 24 24">
                      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" />
                      <path d="M12 12v9M4 7.5l8 4.5 8-4.5" />
                    </svg>
                    {picked.length > 0
                      ? `${picked.length} referenced`
                      : "Reference"}
                  </button>
                  <div className="mode-toggle pr-mode">
                    <button
                      className={mode === "message" ? "on" : ""}
                      onClick={() => setMode("message")}
                    >
                      <svg viewBox="0 0 24 24">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                      Message
                    </button>
                    <button
                      className={mode === "handoff" ? "on" : ""}
                      onClick={() => setMode("handoff")}
                    >
                      <svg viewBox="0 0 24 24">
                        <path d="M4 12h13M13 6l6 6-6 6" />
                      </svg>
                      Handoff
                    </button>
                  </div>
                  <div className="cap-tail">
                    <button
                      className="pr-send"
                      onClick={send}
                      disabled={!input.trim() && picked.length === 0}
                      aria-label="Send"
                    >
                      <svg viewBox="0 0 24 24">
                        <path d="M12 19V5M5 12l7-7 7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div
            className="pr-feed-empty"
            style={{ margin: "auto", maxWidth: 420, textAlign: "center" }}
          >
            {creating
              ? "Name your new team in the rail to create it."
              : "Select a team from the left, or create one."}
          </div>
        )}
      </div>

      {active && threadOpen && (
        <aside className="pr-thread">
          <div className="pr-thread-head">
            <span className="pr-thread-crumb">Team</span>
            <button
              className="pr-act"
              onClick={() => setThreadOpen(false)}
              aria-label="Close details"
            >
              Close
            </button>
          </div>
          <div className="pr-thread-scroll">
            <div className="pr-thread-title">{active.name}</div>
            <div className="pr-thread-meta">
              <span className="pr-thread-assignee">
                @{active.handle} · {memberCount}{" "}
                {memberCount === 1 ? "member" : "members"}
              </span>
            </div>

            <div className="tm-side-title" style={{ marginTop: 22 }}>
              Invite people
            </div>
            <p className="tm-side-p">
              Anyone who opens this link joins {active.name} as a member, sees
              the team, and can share memory.
            </p>
            <code className="tm-code" style={{ wordBreak: "break-all" }}>
              {inviteUrl || "…"}
            </code>
            <button
              className="tm-btn sm"
              style={{ marginTop: 8 }}
              onClick={copyInvite}
            >
              {copied ? "Link copied" : "Copy invite link"}
            </button>

            <div className="tm-side-title" style={{ marginTop: 22 }}>
              Connect anywhere
            </div>
            <p className="tm-side-p">
              Members reference this team&apos;s pooled memory from any
              MCP-connected surface. Point the Cortex MCP at the team handle:
            </p>
            <code className="tm-code">@team {active.handle}</code>
            <p className="tm-side-note">
              Works in Asana, Claude, Cursor, Windsurf, and the web - every
              member reads and writes the same durable context.
            </p>

            <div className="tm-side-title" style={{ marginTop: 22 }}>
              Shared memory · {active.memoryRefs.length}
            </div>
            <p className="tm-side-note" style={{ marginTop: 0 }}>
              The whole team owns these. Admins can remove any; you can always
              remove your own.
            </p>
            <div className="tm-side-mem">
              {active.memoryRefs.length === 0 && (
                <div className="tm-side-empty">
                  No shared memories yet. Reference some from the composer to
                  pool them for the whole team.
                </div>
              )}
              {active.memoryRefs.map((r) => (
                <div key={r.id} className="tm-side-ref">
                  <div className="tm-side-ref-top">
                    <span className="tm-ref-text">{r.text}</span>
                    {canRemoveRef(r.byId) && (
                      <button
                        className="tm-side-x"
                        title="Remove from team memory"
                        onClick={() => removeTeamMemory(active.id, r.id)}
                      >
                        ×
                      </button>
                    )}
                  </div>
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
