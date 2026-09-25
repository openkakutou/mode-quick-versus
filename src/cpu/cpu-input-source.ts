// Composes the CPU opponent with the existing `TickInputSource` abstraction
// (backlog item 007) instead of replacing or bypassing it: player 1's
// input passes through the wrapped base source completely untouched;
// player 2's is overwritten in place, after the base read, using
// `cpu-controller.ts`'s decision logic. This satisfies the acceptance
// criterion that the CPU take actions "via the same input-routing path as
// item 006 rather than a separate privileged path into `engine`" -- every
// caller downstream of this wrapper still sees one ordinary
// `TickInputSource`. `getObservation` is a closure the caller supplies at
// construction time (reading `rendering/match-renderer.ts`'s own
// already-existing live fighter snapshot) rather than a new parameter on
// `read()` itself, so every input source keeps satisfying the exact same
// interface. See
// `.vibe/decisions/010-round-match-result-and-cpu-opponent-design.md`.
import { BUTTON_NAMES } from "../input/key-bindings.ts";
import type {
  TickInputPair,
  TickInputSource,
} from "../input/tick-input-source.ts";
import type { CpuController, CpuObservation } from "./cpu-controller.ts";
import { createCpuController } from "./cpu-controller.ts";

export interface CreateCpuAwareInputSourceOptions {
  /** The real (or faked, for testing) human input source this wraps. Player 1's read is passed through untouched. */
  baseSource: TickInputSource;
  /**
   * Returns the current fighter-position observation the CPU decides from,
   * or `null` when none is available yet (e.g. before the match's first
   * tick has produced a state) -- player 2 then reads as neutral input
   * rather than deciding from stale/missing data.
   */
  getObservation: () => CpuObservation | null;
  /** Overrides the CPU decision logic entirely — for testing. Defaults to a real `createCpuController()`. */
  controller?: CpuController;
}

function resetToNeutral(target: TickInputPair[number]): void {
  target.up = false;
  target.down = false;
  target.left = false;
  target.right = false;
  for (const name of BUTTON_NAMES) target.buttons[name] = false;
}

/**
 * Wraps `options.baseSource` so player 2's input is decided by a CPU
 * controller instead of a real device, while player 1's stays exactly what
 * the base source produced. Returns the base source's own pre-allocated
 * pair object (mutated in place), never a fresh one -- the same
 * allocation-free contract `tick-input-source.ts`'s own `read()` already
 * follows.
 */
export function createCpuAwareInputSource(
  options: CreateCpuAwareInputSourceOptions,
): TickInputSource {
  const controller = options.controller ?? createCpuController();

  function read(): TickInputPair {
    const outputs = options.baseSource.read();
    const observation = options.getObservation();
    if (observation) {
      controller.decide(observation, outputs[1]);
    } else {
      resetToNeutral(outputs[1]);
    }
    return outputs;
  }

  return {
    read,
    dispose: () => options.baseSource.dispose(),
  };
}
