"use client";

import { useRef, useState } from "react";
import { useCortex } from "@/lib/cortex/store";
import { extractContent } from "@/lib/cortex/extract";
import type { CortexWallet } from "@/lib/cortex/use-wallet";

type Mode = "note" | "link" | "file";

// Build memory from a source: a written note, a webpage, or text/markdown files.
// Each is distilled into fact memories (and pushed to Walrus Memory when signed in)
// while the source document is tracked for provenance.
export function CaptureModal({
  wallet,
  flash,
  onClose,
}: {
  wallet: CortexWallet | null;
  flash: (m: string) => void;
  onClose: () => void;
}) {
  const s = useCortex();
  const [mode, setMode] = useState<Mode>("note");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const pushLive = (facts: string[]) => {
    if (!wallet) return;
    facts.forEach((f) => void wallet.remember(f).catch(() => {}));
  };
  const kept = (n: number) =>
    `${n} ${n === 1 ? "memory" : "memories"}${wallet ? " · on Walrus" : ""}`;

  async function addNote() {
    const t = text.trim();
    if (!t) return;
    const title = t.split("\n")[0]!.slice(0, 60) || "Note";
    const { facts } = s.ingestSource({ kind: "note", title, text: t });
    pushLive(facts);
    flash(`Kept ${kept(facts.length)}.`);
    onClose();
  }

  async function addLink() {
    const u = url.trim();
    if (!u) return;
    setBusy(true);
    try {
      const res = await fetch("/api/fetch-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: u }),
      });
      const d = await res.json();
      if (!res.ok || !d.text) {
        flash(d.error || "Couldn't read that link.");
        return;
      }
      const { facts } = s.ingestSource({
        kind: "url",
        title: d.title || u,
        origin: d.url || u,
        text: d.text,
        url: d.url,
      });
      pushLive(facts);
      flash(`Saved “${d.title || u}” · ${kept(facts.length)}.`);
      onClose();
    } catch {
      flash("Couldn't read that link.");
    } finally {
      setBusy(false);
    }
  }

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    let total = 0;
    for (const f of [...files]) {
      try {
        flash(`Reading ${f.name}…`);
        const content = await extractContent(f);
        if (!content.trim()) {
          flash(`${f.name}: nothing to extract.`);
          continue;
        }
        const { facts } = s.ingestSource({
          kind: "file",
          title: f.name,
          origin: f.name,
          text: content,
        });
        pushLive(facts);
        total += facts.length;
      } catch (err) {
        flash((err as Error).message);
      }
    }
    setBusy(false);
    if (total) {
      flash(`Kept ${kept(total)} from your files.`);
      onClose();
    }
  }

  const OPTIONS: { id: Mode; name: string; desc: string }[] = [
    {
      id: "note",
      name: "Write a note",
      desc: "Save your thoughts, notes and summaries as memories",
    },
    {
      id: "link",
      name: "Save a link",
      desc: "Pull a webpage in and distill it into memories",
    },
    {
      id: "file",
      name: "Upload files",
      desc: "Images, audio, video, text and docs — distilled into memories",
    },
  ];

  return (
    <div className="cap-backdrop" onClick={onClose}>
      <div className="cap" onClick={(e) => e.stopPropagation()}>
        <div className="cap-rail">
          {OPTIONS.map((o) => (
            <button
              key={o.id}
              className={"cap-opt" + (mode === o.id ? " on" : "")}
              onClick={() => setMode(o.id)}
            >
              <div className="cap-opt-name">{o.name}</div>
              <div className="cap-opt-desc">{o.desc}</div>
            </button>
          ))}
          <div className="cap-rail-foot">
            Distilled into memories{wallet ? " and stored on Walrus" : " locally"}.
          </div>
        </div>

        <div className="cap-main">
          {mode === "note" && (
            <textarea
              className="cap-input"
              autoFocus
              placeholder="Write or paste anything worth remembering…"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          )}
          {mode === "link" && (
            <div className="cap-link">
              <input
                className="cap-url"
                autoFocus
                placeholder="https://example.com/article"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void addLink();
                }}
              />
              <div className="cap-hint">
                Cortex reads the page and keeps what matters, with the link as the
                source.
              </div>
            </div>
          )}
          {mode === "file" && (
            <div className="cap-file">
              <input
                ref={fileRef}
                type="file"
                multiple
                hidden
                accept="image/*,audio/*,video/*,text/*,.txt,.md,.markdown,.csv,.json,.log,.html,.htm,.rtf,.tsv,.yaml,.yml,.pdf,.docx,.xlsx,.xls"
                onChange={(e) => void addFiles(e.target.files)}
              />
              <button
                className="cap-drop"
                onClick={() => fileRef.current?.click()}
              >
                <div className="cap-drop-t">
                  {busy ? "Working…" : "Choose files"}
                </div>
                <div className="cap-drop-s">
                  images, audio, video, text — distilled into memories
                </div>
              </button>
            </div>
          )}

          <div className="cap-foot">
            <button className="pill-btn" onClick={onClose}>
              Cancel
            </button>
            {mode !== "file" && (
              <button
                className="pill-btn keep"
                disabled={busy || (mode === "note" ? !text.trim() : !url.trim())}
                onClick={() => (mode === "note" ? addNote() : addLink())}
              >
                {busy ? "Working…" : "Add to memory"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
