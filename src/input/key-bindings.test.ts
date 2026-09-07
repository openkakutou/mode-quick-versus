import { describe, expect, it } from "vitest";
import {
  BUTTON_NAMES,
  DEFAULT_GAMEPAD_BUTTON_INDEXES,
  DEFAULT_KEYBOARD_BINDINGS,
  keyLabel,
} from "./key-bindings.ts";

function allKeysFor(playerIndex: 0 | 1): string[] {
  const binding = DEFAULT_KEYBOARD_BINDINGS[playerIndex];
  return [
    binding.up,
    binding.down,
    binding.left,
    binding.right,
    ...BUTTON_NAMES.map((name) => binding.buttons[name]),
  ];
}

describe("DEFAULT_KEYBOARD_BINDINGS", () => {
  it("gives each player all four directions and all six button names bound to a distinct physical key", () => {
    for (const playerIndex of [0, 1] as const) {
      const keys = allKeysFor(playerIndex);
      expect(keys).toHaveLength(10);
      expect(new Set(keys).size).toBe(10);
    }
  });

  it("never assigns the same physical key to both players, since they share one keyboard", () => {
    const p1Keys = new Set(allKeysFor(0));
    const p2Keys = allKeysFor(1);

    const overlap = p2Keys.filter((key) => p1Keys.has(key));

    expect(overlap).toEqual([]);
  });

  it("binds every one of the six MUGEN/Ikemen-GO button names for both players", () => {
    for (const playerIndex of [0, 1] as const) {
      const binding = DEFAULT_KEYBOARD_BINDINGS[playerIndex];
      for (const name of BUTTON_NAMES) {
        expect(typeof binding.buttons[name]).toBe("string");
        expect(binding.buttons[name].length).toBeGreaterThan(0);
      }
    }
  });
});

describe("DEFAULT_GAMEPAD_BUTTON_INDEXES", () => {
  it("assigns each of the six button names a distinct standard-mapping button index", () => {
    const indexes = BUTTON_NAMES.map(
      (name) => DEFAULT_GAMEPAD_BUTTON_INDEXES[name],
    );

    expect(new Set(indexes).size).toBe(6);
    for (const index of indexes) {
      expect(Number.isInteger(index)).toBe(true);
      expect(index).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("keyLabel", () => {
  it("strips the KeyboardEvent.code 'Key' prefix for a letter key", () => {
    expect(keyLabel("KeyW")).toBe("W");
  });

  it("renders an arrow code as 'Arrow <Direction>'", () => {
    expect(keyLabel("ArrowUp")).toBe("Arrow Up");
  });

  it("returns a code with no known prefix unchanged", () => {
    expect(keyLabel("Space")).toBe("Space");
  });
});
