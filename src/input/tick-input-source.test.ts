import { describe, expect, it, vi } from "vitest";
import { createTickInputSource } from "./tick-input-source.ts";
import { createNeutralInput } from "./types.ts";
import type { RawPlayerInput } from "./types.ts";

function neutral(overrides: Partial<RawPlayerInput> = {}): RawPlayerInput {
  return { ...createNeutralInput(), ...overrides };
}

function fakeKeyboardTracker(states: [RawPlayerInput, RawPlayerInput]) {
  return {
    read: vi.fn((playerIndex: 0 | 1) => states[playerIndex]),
    dispose: vi.fn(),
  };
}

function fakeGamepadTracker(
  results: [RawPlayerInput | null, RawPlayerInput | null][],
) {
  let call = 0;
  return {
    poll: vi.fn(() => results[Math.min(call++, results.length - 1)]),
    dispose: vi.fn(),
  };
}

describe("createTickInputSource", () => {
  it("uses keyboard input for a player with no assigned gamepad", () => {
    const keyboardTracker = fakeKeyboardTracker([
      neutral({ up: true }),
      neutral(),
    ]);
    const gamepadTracker = fakeGamepadTracker([[null, null]]);
    const source = createTickInputSource({ keyboardTracker, gamepadTracker });

    const [p1, p2] = source.read();

    expect(p1.up).toBe(true);
    expect(p2).toEqual(neutral());
  });

  it("uses gamepad input over keyboard for a player with a connected, assigned gamepad", () => {
    const keyboardTracker = fakeKeyboardTracker([neutral(), neutral()]);
    const gamepadTracker = fakeGamepadTracker([
      [neutral({ buttons: { ...neutral().buttons, a: true } }), null],
    ]);
    const source = createTickInputSource({ keyboardTracker, gamepadTracker });

    const [p1] = source.read();

    expect(p1.buttons?.a).toBe(true);
  });

  it("falls a player back to keyboard on the very next read once their gamepad reports disconnected", () => {
    const keyboardTracker = fakeKeyboardTracker([
      neutral({ left: true }),
      neutral(),
    ]);
    const gamepadTracker = fakeGamepadTracker([
      [neutral({ right: true }), null], // connected this read
      [null, null], // disconnected next read
    ]);
    const source = createTickInputSource({ keyboardTracker, gamepadTracker });

    const [firstRead] = source.read();
    expect(firstRead.right).toBe(true);

    const [secondRead] = source.read();
    expect(secondRead.right).toBeFalsy();
    expect(secondRead.left).toBe(true);
  });

  it("returns every one of a burst of reads with the held state consistent, for a fixed-timestep multi-tick frame", () => {
    const keyboardTracker = fakeKeyboardTracker([
      neutral({ up: true }),
      neutral(),
    ]);
    const gamepadTracker = fakeGamepadTracker([[null, null]]);
    const source = createTickInputSource({ keyboardTracker, gamepadTracker });

    const reads = Array.from({ length: 5 }, () => source.read());

    for (const [p1] of reads) {
      expect(p1.up).toBe(true);
    }
  });

  it("notifies onSourceChange exactly once when a player's active source actually changes, not on every read", () => {
    const keyboardTracker = fakeKeyboardTracker([neutral(), neutral()]);
    const gamepadTracker = fakeGamepadTracker([
      [neutral(), null],
      [neutral(), null],
      [null, null],
    ]);
    const onSourceChange = vi.fn();
    const source = createTickInputSource({
      keyboardTracker,
      gamepadTracker,
      onSourceChange,
    });

    source.read(); // keyboard -> gamepad for player 0
    source.read(); // still gamepad, no change
    source.read(); // gamepad -> keyboard for player 0

    expect(onSourceChange).toHaveBeenCalledTimes(2);
    expect(onSourceChange).toHaveBeenNthCalledWith(1, 0, "gamepad");
    expect(onSourceChange).toHaveBeenNthCalledWith(2, 0, "keyboard");
  });

  it("disposes both underlying trackers", () => {
    const keyboardTracker = fakeKeyboardTracker([neutral(), neutral()]);
    const gamepadTracker = fakeGamepadTracker([[null, null]]);
    const source = createTickInputSource({ keyboardTracker, gamepadTracker });

    source.dispose();

    expect(keyboardTracker.dispose).toHaveBeenCalled();
    expect(gamepadTracker.dispose).toHaveBeenCalled();
  });
});
