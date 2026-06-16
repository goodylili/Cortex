import { describe, expect, it } from "vitest";
import { decode, encode, memoryHead, newId, stateHash } from "./crypto";
import type { TagsArtifact } from "./models";

const artifact = (): TagsArtifact => ({
  kind: "cortex.tags.v1",
  namespace: "ns",
  tags: [{ tag: "work", count: 2 }],
  createdAt: "2026-01-01T00:00:00.000Z",
});

describe("stateHash", () => {
  it("returns a six-character hex digest", () => {
    expect(stateHash(["a", "b"])).toMatch(/^[0-9a-f]{6}$/);
  });

  it("is deterministic for the same input", () => {
    expect(stateHash(["x", "y"])).toBe(stateHash(["x", "y"]));
  });

  it("differs for different inputs", () => {
    expect(stateHash(["x"])).not.toBe(stateHash(["y"]));
  });
});

describe("memoryHead", () => {
  it("ignores tombstoned memories", () => {
    const live = [{ id: "a", text: "hi", verified: true, tombstone: false }];
    const withGhost = [
      ...live,
      { id: "b", text: "gone", verified: false, tombstone: true },
    ];
    expect(memoryHead(withGhost)).toBe(memoryHead(live));
  });

  it("is order-independent", () => {
    const a = { id: "a", text: "one", verified: false, tombstone: false };
    const b = { id: "b", text: "two", verified: false, tombstone: false };
    expect(memoryHead([a, b])).toBe(memoryHead([b, a]));
  });
});

describe("newId", () => {
  it("joins the prefix and eight hex characters", () => {
    expect(newId("mem")).toMatch(/^mem_[0-9a-f]{8}$/);
  });

  it("produces distinct ids", () => {
    expect(newId("mem")).not.toBe(newId("mem"));
  });
});

describe("encode", () => {
  it("rejects an artifact with an unknown kind", () => {
    expect(() => encode({ kind: "bogus" } as never)).toThrow();
  });
});

describe("decode", () => {
  it("round-trips an encoded artifact", () => {
    expect(decode(encode(artifact())).kind).toBe("cortex.tags.v1");
  });

  it("rejects bytes that are not valid JSON", () => {
    expect(() => decode(new TextEncoder().encode("not json"))).toThrow();
  });

  it("rejects a kind mismatch against the expectation", () => {
    expect(() => decode(encode(artifact()), "cortex.source.v1")).toThrow();
  });
});
