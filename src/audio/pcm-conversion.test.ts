import { describe, expect, it } from "vitest";
import { buildPlanarChannels } from "./pcm-conversion.ts";

describe("buildPlanarChannels", () => {
  it("normalizes a mono int16 PCM array to a single channel of floats in [-1, 1]", () => {
    const [channel] = buildPlanarChannels([0, 32767, -32768], 1);

    expect(channel).toHaveLength(3);
    expect(channel[0]).toBeCloseTo(0, 5);
    expect(channel[1]).toBeCloseTo(32767 / 32768, 5);
    expect(channel[2]).toBeCloseTo(-1, 5);
  });

  it("deinterleaves a stereo PCM array into separate left/right channels, in order", () => {
    // Interleaved L0, R0, L1, R1.
    const [left, right] = buildPlanarChannels([100, -100, 200, -200], 2);

    expect(Array.from(left)).toEqual([100 / 32768, 200 / 32768]);
    expect(Array.from(right)).toEqual([-100 / 32768, -200 / 32768]);
  });

  it("clamps an out-of-range sample instead of overflowing past [-1, 1]", () => {
    const [channel] = buildPlanarChannels([40000, -40000], 1);

    expect(channel[0]).toBe(1);
    expect(channel[1]).toBe(-1);
  });

  it("returns one empty channel per requested channel count for an empty PCM array, rather than throwing", () => {
    const channels = buildPlanarChannels([], 2);

    expect(channels).toHaveLength(2);
    expect(channels[0]).toHaveLength(0);
    expect(channels[1]).toHaveLength(0);
  });

  it("degrades a non-positive channel count to mono instead of dividing by zero or crashing", () => {
    const channels = buildPlanarChannels([0, 16384], 0);

    expect(channels).toHaveLength(1);
    expect(channels[0]).toHaveLength(2);
  });
});
