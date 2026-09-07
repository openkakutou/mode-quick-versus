import { describe, expect, it } from "vitest";
import { discoverStages } from "./discovery.ts";
import type { StageManifestEntry } from "./manifest.ts";

const entry = (id: string): StageManifestEntry => ({
  id,
  files: { def: `stages/${id}.def` },
  portrait: `stages/${id}.png`,
});

describe("discoverStages", () => {
  it("resolves every entry to an ok result with its loaded name", async () => {
    const entries = [entry("training-room"), entry("harbor")];
    const fetchBytes = async (filePath: string) =>
      new TextEncoder().encode(`bytes:${filePath}`);
    const loadStage = async (defBytes: Uint8Array) => ({
      ok: true as const,
      stage: {
        name: `Loaded ${new TextDecoder().decode(defBytes)}`,
        bgDef: {
          spriteFile: "",
          localCoordWidth: 0,
          localCoordHeight: 0,
          zOffset: 0,
          zoomOut: 0,
          zoomIn: 0,
          modelFile: "",
          xScale: 1,
          yScale: 1,
        },
        elements: [],
        animations: {},
        stageBoundaries: { left: 0, right: 0, topBound: 0, bottomBound: 0 },
      },
    });

    const discovered = await discoverStages(entries, { fetchBytes, loadStage });

    expect(discovered).toEqual([
      {
        id: "training-room",
        portrait: "stages/training-room.png",
        status: "ok",
        name: "Loaded bytes:stages/training-room.def",
      },
      {
        id: "harbor",
        portrait: "stages/harbor.png",
        status: "ok",
        name: "Loaded bytes:stages/harbor.def",
      },
    ]);
  });

  it("resolves an entry independently to an error result when its def fails to load", async () => {
    const entries = [entry("corrupt-stage")];
    const fetchBytes = async () => new Uint8Array();
    const loadStage = async () => ({
      ok: false as const,
      error: "malformed section header",
    });

    const discovered = await discoverStages(entries, { fetchBytes, loadStage });

    expect(discovered).toEqual([
      {
        id: "corrupt-stage",
        portrait: "stages/corrupt-stage.png",
        status: "error",
        message: "malformed section header",
      },
    ]);
  });

  it("resolves an entry independently to an error result when its file fails to fetch", async () => {
    const entries = [entry("missing-file")];
    const fetchBytes = async () => {
      throw new Error("404 not found");
    };
    const loadStage = async () => ({
      ok: true as const,
      stage: {
        name: "unused",
        bgDef: {
          spriteFile: "",
          localCoordWidth: 0,
          localCoordHeight: 0,
          zOffset: 0,
          zoomOut: 0,
          zoomIn: 0,
          modelFile: "",
          xScale: 1,
          yScale: 1,
        },
        elements: [],
        animations: {},
        stageBoundaries: { left: 0, right: 0, topBound: 0, bottomBound: 0 },
      },
    });

    const discovered = await discoverStages(entries, { fetchBytes, loadStage });

    expect(discovered).toEqual([
      {
        id: "missing-file",
        portrait: "stages/missing-file.png",
        status: "error",
        message: expect.stringContaining("404 not found"),
      },
    ]);
  });

  it("resolves every entry independently — one failure never affects another", async () => {
    const entries = [entry("good"), entry("bad")];
    const fetchBytes = async (filePath: string) => {
      if (filePath.includes("bad")) throw new Error("boom");
      return new Uint8Array();
    };
    const loadStage = async () => ({
      ok: true as const,
      stage: {
        name: "Good Stage",
        bgDef: {
          spriteFile: "",
          localCoordWidth: 0,
          localCoordHeight: 0,
          zOffset: 0,
          zoomOut: 0,
          zoomIn: 0,
          modelFile: "",
          xScale: 1,
          yScale: 1,
        },
        elements: [],
        animations: {},
        stageBoundaries: { left: 0, right: 0, topBound: 0, bottomBound: 0 },
      },
    });

    const discovered = await discoverStages(entries, { fetchBytes, loadStage });

    expect(discovered[0]).toEqual({
      id: "good",
      portrait: "stages/good.png",
      status: "ok",
      name: "Good Stage",
    });
    expect(discovered[1].status).toBe("error");
  });

  it("resolves an empty entry list to an empty array", async () => {
    const discovered = await discoverStages([], {
      fetchBytes: async () => new Uint8Array(),
      loadStage: async () => ({
        ok: true as const,
        stage: {
          name: "x",
          bgDef: {
            spriteFile: "",
            localCoordWidth: 0,
            localCoordHeight: 0,
            zOffset: 0,
            zoomOut: 0,
            zoomIn: 0,
            modelFile: "",
            xScale: 1,
            yScale: 1,
          },
          elements: [],
          animations: {},
          stageBoundaries: { left: 0, right: 0, topBound: 0, bottomBound: 0 },
        },
      }),
    });

    expect(discovered).toEqual([]);
  });
});
