// Tracks live keyboard held-key state for both local players, driven by
// `window`-level `keydown`/`keyup` listeners (never a per-tick DOM poll —
// see `.vibe/decisions/005-input-routing-design.md`). A `RawPlayerInput`
// object is allocated once per player at creation and mutated in place on
// every event, so reading it on the 60Hz tick hot path allocates nothing.
import { BUTTON_NAMES, DEFAULT_KEYBOARD_BINDINGS } from "./key-bindings.ts";
import type { ButtonName, KeyboardPlayerBindings } from "./key-bindings.ts";
import { createNeutralInput } from "./types.ts";
import type { RawPlayerInput } from "./types.ts";

type DirectionField = "up" | "down" | "left" | "right";

/** Where one physical key routes: a direction or a button, on one player's `RawPlayerInput`. */
type KeyTarget =
  | { playerIndex: 0 | 1; direction: DirectionField }
  | { playerIndex: 0 | 1; button: ButtonName };

/** A `window`-shaped event target — narrowed for injectability in tests, real default is `window` itself. */
export interface KeyboardEventTarget {
  addEventListener(type: string, listener: (event: Event) => void): void;
  removeEventListener(type: string, listener: (event: Event) => void): void;
}

export interface KeyboardInputTrackerOptions {
  /** Defaults to `DEFAULT_KEYBOARD_BINDINGS`. */
  bindings?: readonly [KeyboardPlayerBindings, KeyboardPlayerBindings];
  /** Defaults to the real `window`. */
  target?: KeyboardEventTarget;
}

export interface KeyboardInputTracker {
  /** This player's currently held directions/buttons — a live reference owned by the tracker, mutated on the next key event; never mutate it, and copy it if the caller needs to retain a stable snapshot past that. */
  read(playerIndex: 0 | 1): RawPlayerInput;
  /** Removes every registered listener. Idempotent. */
  dispose(): void;
}

function buildKeyMap(
  bindings: readonly [KeyboardPlayerBindings, KeyboardPlayerBindings],
): Map<string, KeyTarget[]> {
  const map = new Map<string, KeyTarget[]>();
  function addCode(code: string, target: KeyTarget): void {
    const existing = map.get(code);
    if (existing) existing.push(target);
    else map.set(code, [target]);
  }

  bindings.forEach((binding, index) => {
    const playerIndex = index as 0 | 1;
    addCode(binding.up, { playerIndex, direction: "up" });
    addCode(binding.down, { playerIndex, direction: "down" });
    addCode(binding.left, { playerIndex, direction: "left" });
    addCode(binding.right, { playerIndex, direction: "right" });
    for (const name of BUTTON_NAMES) {
      addCode(binding.buttons[name], { playerIndex, button: name });
    }
  });

  return map;
}

/**
 * Creates a tracker that reads both players' held keyboard state, updated
 * live from real `keydown`/`keyup` events. Only keys actually bound to a
 * player are `preventDefault()`-ed (arrow-key page scroll, for instance,
 * is suppressed only while an assigned key is held) — every other key on
 * the page keeps its normal browser behavior. Losing window focus (e.g.
 * alt-tab) clears every held key for both players, since a `keyup` for an
 * already-held key is not guaranteed to fire once focus returns, and a key
 * silently stuck "held" would freeze that player's movement.
 */
export function createKeyboardInputTracker(
  options: KeyboardInputTrackerOptions = {},
): KeyboardInputTracker {
  const bindings = options.bindings ?? DEFAULT_KEYBOARD_BINDINGS;
  const target: KeyboardEventTarget = options.target ?? window;
  const keyMap = buildKeyMap(bindings);
  const states: [RawPlayerInput, RawPlayerInput] = [
    createNeutralInput(),
    createNeutralInput(),
  ];

  function setPressed(code: string, pressed: boolean): boolean {
    const targets = keyMap.get(code);
    if (!targets) return false;
    for (const t of targets) {
      const state = states[t.playerIndex];
      if ("direction" in t) state[t.direction] = pressed;
      else state.buttons[t.button] = pressed;
    }
    return true;
  }

  function onKeyDown(event: Event): void {
    const code = (event as KeyboardEvent).code;
    if (setPressed(code, true)) event.preventDefault();
  }

  function onKeyUp(event: Event): void {
    const code = (event as KeyboardEvent).code;
    if (setPressed(code, false)) event.preventDefault();
  }

  function onBlur(): void {
    for (const state of states) {
      state.up = false;
      state.down = false;
      state.left = false;
      state.right = false;
      for (const name of BUTTON_NAMES) state.buttons[name] = false;
    }
  }

  target.addEventListener("keydown", onKeyDown);
  target.addEventListener("keyup", onKeyUp);
  target.addEventListener("blur", onBlur);

  return {
    read(playerIndex) {
      return states[playerIndex];
    },
    dispose() {
      target.removeEventListener("keydown", onKeyDown);
      target.removeEventListener("keyup", onKeyUp);
      target.removeEventListener("blur", onBlur);
    },
  };
}
