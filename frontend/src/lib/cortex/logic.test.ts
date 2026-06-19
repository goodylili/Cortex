import { describe, expect, it } from "vitest";
import {
  ago,
  autoTags,
  computeSavings,
  emptyState,
  extract,
  findClusters,
  findPattern,
  fmtMoney,
  fmtTokens,
  retrieve,
  toks,
  uid,
  type Cost,
  type Memory,
} from "@/lib/cortex/logic";

const mem = (over: Partial<Memory>): Memory => ({
  id: over.id ?? uid("m"),
  text: over.text ?? "",
  tags: over.tags ?? [],
  ts: over.ts ?? 0,
  createdAt: over.createdAt ?? 0,
  source: over.source ?? "note",
  ...over,
});

describe("uid", () => {
  it("prefixes the supplied string with an underscore separator", () => {
    expect(uid("ev").startsWith("ev_")).toBe(true);
  });

  it("produces distinct values on successive calls", () => {
    expect(uid("x")).not.toBe(uid("x"));
  });
});

describe("toks", () => {
  it("returns ceil of length divided by four", () => {
    expect(toks("abcde")).toBe(2);
  });

  it("returns zero for an empty string", () => {
    expect(toks("")).toBe(0);
  });
});

describe("fmtTokens", () => {
  it("rounds values below one thousand", () => {
    expect(fmtTokens(999)).toBe("999");
  });

  it("renders one decimal k for values between 1k and 10k", () => {
    expect(fmtTokens(1500)).toBe("1.5k");
  });

  it("drops the decimal at or above ten thousand", () => {
    expect(fmtTokens(15000)).toBe("15k");
  });
});

describe("fmtMoney", () => {
  it("formats two decimals at or above one cent", () => {
    expect(fmtMoney(1.5)).toBe("$1.50");
  });

  it("returns the zero literal for non-positive amounts", () => {
    expect(fmtMoney(0)).toBe("$0");
  });

  it("returns the sub-cent literal for tiny positive amounts", () => {
    expect(fmtMoney(0.001)).toBe("<$0.01");
  });
});

describe("ago", () => {
  it("returns just now for sub-minute deltas", () => {
    expect(ago(Date.now())).toBe("just now");
  });

  it("returns minutes for sub-hour deltas", () => {
    expect(ago(Date.now() - 5 * 60000)).toBe("5m ago");
  });
});

describe("autoTags", () => {
  it("matches the work category from a keyword", () => {
    expect(autoTags("time to deploy the api")).toContain("work");
  });

  it("falls back to note when nothing matches", () => {
    expect(autoTags("zzz qqq")).toEqual(["note"]);
  });

  it("caps the number of tags at three", () => {
    expect(
      autoTags("deploy flight birthday coffee").length,
    ).toBeLessThanOrEqual(3);
  });
});

describe("extract", () => {
  it("splits sentences that pass the length and letter filters", () => {
    expect(
      extract("This is a long enough sentence. And here is another long one."),
    ).toEqual([
      "This is a long enough sentence.",
      "And here is another long one.",
    ]);
  });

  it("falls back to the trimmed whole text when no part qualifies", () => {
    expect(extract("short")).toEqual(["short"]);
  });
});

describe("findClusters", () => {
  it("groups memories sharing enough significant words", () => {
    const a = mem({ id: "a", text: "quarterly planning budget review meeting" });
    const b = mem({ id: "b", text: "quarterly planning budget review notes" });
    expect(findClusters([a, b])).toHaveLength(1);
  });

  it("returns no groups when memories are unrelated", () => {
    const a = mem({ id: "a", text: "alpha beta gamma delta" });
    const b = mem({ id: "b", text: "spoon plate fork knife" });
    expect(findClusters([a, b])).toEqual([]);
  });
});

describe("findPattern", () => {
  it("returns the dominant tag once it reaches three occurrences", () => {
    const live = [
      mem({ id: "1", tags: ["work"] }),
      mem({ id: "2", tags: ["work"] }),
      mem({ id: "3", tags: ["work"] }),
    ];
    expect(findPattern(live)).toEqual({ tag: "work", count: 3 });
  });

  it("returns null when no tag reaches the threshold", () => {
    expect(findPattern([mem({ id: "1", tags: ["work"] })])).toBeNull();
  });
});

describe("retrieve", () => {
  it("returns memories whose text contains a query word", () => {
    const a = mem({ id: "a", text: "the lisbon flight is booked" });
    const b = mem({ id: "b", text: "buy more coffee beans" });
    expect(retrieve("lisbon", [a, b])).toEqual([a]);
  });

  it("returns nothing when no memory matches", () => {
    expect(retrieve("xyz", [mem({ id: "a", text: "hello world" })])).toEqual(
      [],
    );
  });
});

describe("computeSavings", () => {
  it("computes stored tokens from the live memory text", () => {
    const cost: Cost = {
      rawIngestedTokens: 0,
      dedupTokens: 0,
      retrievalTokens: 0,
      asks: 0,
    };
    expect(computeSavings([mem({ id: "a", text: "abcd" })], cost).storedTok).toBe(
      1,
    );
  });

  it("carries the ask count through from cost", () => {
    const cost: Cost = {
      rawIngestedTokens: 100,
      dedupTokens: 0,
      retrievalTokens: 0,
      asks: 7,
    };
    expect(computeSavings([], cost).asks).toBe(7);
  });
});

describe("emptyState", () => {
  it("starts with no memories", () => {
    expect(emptyState().memories).toEqual([]);
  });

  it("seeds a single start event", () => {
    expect(emptyState().events).toHaveLength(1);
  });

  it("initializes the cost ask counter to zero", () => {
    expect(emptyState().cost.asks).toBe(0);
  });
});
