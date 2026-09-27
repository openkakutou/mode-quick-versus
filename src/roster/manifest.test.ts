import { describe, expect, it } from "vitest";
import { fetchRosterManifest } from "./manifest.ts";

function entry(id: string) {
  return {
    id,
    portrait: `roster/${id}/portrait.png`,
    files: {
      def: `roster/${id}/character.def`,
      air: `roster/${id}/character.air`,
      sff: `roster/${id}/character.sff`,
      cns: `roster/${id}/character.cns`,
      cmd: `roster/${id}/character.cmd`,
    },
  };
}

describe("fetchRosterManifest", () => {
  it("parses a manifest listing one or more valid entries", async () => {
    const source = JSON.stringify([entry("ryu"), entry("kyo")]);

    const result = await fetchRosterManifest({
      fetchManifestSource: async () => source,
    });

    expect(result).toEqual({
      ok: true,
      entries: [entry("ryu"), entry("kyo")],
    });
  });

  it("accepts an entry that declares an optional .snd sound file path (backlog item 013)", async () => {
    const withSound = {
      ...entry("ryu"),
      files: { ...entry("ryu").files, snd: "roster/ryu/character.snd" },
    };
    const source = JSON.stringify([withSound]);

    const result = await fetchRosterManifest({
      fetchManifestSource: async () => source,
    });

    expect(result).toEqual({ ok: true, entries: [withSound] });
  });

  it("accepts an entry with no .snd file path -- a character with no sound file is valid", async () => {
    const source = JSON.stringify([entry("ryu")]);

    const result = await fetchRosterManifest({
      fetchManifestSource: async () => source,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected an ok result");
    expect(result.entries[0].files.snd).toBeUndefined();
  });

  it("treats an empty array as a valid, empty roster", async () => {
    const result = await fetchRosterManifest({
      fetchManifestSource: async () => "[]",
    });

    expect(result).toEqual({ ok: true, entries: [] });
  });

  it("returns a typed error instead of throwing when the manifest is not valid JSON", async () => {
    const result = await fetchRosterManifest({
      fetchManifestSource: async () => "{ not json",
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected an error result");
    expect(result.error).toContain("not valid JSON");
  });

  it("returns a typed error instead of throwing when an entry's .snd path is not a string", async () => {
    const invalid = {
      ...entry("ryu"),
      files: { ...entry("ryu").files, snd: 42 },
    };
    const source = JSON.stringify([invalid]);

    const result = await fetchRosterManifest({
      fetchManifestSource: async () => source,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected an error result");
    expect(result.error).toContain("index 0");
  });

  it("returns a typed error instead of throwing when an entry is missing required fields", async () => {
    const source = JSON.stringify([{ id: "ryu" }]);

    const result = await fetchRosterManifest({
      fetchManifestSource: async () => source,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected an error result");
    expect(result.error).toContain("index 0");
  });

  it("returns a typed error instead of throwing when the manifest is not an array", async () => {
    const result = await fetchRosterManifest({
      fetchManifestSource: async () => JSON.stringify({ not: "an array" }),
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected an error result");
    expect(result.error).toContain("must be a JSON array");
  });

  it("returns a typed error instead of throwing when fetching the manifest fails", async () => {
    const result = await fetchRosterManifest({
      fetchManifestSource: async () => {
        throw new Error("network down");
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected an error result");
    expect(result.error).toContain("network down");
  });
});
