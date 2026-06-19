"use client";

import type { MediaState } from "@/lib/cortex/agents";
import { fileUrl } from "@/lib/cortex/walrus/files";

const sourceUrl = (media: MediaState): string | undefined =>
  media.blobId ? fileUrl(media.blobId) : media.dataUrl;

export function MediaBlock({ media }: { media: MediaState }) {
  const src = sourceUrl(media);
  const isVideo = media.kind === "video";

  if (media.status === "error") {
    return (
      <div className="media-block media-error">
        <div className="media-error-t">
          {media.reason ?? "Generation failed."}
        </div>
      </div>
    );
  }

  if (media.status === "generating") {
    const pct = Math.max(0, Math.min(100, Math.round(media.progress ?? 0)));
    return (
      <div className="media-block media-gen">
        {media.dataUrl && !isVideo ? (
          <img className="media-partial" src={media.dataUrl} alt={media.prompt ?? "preview"} />
        ) : (
          <div className="media-shimmer" aria-hidden="true" />
        )}
        <div className="media-gen-foot">
          <div className="media-bar">
            <div className="media-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="media-pct">
            {media.dataUrl && !isVideo ? "Refining" : "Generating"} {pct}%
          </span>
        </div>
      </div>
    );
  }

  if (!src) return null;

  return (
    <div className="media-block media-done">
      {isVideo ? (
        <video className="media-out" src={src} controls playsInline />
      ) : (
        <img className="media-out" src={src} alt={media.prompt ?? "generated"} />
      )}
      <div className="media-acts">
        <a className="media-ic" href={src} download title="Download" aria-label="Download">
          <svg viewBox="0 0 24 24">
            <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" />
          </svg>
        </a>
        {media.blobId && (
          <span className="media-tag">on Walrus</span>
        )}
      </div>
    </div>
  );
}
