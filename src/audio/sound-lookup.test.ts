import { describe, expect, it } from "vitest";
import type { CharacterSummary, Sound } from "../wasm/types.ts";
import { buildSoundLookup, findSound } from "./sound-lookup.ts";

function character(sounds: CharacterSummary["sounds"]): CharacterSummary {
  return {
    name: "Fighter",
    animations: [],
    sprites: [],
    stateDefs: [],
    sounds,
  };
}

function sound(overrides: Partial<Sound> = {}): Sound {
  return {
    group: 1,
    sample: 0,
    sampleRate: 11025,
    channels: 1,
    bitsPerSample: 16,
    pcm: [0, 0],
    ...overrides,
  };
}

describe("buildSoundLookup / findSound", () => {
  it("finds a decoded sound by its exact (group, sample) pair", () => {
    const hitSound = sound({ group: 1, sample: 0 });
    const lookup = buildSoundLookup(
      character([{ index: 1, sounds: [hitSound] }]),
    );

    expect(findSound(lookup, { group: 1, sample: 0 })).toBe(hitSound);
  });

  it("returns undefined for a sample index absent from an otherwise-known group", () => {
    const lookup = buildSoundLookup(
      character([{ index: 1, sounds: [sound({ group: 1, sample: 0 })] }]),
    );

    expect(findSound(lookup, { group: 1, sample: 99 })).toBeUndefined();
  });

  it("returns undefined for a group the character has no sounds for at all", () => {
    const lookup = buildSoundLookup(
      character([{ index: 1, sounds: [sound({ group: 1, sample: 0 })] }]),
    );

    expect(findSound(lookup, { group: 9, sample: 0 })).toBeUndefined();
  });

  it("returns undefined for every lookup when the character has no sound file at all (empty sounds)", () => {
    const lookup = buildSoundLookup(character([]));

    expect(findSound(lookup, { group: 0, sample: 0 })).toBeUndefined();
  });

  it("distinguishes two sounds in different groups sharing the same sample number", () => {
    const groupOneSample0 = sound({ group: 1, sample: 0 });
    const groupTwoSample0 = sound({ group: 2, sample: 0 });
    const lookup = buildSoundLookup(
      character([
        { index: 1, sounds: [groupOneSample0] },
        { index: 2, sounds: [groupTwoSample0] },
      ]),
    );

    expect(findSound(lookup, { group: 1, sample: 0 })).toBe(groupOneSample0);
    expect(findSound(lookup, { group: 2, sample: 0 })).toBe(groupTwoSample0);
  });
});
