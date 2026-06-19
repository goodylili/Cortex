import { describe, expect, it } from "vitest";
import type { Memory } from "@/lib/cortex/logic";
import {
  consolidate,
  DAY,
  DEFAULT_CONFIG,
  decayedActivation,
  dislike,
  facetOf,
  forget,
  INF,
  isForgettable,
  isRetrievable,
  like,
  normalizeConfig,
  onAccess,
  restore,
  retention,
  scoreTier,
  serializeConfig,
  stateOf,
} from "@/lib/cortex/memory-model";

const NOW = 1_000 * DAY;

const mem = (over: Partial<Memory>): Memory => ({
  id: over.id ?? "m",
  text: over.text ?? "",
  tags: over.tags ?? [],
  ts: over.ts ?? NOW,
  createdAt: over.createdAt ?? NOW,
  source: over.source ?? "note",
  ...over,
});

describe("facetOf", () => {
  it("classifies health text regardless of tags", () => {
    expect(facetOf("I am allergic to peanuts", [])).toBe("health");
  });

  it("classifies identity statements", () => {
    expect(facetOf("my name is Sam", [])).toBe("identity");
  });

  it("maps a money tag to the finance facet", () => {
    expect(facetOf("paid the bill", ["money"])).toBe("finance");
  });

  it("defaults to casual when nothing matches", () => {
    expect(facetOf("plain text here", [])).toBe("casual");
  });
});

describe("scoreTier", () => {
  it("raises a rule statement to at least the durable tier", () => {
    expect(scoreTier("always back up the database", "casual", "normal")).toBe(3);
  });

  it("never drops below the facet floor", () => {
    expect(scoreTier("just a note", "health", "low")).toBe(3);
  });

  it("uses the standard tier for a plain normal memory", () => {
    expect(scoreTier("ordinary thought", "casual", "normal")).toBe(2);
  });
});

describe("normalizeConfig", () => {
  it("restores Infinity for a null half-life entry", () => {
    const cfg = normalizeConfig({
      halfLife: { 0: 1, 1: 7, 2: 45, 3: 365, 4: null } as never,
    });
    expect(cfg.halfLife[4]).toBe(INF);
  });

  it("returns defaults when given nothing", () => {
    expect(normalizeConfig(null).theta).toBe(DEFAULT_CONFIG.theta);
  });
});

describe("serializeConfig", () => {
  it("converts an Infinity half-life to null", () => {
    const out = serializeConfig(DEFAULT_CONFIG) as {
      halfLife: Record<number, number | null>;
    };
    expect(out.halfLife[4]).toBeNull();
  });
});

describe("decayedActivation", () => {
  it("leaves activation untouched for a never-decaying core tier", () => {
    const m = mem({ tier: 4, activation: 0.7, lastAccess: NOW - 100 * DAY });
    expect(decayedActivation(m, NOW, DEFAULT_CONFIG)).toBe(0.7);
  });

  it("halves activation after exactly one half-life", () => {
    const m = mem({ tier: 1, activation: 0.8, lastAccess: NOW - 7 * DAY });
    expect(decayedActivation(m, NOW, DEFAULT_CONFIG)).toBeCloseTo(0.4, 5);
  });
});

describe("retention", () => {
  it("returns one for a pinned memory", () => {
    expect(retention(mem({ lock: "pinned" }), NOW, DEFAULT_CONFIG)).toBe(1);
  });

  it("returns zero for a suppressed memory", () => {
    expect(retention(mem({ lock: "suppressed" }), NOW, DEFAULT_CONFIG)).toBe(0);
  });
});

describe("isRetrievable", () => {
  it("is true for a pinned memory", () => {
    expect(isRetrievable(mem({ lock: "pinned" }), NOW, DEFAULT_CONFIG)).toBe(
      true,
    );
  });

  it("is false for a suppressed memory", () => {
    expect(
      isRetrievable(mem({ lock: "suppressed" }), NOW, DEFAULT_CONFIG),
    ).toBe(false);
  });
});

