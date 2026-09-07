import { afterEach, describe, expect, it } from "vitest";
import { createKeyboardInputTracker } from "./keyboard-input.ts";
import type { KeyboardInputTracker } from "./keyboard-input.ts";

const testBindings = [
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
] as const;

let tracker: KeyboardInputTracker | undefined;

afterEach(() => {
  tracker?.dispose();
  tracker = undefined;
});

function press(code: string): void {
  window.dispatchEvent(new KeyboardEvent("keydown", { code }));
}
function release(code: string): void {
  window.dispatchEvent(new KeyboardEvent("keyup", { code }));
}

describe("createKeyboardInputTracker", () => {
  it("reports a direction held after its bound key is pressed, for the correct player only", () => {
    tracker = createKeyboardInputTracker({ bindings: testBindings });

    press("KeyD");

    expect(tracker.read(0).right).toBe(true);
    expect(tracker.read(1).right).toBe(false);
  });

  it("reports a button released after its bound key is pressed then released", () => {
    tracker = createKeyboardInputTracker({ bindings: testBindings });

    press("KeyF");
    expect(tracker.read(0).buttons.a).toBe(true);

    release("KeyF");
    expect(tracker.read(0).buttons.a).toBe(false);
  });

  it("holds both opposing directions true when both keys are pressed at once, never silently dropping one", () => {
    tracker = createKeyboardInputTracker({ bindings: testBindings });

    press("KeyA");
    press("KeyD");

    expect(tracker.read(0).left).toBe(true);
    expect(tracker.read(0).right).toBe(true);
  });

  it("ignores a key that isn't bound to either player", () => {
    tracker = createKeyboardInputTracker({ bindings: testBindings });

    press("Space");

    expect(tracker.read(0)).toEqual({
      up: false,
      down: false,
      left: false,
      right: false,
      buttons: { a: false, b: false, c: false, x: false, y: false, z: false },
    });
  });

  it("clears every held key for both players when the window loses focus", () => {
    tracker = createKeyboardInputTracker({ bindings: testBindings });
    press("KeyW");
    press("ArrowLeft");

    window.dispatchEvent(new Event("blur"));

    expect(tracker.read(0).up).toBe(false);
    expect(tracker.read(1).left).toBe(false);
  });

  it("stops reacting to key events once disposed", () => {
    tracker = createKeyboardInputTracker({ bindings: testBindings });
    tracker.dispose();

    press("KeyW");

    expect(tracker.read(0).up).toBe(false);
  });
});
