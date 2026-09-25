import { describe, expect, it } from "vitest";
import { createNeutralInput } from "../input/types.ts";
import { type CpuObservation, createCpuController } from "./cpu-controller.ts";

function observation(selfX: number, opponentX: number): CpuObservation {
  return {
    self: { position: { x: selfX, y: 0 } },
    opponent: { position: { x: opponentX, y: 0 } },
  };
}

describe("createCpuController", () => {
  it("walks right toward an opponent far to the right", () => {
    const controller = createCpuController();
    const target = createNeutralInput();

    controller.decide(observation(0, 200), target);

    expect(target.right).toBe(true);
    expect(target.left).toBe(false);
    expect(target.buttons.a).toBe(false);
  });

  it("walks left toward an opponent far to the left", () => {
    const controller = createCpuController();
    const target = createNeutralInput();

    controller.decide(observation(200, 0), target);

    expect(target.left).toBe(true);
    expect(target.right).toBe(false);
  });

  it("attempts an attack instead of walking once within attack range, when the random roll favors it", () => {
    const controller = createCpuController(() => 0); // always below ATTACK_CHANCE
    const target = createNeutralInput();

    controller.decide(observation(0, 10), target);

    expect(target.buttons.a).toBe(true);
    expect(target.left).toBe(false);
    expect(target.right).toBe(false);
  });

  it("stays neutral in attack range when the random roll does not favor an attack", () => {
    const controller = createCpuController(() => 0.99); // always above ATTACK_CHANCE
    const target = createNeutralInput();

    controller.decide(observation(0, 10), target);

    expect(target.buttons.a).toBe(false);
    expect(target.left).toBe(false);
    expect(target.right).toBe(false);
  });

  it("stays neutral (no movement, no attack) at the exact same position as the opponent", () => {
    const controller = createCpuController(() => 0.99);
    const target = createNeutralInput();

    controller.decide(observation(50, 50), target);

    expect(target.left).toBe(false);
    expect(target.right).toBe(false);
  });

  it("mutates the same target object in place rather than allocating a fresh one", () => {
    const controller = createCpuController();
    const target = createNeutralInput();

    controller.decide(observation(0, 200), target);

    expect(target.right).toBe(true); // same reference, now mutated
  });

  it("degrades to a fully neutral input, never throwing, on a malformed observation", () => {
    const controller = createCpuController();
    const target = createNeutralInput();
    target.right = true; // pre-dirty the target to prove it gets cleared

    const malformed = {
      self: { position: { x: Number.NaN, y: 0 } },
      opponent: { position: { x: 10, y: 0 } },
    };

    expect(() => controller.decide(malformed, target)).not.toThrow();
    expect(target).toEqual(createNeutralInput());
  });
});
