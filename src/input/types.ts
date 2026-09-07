import type { ButtonName } from "./key-bindings.ts";

/**
 * One player's raw directional/button input as of a single read — the
 * shared shape `keyboard-input.ts`, `gamepad-input.ts`, and
 * `tick-input-source.ts` all produce/consume. Structurally identical to
 * `engine`'s own `TickInput` (see `wasm/engine-types.ts`) but every field
 * is always present (never optional), since an internal reader always
 * knows the true current state — only the outermost boundary
 * (`tick-input-source.ts`'s `read()`) narrows it down to the WASM bridge's
 * own looser `TickInput` shape.
 */
export interface RawPlayerInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  // A plain `Record<ButtonName, boolean>` (a closed, named-keys object type)
  // is not directly assignable to `TickInput.buttons`'s own
  // `Record<string, boolean>` (an open index signature) without this
  // explicit `[key: string]: boolean` alongside it -- TypeScript never
  // infers an index signature from a fixed set of named properties, even
  // when every one of them is a `string`.
  buttons: Record<ButtonName, boolean> & { [key: string]: boolean };
}

/** A fresh, all-neutral (nothing held) `RawPlayerInput`. */
export function createNeutralInput(): RawPlayerInput {
  return {
    up: false,
    down: false,
    left: false,
    right: false,
    buttons: { a: false, b: false, c: false, x: false, y: false, z: false },
  };
}
