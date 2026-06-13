// Derived: a changelog of what a diff did to the namespace.
import type { ChangesArtifact, ChangeEntry, MemoryDiff } from "../models";
export function changesFromDiff(diff: MemoryDiff): ChangesArtifact {
  const changes: ChangeEntry[] = [];
  for (const op of diff.operations) {
    if (op.type === "consolidate") {
      changes.push({
        memoryId: "new",
        change: "added",
        at: diff.createdAt,
        note: op.into.text.slice(0, 60),
      });
      op.mergeIds.forEach((id) =>
        changes.push({
          memoryId: id,
          change: "superseded",
          at: diff.createdAt,
        }),
      );
    } else if (op.type === "pattern")
      changes.push({
        memoryId: "new",
        change: "added",
        at: diff.createdAt,
        note: op.text.slice(0, 60),
      });
    else if (op.type === "prune")
      changes.push({
        memoryId: op.targetId,
        change: "tombstoned",
        at: diff.createdAt,
        note: op.reason,
      });
    else if (op.type === "verify")
      changes.push({
        memoryId: op.targetId,
        change: "verified",
        at: op.verifiedAt,
      });
  }
  return {
    kind: "cortex.changes.v1",
    namespace: diff.namespace,
    changes,
    createdAt: diff.createdAt,
  };
}
