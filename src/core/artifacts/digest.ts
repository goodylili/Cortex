// Derived: a period digest (highlights) over live memories.
import type { Digest, Memory } from "../models";
export function buildDigest(
  namespace: string,
  memories: Memory[],
  period: { from: string; to: string },
): Digest {
  const live = memories.filter((m) => !m.tombstone);
  const inPeriod = live.filter(
    (m) => m.when >= period.from && m.when <= period.to,
  );
  const pick = (inPeriod.length ? inPeriod : live).slice(0, 5);
  return {
    kind: "cortex.digest.v1",
    namespace,
    period,
    summary: `${inPeriod.length || live.length} memories in this period across ${new Set(live.flatMap((m) => m.tags)).size} topics.`,
    highlights: pick.map((m) => m.text),
    createdAt: new Date().toISOString(),
  };
}
