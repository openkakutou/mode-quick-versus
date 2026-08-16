import { describe, expect, it, vi } from "vitest";
import type { CharacterResult } from "../wasm/types.ts";
import { discoverRoster } from "./discovery.ts";
import type { RosterManifestEntry } from "./manifest.ts";

function entry(id: string): RosterManifestEntry {
  return {
    id,
    portrait: `roster/${id}/portrait.png`,
    files: {
      def: `roster/${id}/character.def`,
      air: `roster/${id}/character.air`,
      sff: `roster/${id}/character.sff`,
      cns: `roster/${id}/character.cns`,
    },
  };
}

const emptyBytes = new Uint8Array();

describe("discoverRoster", () => {
  it("returns an ok entry with the character's name for a valid entry", async () => {
    const fetchBytes = vi.fn(async () => emptyBytes);
    const loadCharacter = vi.fn(
      async (): Promise<CharacterResult> => ({
        ok: true,
        character: { name: "Ryu" },
      }),
    );

    const result = await discoverRoster([entry("ryu")], {
      fetchBytes,
      loadCharacter,
    });

    expect(result).toEqual([
      {
        id: "ryu",
        portrait: "roster/ryu/portrait.png",
        status: "ok",
        name: "Ryu",
      },
    ]);
  });

  it("returns an error entry, not a rejection, when a character fails to load", async () => {
    const fetchBytes = vi.fn(async () => emptyBytes);
    const loadCharacter = vi.fn(
      async (): Promise<CharacterResult> => ({
        ok: false,
        error: "cns: line 3: malformed section header",
      }),
    );

    const result = await discoverRoster([entry("broken")], {
      fetchBytes,
      loadCharacter,
    });

    expect(result).toEqual([
      {
        id: "broken",
        portrait: "roster/broken/portrait.png",
        status: "error",
        message: "cns: line 3: malformed section header",
      },
    ]);
  });

  it("returns an error entry, not a rejection, when fetching a character's files fails", async () => {
    const fetchBytes = vi.fn(async () => {
      throw new Error("HTTP 404");
    });
    const loadCharacter = vi.fn(
      async (): Promise<CharacterResult> => ({
        ok: true,
        character: { name: "Never reached" },
      }),
    );

    const result = await discoverRoster([entry("missing")], {
      fetchBytes,
      loadCharacter,
    });

    expect(result).toEqual([
      {
        id: "missing",
        portrait: "roster/missing/portrait.png",
        status: "error",
        message: "could not fetch character files: HTTP 404",
      },
    ]);
    expect(loadCharacter).not.toHaveBeenCalled();
  });

  it("resolves an empty roster to an empty list", async () => {
    const fetchBytes = vi.fn(async () => emptyBytes);
    const loadCharacter = vi.fn(
      async (): Promise<CharacterResult> => ({
        ok: true,
        character: { name: "unused" },
      }),
    );

    const result = await discoverRoster([], { fetchBytes, loadCharacter });

    expect(result).toEqual([]);
    expect(fetchBytes).not.toHaveBeenCalled();
  });

  it("resolves one failing entry independently of a sibling entry that succeeds", async () => {
    const fetchBytes = vi.fn(async (filePath: string) => {
      if (filePath.includes("broken")) throw new Error("HTTP 500");
      return emptyBytes;
    });
    const loadCharacter = vi.fn(
      async (): Promise<CharacterResult> => ({
        ok: true,
        character: { name: "Kyo" },
      }),
    );

    const result = await discoverRoster([entry("kyo"), entry("broken")], {
      fetchBytes,
      loadCharacter,
    });

    expect(result).toEqual([
      {
        id: "kyo",
        portrait: "roster/kyo/portrait.png",
        status: "ok",
        name: "Kyo",
      },
      {
        id: "broken",
        portrait: "roster/broken/portrait.png",
        status: "error",
        message: "could not fetch character files: HTTP 500",
      },
    ]);
  });
});
