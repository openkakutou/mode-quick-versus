// Pure fixed-timestep accumulator math for the match render loop: how many
// `engine.tick()` calls a given `requestAnimationFrame` callback should
// make, given how much real time has passed since the last one. See
// `.vibe/decisions/004-match-rendering-architecture.md` point 8 for the
// policy (capped, excess dropped rather than run as an extended catch-up
// burst) this implements.

/** How many simulation ticks to run this frame, and how much sub-tick time remains for next frame. */
export interface TicksToRun {
  ticksToRun: number;
  remainderMs: number;
}

/**
 * Given `accumulatedMs` of real elapsed time since the last frame (already
 * added to any carried-over remainder) and `tickIntervalMs` (how long one
 * simulation tick represents in real time), returns how many ticks to run
 * now. Under `maxTicksPerFrame`, every whole tick accumulated runs, and the
 * leftover sub-tick time is returned as `remainderMs` for smooth timing
 * next frame. At or above the cap (e.g. a backgrounded/throttled tab
 * resuming after a long gap), only `maxTicksPerFrame` ticks run and the
 * rest of the backlog is dropped entirely (`remainderMs: 0`) — the match
 * visibly resyncs to wall-clock time rather than running an extended
 * catch-up burst.
 */
export function computeTicksToRun(
  accumulatedMs: number,
  tickIntervalMs: number,
  maxTicksPerFrame: number,
): TicksToRun {
  const pending = Math.floor(accumulatedMs / tickIntervalMs);

  if (pending > maxTicksPerFrame) {
    return { ticksToRun: maxTicksPerFrame, remainderMs: 0 };
  }

  return {
    ticksToRun: pending,
    remainderMs: accumulatedMs - pending * tickIntervalMs,
  };
}
