// Derived: tag cloud over live memories.
import type { Memory, TagsArtifact } from "../models.js";

export function buildTags(namespace: string, memories: Memory[]): TagsArtifact {
  const counts = new Map<string, number>();
  for (const m of memories)
    if (!m.tombstone)
      for (const t of m.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  const tags = [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
  return {
    kind: "cortex.tags.v1",
    namespace,
    tags,
    createdAt: new Date().toISOString(),
  };
}
