import { describe, expect, it } from "vitest";
import { fetchStageManifest } from "./manifest.ts";

describe("fetchStageManifest", () => {
  it("fetches and parses a valid manifest", async () => {
    const entries = [
      {
        id: "training-room",
        files: { def: "stages/training-room.def" },
        portrait: "stages/training-room.png",
      },
    ];
    const fetchManifestSource = async () => JSON.stringify(entries);

    const result = await fetchStageManifest({ fetchManifestSource });

    expect(result).toEqual({ ok: true, entries });
  });

  it("accepts an empty manifest as valid (unconfigured deployment)", async () => {
    const fetchManifestSource = async () => "[]";

    const result = await fetchStageManifest({ fetchManifestSource });

    expect(result).toEqual({ ok: true, entries: [] });
  });

  it("returns a typed error when the fetch itself fails", async () => {
    const fetchManifestSource = async () => {
      throw new Error("network down");
    };

    const result = await fetchStageManifest({ fetchManifestSource });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected an error result");
    expect(result.error).toContain("network down");
  });

  it("returns a typed error when the manifest is not valid JSON", async () => {
    const fetchManifestSource = async () => "{not json";

    const result = await fetchStageManifest({ fetchManifestSource });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected an error result");
    expect(result.error).toContain("not valid JSON");
  });

  it("returns a typed error when an entry is missing a required field", async () => {
    const fetchManifestSource = async () =>
      JSON.stringify([{ id: "training-room", portrait: "x.png" }]);

    const result = await fetchStageManifest({ fetchManifestSource });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected an error result");
    expect(result.error).toContain("index 0");
  });

  it("returns a typed error when the manifest is not a JSON array", async () => {
    const fetchManifestSource = async () => JSON.stringify({ not: "an array" });

    const result = await fetchStageManifest({ fetchManifestSource });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected an error result");
    expect(result.error).toContain("array");
  });
});
