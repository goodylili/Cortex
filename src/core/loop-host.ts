// Autonomous scheduler host (phase 2). The loop runtime in ./loops can advance a single
// loop on demand, and tickLoops fires every loop whose schedule/event trigger is due —
// but nothing drives tickLoops unattended. This module is that missing daemon: a thin
// setInterval wrapper that calls tickLoops on a recurring cadence, with two guarantees
// the runtime itself doesn't provide. First, a re-entrancy guard: a single in-flight
// boolean means a slow tick never overlaps the next interval fire, so ticks can't pile
// up. Second, fault isolation: every tick is wrapped so a thrown error is routed to
// onError (or swallowed) and the host keeps running — one bad tick must never kill the
// scheduler. stop() clears the interval and lets any in-flight tick finish naturally.

import type { Config } from "./config";
import type { Clients } from "../../sui/app/clients";
import { tickLoops } from "./loops";

const DEFAULT_HOST_INTERVAL_MS = 60_000;

export interface LoopHostOptions {
  intervalMs?: number;
  onTick?: (fired: string[]) => void;
  onError?: (err: Error) => void;
}

export interface LoopHostHandle {
  stop: () => void;
}

// Start the daemon: run one tick immediately, then on a fixed interval. Returns a handle
// whose stop() ends the schedule (an in-flight tick is left to settle on its own).
export function startLoopHost(
  c: Clients,
  cfg: Config,
  opts: LoopHostOptions = {},
): LoopHostHandle {
  const intervalMs = opts.intervalMs ?? DEFAULT_HOST_INTERVAL_MS;
  let inFlight = false;

  // One guarded tick: skip if a previous tick is still running, otherwise run tickLoops
  // and route its result/error so neither a slow tick nor a thrown one can wedge the host.
  const runTick = async (): Promise<void> => {
    if (inFlight) return;
    inFlight = true;
    try {
      const fired = await tickLoops(c, cfg);
      opts.onTick?.(fired);
    } catch (err) {
      opts.onError?.(err instanceof Error ? err : new Error(String(err)));
    } finally {
      inFlight = false;
    }
  };

  void runTick();
  const timer = setInterval(() => void runTick(), intervalMs);

  return {
    stop: () => clearInterval(timer),
  };
}
