// Derived: connections between memories that share tags (lightweight, offline).
import type { ConnectionsArtifact, Connection, Memory } from "../models.js";
export function buildConnections(
  namespace: string,
  memories: Memory[],
): ConnectionsArtifact {
  const live = memories.filter((m) => !m.tombstone);
  const conns: Connection[] = [];
  for (let i = 0; i < live.length; i++) {
    const a = live[i]!;
    for (let j = i + 1; j < live.length; j++) {
      const b = live[j]!;
      const shared = a.tags.filter((t) => b.tags.includes(t));
      if (shared.length)
        conns.push({
          from: a.id,
          to: b.id,
          relation: "shares:" + shared.join(","),
          confidence: Math.min(1, shared.length / 2),
        });
    }
  }
  return {
    kind: "cortex.connections.v1",
    namespace,
    connections: conns.slice(0, 200),
    createdAt: new Date().toISOString(),
  };
}
