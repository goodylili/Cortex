"use client";

import { useState } from "react";

export type SourceKind = "memory" | "knowledge" | "web";

export interface SourceItem {
  kind: SourceKind;
  label: string;
  title?: string;
  url?: string;
}

function Icon({ kind }: { kind: SourceKind }) {
  if (kind === "memory")
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <ellipse cx="12" cy="6" rx="7" ry="3" />
        <path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
        <path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
      </svg>
    );
  if (kind === "knowledge")
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 5a17 17 0 0 1 9 2 17 17 0 0 1 9-2v13a17 17 0 0 0-9 2 17 17 0 0 0-9-2z" />
        <path d="M12 7v13" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </svg>
  );
}

export function SourceChips({ sources }: { sources: SourceItem[] }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!sources.length) return null;
  return (
    <div className="src-chips">
      {sources.map((s, i) => {
        const body = (
          <>
            <span className="src-chip-ic">
              <Icon kind={s.kind} />
            </span>
            <span className="src-chip-t">{s.label}</span>
          </>
        );
        // Web sources link out; memory + knowledge sources reveal their text on
        // click so the user can see exactly which memory grounded the answer.
        if (s.url) {
          return (
            <a
              key={i}
              className="src-chip"
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              title={s.title ?? s.label}
            >
              {body}
            </a>
          );
        }
        const detail = s.title;
        return (
          <span key={i} className="src-chip-wrap">
            <button
              type="button"
              className={"src-chip" + (open === i ? " on" : "")}
              onClick={() => setOpen(open === i ? null : i)}
              aria-expanded={open === i}
              title={detail ?? s.label}
            >
              {body}
            </button>
            {open === i && detail ? (
              <div className="src-chip-pop" role="tooltip">
                {detail}
              </div>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}
