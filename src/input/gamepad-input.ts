// Polls the live Gamepad API state and assigns connected gamepads to the
// two local players by connection order — never both to the same player,
// never merged with keyboard input (see
// `.vibe/decisions/005-input-routing-design.md`). Poll once per rendered
// frame (never per simulation tick — browsers refresh `Gamepad` snapshots
// once per animation frame regardless, and `tick-input-source.ts` reuses
// one poll's result across a whole fixed-timestep catch-up burst).
import {
  BUTTON_NAMES,
  DEFAULT_GAMEPAD_BUTTON_INDEXES,
  GAMEPAD_DIRECTION_INDEXES,
} from "./key-bindings.ts";
import type { ButtonName } from "./key-bindings.ts";
import { createNeutralInput } from "./types.ts";
import type { RawPlayerInput } from "./types.ts";

export interface GamepadInputTrackerOptions {
  /** Defaults to `navigator.getGamepads`, feature-detected — never throws or assumes the API exists. */
  getGamepads?: () => (Gamepad | null)[] | null;
  /** Standard-mapping button index per button name. Defaults to `DEFAULT_GAMEPAD_BUTTON_INDEXES`. */
  buttonIndexes?: Record<ButtonName, number>;
  /** Called whenever a player's gamepad assignment changes (gains or loses a connected pad) — the discoverable connect/disconnect signal the setup/in-match UI surfaces to players. */
  onAssignmentChange?: (playerIndex: 0 | 1, connected: boolean) => void;
}

export interface GamepadInputTracker {
  /**
   * Polls the live gamepad state once and returns each player's input, or
   * `null` for a player with no gamepad currently assigned/connected (that
   * player should fall back to keyboard input instead — see
   * `tick-input-source.ts`).
   */
  poll(): [RawPlayerInput | null, RawPlayerInput | null];
  /** No-op (poll-based, no listeners to remove) — kept for interface symmetry with `keyboard-input.ts`'s tracker. */
  dispose(): void;
}

function defaultGetGamepads(): (Gamepad | null)[] {
  const fn = (navigator as Partial<Navigator>).getGamepads;
  if (typeof fn !== "function") return [];
  const result = fn.call(navigator);
  return result ? Array.from(result) : [];
}

function isConnected(pad: Gamepad | null | undefined): pad is Gamepad {
  return pad != null && pad.connected !== false;
}

function readPad(
  pad: Gamepad,
  buttonIndexes: Record<ButtonName, number>,
): RawPlayerInput {
  const input = createNeutralInput();
  const button = (index: number) => pad.buttons[index]?.pressed === true;
  input.up = button(GAMEPAD_DIRECTION_INDEXES.up);
  input.down = button(GAMEPAD_DIRECTION_INDEXES.down);
  input.left = button(GAMEPAD_DIRECTION_INDEXES.left);
  input.right = button(GAMEPAD_DIRECTION_INDEXES.right);
  for (const name of BUTTON_NAMES) {
    input.buttons[name] = button(buttonIndexes[name]);
  }
  return input;
}

export function createGamepadInputTracker(
  options: GamepadInputTrackerOptions = {},
): GamepadInputTracker {
  const getGamepads = options.getGamepads ?? defaultGetGamepads;
  const buttonIndexes = options.buttonIndexes ?? DEFAULT_GAMEPAD_BUTTON_INDEXES;
  const onAssignmentChange = options.onAssignmentChange;
  const assigned: [number | null, number | null] = [null, null];

  function safeGetGamepads(): (Gamepad | null)[] {
    try {
      return getGamepads() ?? [];
    } catch {
      // The Gamepad API (or an injected stand-in) can be absent or throw
      // in an unsupported environment -- every player simply reads as
      // "no gamepad", never a crash.
      return [];
    }
  }

  function poll(): [RawPlayerInput | null, RawPlayerInput | null] {
    const pads = safeGetGamepads();

    for (const playerIndex of [0, 1] as const) {
      const index = assigned[playerIndex];
      if (index !== null && !isConnected(pads[index])) {
        assigned[playerIndex] = null;
        onAssignmentChange?.(playerIndex, false);
      }
    }

    for (const playerIndex of [0, 1] as const) {
      if (assigned[playerIndex] !== null) continue;
      const freeIndex = pads.findIndex(
        (pad, index) =>
          isConnected(pad) && assigned[0] !== index && assigned[1] !== index,
      );
      if (freeIndex === -1) continue;
      assigned[playerIndex] = freeIndex;
      onAssignmentChange?.(playerIndex, true);
    }

    return [0, 1].map((playerIndex) => {
      const index = assigned[playerIndex as 0 | 1];
      if (index === null) return null;
      const pad = pads[index];
      return isConnected(pad) ? readPad(pad, buttonIndexes) : null;
    }) as [RawPlayerInput | null, RawPlayerInput | null];
  }

  return {
    poll,
    dispose() {
      // Intentionally empty -- see the interface doc comment above.
    },
  };
}
