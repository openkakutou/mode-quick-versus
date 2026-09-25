import { describe, expect, it, vi } from "vitest";
import type {
  TickInputPair,
  TickInputSource,
} from "../input/tick-input-source.ts";
import { createNeutralInput } from "../input/types.ts";
import type { CpuController, CpuObservation } from "./cpu-controller.ts";
import { createCpuAwareInputSource } from "./cpu-input-source.ts";

function fakeBaseSource(pair: TickInputPair): TickInputSource {
  return {
    read: vi.fn(() => pair),
    dispose: vi.fn(),
  };
}

function fakeController(
  decide: CpuController["decide"] = vi.fn(),
): CpuController {
  return { decide };
}

describe("createCpuAwareInputSource", () => {
  it("keeps player 1's input exactly as the base source produced it", () => {
    const pair: TickInputPair = [
      { ...createNeutralInput(), up: true },
      createNeutralInput(),
    ];
    const source = createCpuAwareInputSource({
      baseSource: fakeBaseSource(pair),
      getObservation: () => null,
    });

    const [p1] = source.read();

    expect(p1.up).toBe(true);
  });

  it("overwrites player 2's input using the CPU controller's decision when an observation is available", () => {
    const pair: TickInputPair = [createNeutralInput(), createNeutralInput()];
    const observation: CpuObservation = {
      self: { position: { x: 0, y: 0 } },
      opponent: { position: { x: 0, y: 0 } },
    };
    const decide = vi.fn((_obs: CpuObservation, target) => {
      target.right = true;
    });
    const source = createCpuAwareInputSource({
      baseSource: fakeBaseSource(pair),
      getObservation: () => observation,
      controller: fakeController(decide),
    });

    const [, p2] = source.read();

    expect(decide).toHaveBeenCalledWith(observation, pair[1]);
    expect(p2.right).toBe(true);
  });

  it("returns the exact same pair reference the base source produced (no fresh allocation)", () => {
    const pair: TickInputPair = [createNeutralInput(), createNeutralInput()];
    const source = createCpuAwareInputSource({
      baseSource: fakeBaseSource(pair),
      getObservation: () => null,
    });

    const result = source.read();

    expect(result).toBe(pair);
  });

  it("falls player 2 back to neutral input when no observation is available yet (e.g. before the match has ticked once), never asking the controller to decide", () => {
    const pair: TickInputPair = [
      createNeutralInput(),
      {
        ...createNeutralInput(),
        right: true,
        buttons: { ...createNeutralInput().buttons, a: true },
      },
    ];
    const decide = vi.fn((_obs: CpuObservation, target) => {
      target.right = true; // would fail the test below if ever called
    });
    const source = createCpuAwareInputSource({
      baseSource: fakeBaseSource(pair),
      getObservation: () => null,
      controller: fakeController(decide),
    });

    const [, p2] = source.read();

    expect(decide).not.toHaveBeenCalled();
    expect(p2).toEqual(createNeutralInput());
  });

  it("disposes the underlying base source", () => {
    const pair: TickInputPair = [createNeutralInput(), createNeutralInput()];
    const base = fakeBaseSource(pair);
    const source = createCpuAwareInputSource({
      baseSource: base,
      getObservation: () => null,
    });

    source.dispose();

    expect(base.dispose).toHaveBeenCalled();
  });

  it("re-decides fresh on every read (no stale decision carried over from a previous read)", () => {
    const pair: TickInputPair = [createNeutralInput(), createNeutralInput()];
    let call = 0;
    const source = createCpuAwareInputSource({
      baseSource: fakeBaseSource(pair),
      getObservation: () => ({
        self: { position: { x: 0, y: 0 } },
        opponent: { position: { x: 0, y: 0 } },
      }),
      controller: fakeController((_obs, target) => {
        call += 1;
        target.right = call === 1;
      }),
    });

    const [, first] = source.read();
    expect(first.right).toBe(true);
    const [, second] = source.read();
    expect(second.right).toBe(false);
  });
});
