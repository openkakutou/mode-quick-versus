import {
  type GamepadInputTracker,
  type GamepadInputTrackerOptions,
  createGamepadInputTracker,
} from "./gamepad-input.ts";
// Combines the keyboard and gamepad trackers into the single per-tick
// `[TickInput, TickInput]` pair `match-renderer.ts`'s tick loop threads
// into `engine`'s `tick()` call. Each player has exactly one active input
// source at a time -- their assigned gamepad if still connected, otherwise
// their keyboard bindings -- never merged (see
// `.vibe/decisions/005-input-routing-design.md`). `read()` is meant to be
// called once per rendered frame; its result is safe to reuse for every
// simulation tick run in that frame's fixed-timestep catch-up burst.
import { BUTTON_NAMES } from "./key-bindings.ts";
import {
  type KeyboardInputTracker,
  type KeyboardInputTrackerOptions,
  createKeyboardInputTracker,
} from "./keyboard-input.ts";
import { createNeutralInput } from "./types.ts";
import type { RawPlayerInput } from "./types.ts";

/** Which device is currently driving one player's input. */
export type InputSourceKind = "keyboard" | "gamepad";

export interface TickInputSourceOptions {
  /** Overrides the keyboard tracker entirely — for testing. Defaults to a real `createKeyboardInputTracker(keyboardOptions)`. */
  keyboardTracker?: KeyboardInputTracker;
  /** Forwarded to `createKeyboardInputTracker` when `keyboardTracker` is not overridden. */
  keyboardOptions?: KeyboardInputTrackerOptions;
  /** Overrides the gamepad tracker entirely — for testing. Defaults to a real `createGamepadInputTracker(gamepadOptions)`. */
  gamepadTracker?: GamepadInputTracker;
  /** Forwarded to `createGamepadInputTracker` when `gamepadTracker` is not overridden. */
  gamepadOptions?: GamepadInputTrackerOptions;
  /** Called whenever a player's active input source actually changes (keyboard ↔ gamepad) — the visible fallback/reconnect indicator the match scene surfaces to players. Never called on a read where nothing changed. */
  onSourceChange?: (playerIndex: 0 | 1, source: InputSourceKind) => void;
}

/** The subset of `engine`'s `TickInput` this project ever sends: every field always present (see `RawPlayerInput`), which is exactly what `TickInput`'s own optional fields accept. */
export type TickInputPair = [RawPlayerInput, RawPlayerInput];

export interface TickInputSource {
  /**
   * Reads this frame's input for both players. The same two objects are
   * mutated and returned on every call — never retained past the next
   * `read()`, and never allocated fresh, keeping the simulation tick loop
   * that reuses this result allocation-free.
   */
  read(): TickInputPair;
  /** Releases the underlying keyboard listeners (and the gamepad tracker, a no-op). Idempotent. */
  dispose(): void;
}

function copyInto(target: RawPlayerInput, source: RawPlayerInput): void {
  target.up = source.up;
  target.down = source.down;
  target.left = source.left;
  target.right = source.right;
  for (const name of BUTTON_NAMES) target.buttons[name] = source.buttons[name];
}

export function createTickInputSource(
  options: TickInputSourceOptions = {},
): TickInputSource {
  const keyboardTracker =
    options.keyboardTracker ??
    createKeyboardInputTracker(options.keyboardOptions);
  const gamepadTracker =
    options.gamepadTracker ?? createGamepadInputTracker(options.gamepadOptions);
  const onSourceChange = options.onSourceChange;

  // Pre-allocated once for the tracker's whole lifetime (typically one
  // match) and mutated in place on every read — see the module doc
  // comment's allocation-discipline rationale.
  const outputs: TickInputPair = [createNeutralInput(), createNeutralInput()];
  const activeSource: [InputSourceKind, InputSourceKind] = [
    "keyboard",
    "keyboard",
  ];

  function noteSource(playerIndex: 0 | 1, hasGamepad: boolean): void {
    const next: InputSourceKind = hasGamepad ? "gamepad" : "keyboard";
    if (activeSource[playerIndex] === next) return;
    activeSource[playerIndex] = next;
    onSourceChange?.(playerIndex, next);
  }

  function read(): TickInputPair {
    const [g1, g2] = gamepadTracker.poll();
    noteSource(0, g1 !== null);
    noteSource(1, g2 !== null);
    copyInto(outputs[0], g1 ?? keyboardTracker.read(0));
    copyInto(outputs[1], g2 ?? keyboardTracker.read(1));
    return outputs;
  }

  return {
    read,
    dispose() {
      keyboardTracker.dispose();
      gamepadTracker.dispose();
    },
  };
}