describe("isForgettable", () => {
  it("never forgets a locked memory", () => {
    expect(isForgettable(mem({ lock: "pinned" }), NOW, DEFAULT_CONFIG)).toBe(
      false,
    );
  });

  it("forgets a faded ephemeral memory past its ttl", () => {
    const m = mem({
      tier: 1,
      lock: "none",
      activation: 0,
      lastAccess: NOW - 90 * DAY,
      createdAt: NOW - 90 * DAY,
    });
    expect(isForgettable(m, NOW, DEFAULT_CONFIG)).toBe(true);
  });
});

describe("stateOf", () => {
  it("reports purged for a hard-forgotten memory", () => {
    expect(stateOf(mem({ lock: "forgotten_hard" }), NOW, DEFAULT_CONFIG)).toBe(
      "purged",
    );
  });

  it("reports core for a tier-four memory", () => {
    expect(stateOf(mem({ tier: 4, lock: "none" }), NOW, DEFAULT_CONFIG)).toBe(
      "core",
    );
  });

  it("reports active for a fresh standard memory", () => {
    const m = mem({ tier: 2, lock: "none", activation: 0.5, lastAccess: NOW });
    expect(stateOf(m, NOW, DEFAULT_CONFIG)).toBe("active");
  });
});

describe("onAccess", () => {
  it("bumps activation by the configured amount", () => {
    const m = mem({ activation: 0.3 });
    expect(onAccess(m, NOW, DEFAULT_CONFIG).activation).toBeCloseTo(0.45, 5);
  });

  it("increments the access count", () => {
    expect(onAccess(mem({ accessCount: 2 }), NOW, DEFAULT_CONFIG).accessCount).toBe(
      3,
    );
  });

  it("appends the access timestamp to the log", () => {
    expect(onAccess(mem({ accessLog: [] }), NOW, DEFAULT_CONFIG).accessLog).toContain(
      NOW,
    );
  });
});

describe("like", () => {
  it("pins the memory", () => {
    expect(like(mem({ tier: 2 }), NOW).lock).toBe("pinned");
  });

  it("promotes the tier by one", () => {
    expect(like(mem({ tier: 2 }), NOW).tier).toBe(3);
  });
});

describe("dislike", () => {
  it("zeroes the activation", () => {
    expect(dislike(mem({ tier: 2, activation: 0.8 }), NOW).activation).toBe(0);
  });

  it("demotes the tier by one", () => {
    expect(dislike(mem({ tier: 2 }), NOW).tier).toBe(1);
  });
});

describe("forget", () => {
  it("suppresses the memory on a soft forget", () => {
    expect(forget(mem({}), NOW).lock).toBe("suppressed");
  });

  it("tombstones and clears text on a hard forget", () => {
    expect(forget(mem({ text: "secret" }), NOW, true).text).toBe("");
  });
});

describe("restore", () => {
  it("clears the lock on a suppressed memory", () => {
    expect(restore(mem({ lock: "suppressed" }), NOW).lock).toBe("none");
  });

  it("refuses to restore a tombstone", () => {
    const m = mem({ lock: "forgotten_hard" });
    expect(restore(m, NOW)).toBe(m);
  });
});

describe("consolidate", () => {
  it("scans every input memory", () => {
    const out = consolidate(
      [mem({ id: "a", text: "hello" })],
      NOW,
      DEFAULT_CONFIG,
    );
    expect(out.summary.scanned).toBe(1);
  });

  it("de-indexes a faded forgettable memory", () => {
    const m = mem({
      id: "a",
      tier: 1,
      lock: "none",
      activation: 0,
      lastAccess: NOW - 90 * DAY,
      createdAt: NOW - 90 * DAY,
    });
    expect(consolidate([m], NOW, DEFAULT_CONFIG).summary.deindexed).toBe(1);
  });
});
