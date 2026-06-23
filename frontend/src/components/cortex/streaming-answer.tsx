"use client";

import { useStreamStore } from "@/lib/cortex/stream-store";

// Renders the in-flight answer text while it streams. It subscribes ONLY to the
// stream store, so each typewriter tick re-renders this node alone rather than the
// whole app. Once streaming finishes the chat message holds the final text and is
// rendered as Markdown instead.
export function StreamingAnswer() {
  const text = useStreamStore((s) => s.text);
  return <>{text}</>;
}
