// Default keyboard and gamepad button/direction bindings for the two local
// players (backlog item 006). Keys are `KeyboardEvent.code` values (the
// physical key, not the layout-shifted character) so the mapping stays
// stable regardless of the player's keyboard layout — no per-layout
// remapping exists anywhere in this project yet (see roadmap backlog
// `009`, still `todo`). Button names follow the MUGEN/Ikemen-GO six-button
// convention (`a b c x y z`), the same convention a real `.cmd` file's
// command strings are authored against — see
// `.vibe/decisions/005-input-routing-design.md` for why this project picks
// that convention rather than inventing its own.

/** A MUGEN/Ikemen-GO-style button name, matching the lowercase tokens a real `.cmd` file's `[Command]`/`[Remap]` sections use. */
export type ButtonName = "a" | "b" | "c" | "x" | "y" | "z";

/** Every recognized button name, in a fixed, stable order (used both for iteration and as this project's own canonical button ordering — see `DEFAULT_GAMEPAD_BUTTON_INDEXES`). */
export const BUTTON_NAMES: readonly ButtonName[] = [
  "a",
  "b",
  "c",
  "x",
  "y",
  "z",
];

/** One player's keyboard bindings: a `KeyboardEvent.code` per direction and per button name. */
export interface KeyboardPlayerBindings {
  up: string;
  down: string;
  left: string;
  right: string;
  buttons: Record<ButtonName, string>;
}

/**
 * Default keyboard bindings for both players, sharing one keyboard: Player
 * 1 on a left-hand `WASD` + adjacent-row button block, Player 2 on the
 * arrow-key cluster + its own adjacent letter block — two spatially
 * separate regions of the keyboard so neither player's hands overlap the
 * other's, and no physical key is ever bound to both players at once (see
 * `key-bindings.test.ts`'s own no-overlap assertion).
 */
export const DEFAULT_KEYBOARD_BINDINGS: readonly [
  KeyboardPlayerBindings,
  KeyboardPlayerBindings,
] = [
  {
    up: "KeyW",
    down: "KeyS",
    left: "KeyA",
    right: "KeyD",
    buttons: {
      a: "KeyF",
      b: "KeyG",
      c: "KeyH",
      x: "KeyR",
      y: "KeyT",
      z: "KeyY",
    },
  },
  {
    up: "ArrowUp",
    down: "ArrowDown",
    left: "ArrowLeft",
    right: "ArrowRight",
    buttons: {
      a: "KeyJ",
      b: "KeyK",
      c: "KeyL",
      x: "KeyI",
      y: "KeyO",
      z: "KeyP",
    },
  },
];

/**
 * The standard Gamepad API (`gamepad.mapping === "standard"`) button index
 * each button name reads from: the four face buttons (0-3) plus the two
 * front shoulder buttons (4-5), in `BUTTON_NAMES` order. Physical face
 * labels (A/B/X/Y, ×/○/□/△, …) vary by controller brand — this project
 * deliberately never claims a specific label, only a button index, and
 * shows that same index-based description to players (see
 * `setup/setup-screen.ts`'s Controls section).
 */
export const DEFAULT_GAMEPAD_BUTTON_INDEXES: Record<ButtonName, number> = {
  a: 0,
  b: 1,
  c: 2,
  x: 3,
  y: 4,
  z: 5,
};

/** The standard Gamepad API d-pad button index for each direction. */
export const GAMEPAD_DIRECTION_INDEXES = {
  up: 12,
  down: 13,
  left: 14,
  right: 15,
} as const;

/**
 * A short, player-facing label for a `KeyboardEvent.code` value, used by
 * the setup screen's Controls section: `"KeyW"` → `"W"`,
 * `"ArrowUp"` → `"Arrow Up"`. A code with no recognized prefix (e.g.
 * `"Space"`) is shown unchanged.
 */
export function keyLabel(code: string): string {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Arrow")) return `Arrow ${code.slice(5)}`;
  return code;
}
