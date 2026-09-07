import { describe, expect, it, vi } from "vitest";
import { createGamepadInputTracker } from "./gamepad-input.ts";

/** A minimal fake `Gamepad` — only the fields this tracker actually reads. */
function fakeGamepad(
  index: number,
  overrides: { connected?: boolean; pressedIndexes?: number[] } = {},
): Gamepad {
  const pressed = new Set(overrides.pressedIndexes ?? []);
  const buttons = Array.from({ length: 16 }, (_, i) => ({
    pressed: pressed.has(i),
    touched: pressed.has(i),
    value: pressed.has(i) ? 1 : 0,
  }));
  return {
    index,
    connected: overrides.connected ?? true,
    id: `fake-${index}`,
    mapping: "standard",
    axes: [0, 0],
    buttons,
    timestamp: 0,
    vibrationActuator: null,
  } as unknown as Gamepad;
}

describe("createGamepadInputTracker", () => {
  it("returns null for both players when no gamepad is connected", () => {
    const tracker = createGamepadInputTracker({ getGamepads: () => [] });

    const [p1, p2] = tracker.poll();

    expect(p1).toBeNull();
    expect(p2).toBeNull();
  });

  it("assigns the first connected gamepad to player 1 and reads its held d-pad direction and buttons", () => {
    const pad = fakeGamepad(0, { pressedIndexes: [15, 0] }); // right + button a
    const tracker = createGamepadInputTracker({ getGamepads: () => [pad] });

    const [p1, p2] = tracker.poll();

    expect(p1).not.toBeNull();
    expect(p1?.right).toBe(true);
    expect(p1?.left).toBe(false);
    expect(p1?.buttons.a).toBe(true);
    expect(p1?.buttons.b).toBe(false);
    expect(p2).toBeNull();
  });

  it("assigns a second connected gamepad to player 2, never both to player 1", () => {
    const padA = fakeGamepad(0);
    const padB = fakeGamepad(1, { pressedIndexes: [1] }); // button b
    const tracker = createGamepadInputTracker({
      getGamepads: () => [padA, padB],
    });

    const [p1, p2] = tracker.poll();

    expect(p1).not.toBeNull();
    expect(p2).not.toBeNull();
    expect(p2?.buttons.b).toBe(true);
  });

  it("falls that player back to null (never a stuck/latched button) once their assigned gamepad disconnects", () => {
    const pad = fakeGamepad(0, { pressedIndexes: [0] });
    let connected = true;
    const tracker = createGamepadInputTracker({
      getGamepads: () => [connected ? pad : null],
    });
    const [p1Before] = tracker.poll();
    expect(p1Before?.buttons.a).toBe(true);

    connected = false;
    const [p1After] = tracker.poll();

    expect(p1After).toBeNull();
  });

  it("notifies a supplied callback when a player's gamepad assignment changes", () => {
    const pad = fakeGamepad(0);
    let connected = true;
    const onAssignmentChange = vi.fn();
    const tracker = createGamepadInputTracker({
      getGamepads: () => [connected ? pad : null],
      onAssignmentChange,
    });

    tracker.poll();
    expect(onAssignmentChange).toHaveBeenCalledWith(0, true);

    onAssignmentChange.mockClear();
    connected = false;
    tracker.poll();
    expect(onAssignmentChange).toHaveBeenCalledWith(0, false);
  });

  it("never throws when the Gamepad API is unavailable (getGamepads missing/undefined)", () => {
    const tracker = createGamepadInputTracker({
      getGamepads: () => {
        throw new Error("Gamepad API not supported");
      },
    });

    expect(() => tracker.poll()).not.toThrow();
    const [p1, p2] = tracker.poll();
    expect(p1).toBeNull();
    expect(p2).toBeNull();
  });
});
