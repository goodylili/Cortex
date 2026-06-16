import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Clients } from "../../sui/app/clients";
import type { Config } from "./config";

const tickLoops = vi.fn<() => Promise<string[]>>();

vi.mock("./loops", () => ({
  tickLoops: (...args: unknown[]) => tickLoops(...(args as [])),
}));

import { startLoopHost } from "./loop-host";

const INTERVAL_MS = 1000;
const clients = {} as Clients;
const cfg = {} as Config;

beforeEach(() => {
  vi.useFakeTimers();
  tickLoops.mockReset();
  tickLoops.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("startLoopHost", () => {
  it("ticks immediately on start and again after intervalMs", async () => {
    const host = startLoopHost(clients, cfg, { intervalMs: INTERVAL_MS });

    await vi.advanceTimersByTimeAsync(0);
    expect(tickLoops).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    expect(tickLoops).toHaveBeenCalledTimes(2);

    host.stop();
  });

  it("delivers fired ids to onTick", async () => {
    tickLoops.mockResolvedValue(["lp_a", "lp_b"]);
    const onTick = vi.fn();
    const host = startLoopHost(clients, cfg, { intervalMs: INTERVAL_MS, onTick });

    await vi.advanceTimersByTimeAsync(0);
    expect(onTick).toHaveBeenCalledWith(["lp_a", "lp_b"]);

    host.stop();
  });

  it("skips the next fire while a previous tick is still in flight", async () => {
    let release: (() => void) | undefined;
    tickLoops.mockImplementationOnce(
      () =>
        new Promise<string[]>((resolve) => {
          release = () => resolve([]);
        }),
    );

    const host = startLoopHost(clients, cfg, { intervalMs: INTERVAL_MS });

    await vi.advanceTimersByTimeAsync(0);
    expect(tickLoops).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    expect(tickLoops).toHaveBeenCalledTimes(1);

    release?.();
    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    expect(tickLoops).toHaveBeenCalledTimes(2);

    host.stop();
  });

  it("routes a thrown tick to onError and keeps running", async () => {
    const boom = new Error("tick blew up");
    tickLoops.mockRejectedValueOnce(boom);
    const onError = vi.fn();
    const host = startLoopHost(clients, cfg, { intervalMs: INTERVAL_MS, onError });

    await vi.advanceTimersByTimeAsync(0);
    expect(onError).toHaveBeenCalledWith(boom);

    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    expect(tickLoops).toHaveBeenCalledTimes(2);

    host.stop();
  });

  it("stop() prevents further ticks", async () => {
    const host = startLoopHost(clients, cfg, { intervalMs: INTERVAL_MS });

    await vi.advanceTimersByTimeAsync(0);
    expect(tickLoops).toHaveBeenCalledTimes(1);

    host.stop();
    await vi.advanceTimersByTimeAsync(INTERVAL_MS * 3);
    expect(tickLoops).toHaveBeenCalledTimes(1);
  });
});
