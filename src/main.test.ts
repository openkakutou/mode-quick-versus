import "@openkakutou/web-ui-kit";
import { describe, expect, it, vi } from "vitest";
import { renderApp } from "./main.ts";
import type { StageResult } from "./wasm/stage-types.ts";
import type { CharacterResult } from "./wasm/types.ts";

const manifestSource = JSON.stringify([
  {
    id: "ryu",
    portrait: "roster/ryu/portrait.png",
    files: {
      def: "roster/ryu/character.def",
      air: "roster/ryu/character.air",
      sff: "roster/ryu/character.sff",
      cns: "roster/ryu/character.cns",
    },
  },
]);

const stageManifestSource = JSON.stringify([
  {
    id: "training-room",
    portrait: "stages/training-room/portrait.png",
    files: { def: "stages/training-room/stage.def" },
  },
]);

function okLoadCharacter(name: string) {
  return vi.fn(
    async (): Promise<CharacterResult> => ({ ok: true, character: { name } }),
  );
}

function okLoadStage(name: string) {
  return vi.fn(
    async (): Promise<StageResult> => ({ ok: true, stage: { name } }),
  );
}

/** Drives the app from a fresh render through both players' character picks. */
async function renderAndPickCharacters(
  root: HTMLElement,
  overrides: Parameters<typeof renderApp>[2] = {},
): Promise<HTMLElement> {
  await renderApp(root, "0.1.0", {
    manifestOptions: { fetchManifestSource: async () => manifestSource },
    fetchBytes: async () => new Uint8Array(),
    loadCharacter: okLoadCharacter("Ryu"),
    stageManifestOptions: {
      fetchManifestSource: async () => stageManifestSource,
    },
    loadStage: okLoadStage("Training Room"),
    ...overrides,
  });

  const main = root.querySelector("main") as HTMLElement;
  main.querySelector<HTMLElement>(".roster-screen__pick--p1")?.click();
  main.querySelector<HTMLElement>(".roster-screen__pick--p2")?.click();
  const continueEl = Array.from(main.querySelectorAll("wuik-button")).find(
    (el) => el.textContent === "Continue",
  ) as HTMLElement;
  continueEl.click();
  // Discovering stages is async (manifest fetch + WASM validation), so the
  // stage screen doesn't exist synchronously right after the click.
  await vi.waitFor(() => {
    if (!main.querySelector(".stage-screen__grid, .stage-screen__empty")) {
      throw new Error("stage screen not mounted yet");
    }
  });
  return main;
}

describe("renderApp", () => {
  it("mounts a wuik-app-shell root frame with a toolbar showing the title and version", async () => {
    const root = document.createElement("div");

    await renderApp(root, "0.1.0", {
      manifestOptions: { fetchManifestSource: async () => "[]" },
      fetchBytes: async () => new Uint8Array(),
      loadCharacter: okLoadCharacter("unused"),
    });

    const shell = root.querySelector("wuik-app-shell");
    expect(shell).not.toBeNull();
    const toolbar = shell?.querySelector('[slot="toolbar"]');
    expect(toolbar?.tagName.toLowerCase()).toBe("wuik-toolbar");
    expect(toolbar?.textContent).toBe("Quick Versus — v0.1.0");
  });

  it("discovers the roster from the manifest and renders it in the main content area", async () => {
    const root = document.createElement("div");

    await renderApp(root, "0.1.0", {
      manifestOptions: { fetchManifestSource: async () => manifestSource },
      fetchBytes: async () => new Uint8Array(),
      loadCharacter: okLoadCharacter("Ryu"),
    });

    const main = root.querySelector("main");
    expect(main?.textContent).toContain("Ryu");
  });

  it("shows a clear message instead of a blank screen when the manifest fails to load", async () => {
    const root = document.createElement("div");

    await renderApp(root, "0.1.0", {
      manifestOptions: {
        fetchManifestSource: async () => {
          throw new Error("network down");
        },
      },
      fetchBytes: async () => new Uint8Array(),
      loadCharacter: okLoadCharacter("unused"),
    });

    expect(root.querySelector("main")?.textContent).toContain(
      "Could not load the character roster",
    );
  });

  it("renders the stage selection screen once character selection's Continue is activated", async () => {
    const root = document.createElement("div");

    const main = await renderAndPickCharacters(root);

    expect(main.textContent).toContain("Training Room");
  });

  it("shows a clear message instead of a blank screen when the stage manifest fails to load", async () => {
    const root = document.createElement("div");

    await renderApp(root, "0.1.0", {
      manifestOptions: { fetchManifestSource: async () => manifestSource },
      fetchBytes: async () => new Uint8Array(),
      loadCharacter: okLoadCharacter("Ryu"),
      stageManifestOptions: {
        fetchManifestSource: async () => {
          throw new Error("network down");
        },
      },
      loadStage: okLoadStage("unused"),
    });

    const main = root.querySelector("main") as HTMLElement;
    main.querySelector<HTMLElement>(".roster-screen__pick--p1")?.click();
    main.querySelector<HTMLElement>(".roster-screen__pick--p2")?.click();
    const continueEl = Array.from(main.querySelectorAll("wuik-button")).find(
      (el) => el.textContent === "Continue",
    ) as HTMLElement;
    continueEl.click();

    await vi.waitFor(() => {
      if (!main.textContent?.includes("Could not load the stage list")) {
        throw new Error("error message not shown yet");
      }
    });
  });

  it("renders the match setup screen once the stage screen's Continue is activated", async () => {
    const root = document.createElement("div");

    const main = await renderAndPickCharacters(root);
    main.querySelector<HTMLElement>(".stage-screen__select")?.click();
    const stageContinueEl = Array.from(
      main.querySelectorAll("wuik-button"),
    ).find((el) => el.textContent === "Continue") as HTMLElement;
    stageContinueEl.click();

    expect(main.textContent).toContain("Match Setup");
  });

  it("shows a confirmation naming both players' picks, the chosen stage, and the configured rounds/time limit once match setup's Continue is activated", async () => {
    const root = document.createElement("div");

    const main = await renderAndPickCharacters(root);
    main.querySelector<HTMLElement>(".stage-screen__select")?.click();
    const stageContinueEl = Array.from(
      main.querySelectorAll("wuik-button"),
    ).find((el) => el.textContent === "Continue") as HTMLElement;
    stageContinueEl.click();

    main.querySelector<HTMLElement>('[data-value="3"]')?.click();
    main.querySelector<HTMLElement>('[data-label="Unlimited"]')?.click();
    const setupContinueEl = Array.from(
      main.querySelectorAll("wuik-button"),
    ).find((el) => el.textContent === "Continue") as HTMLElement;
    setupContinueEl.click();

    expect(main.textContent).toContain(
      "Player 1: ryu — Player 2: ryu — Stage: training-room — Rounds: 3 — Time limit: Unlimited",
    );
  });

  it("replaces previous content instead of appending on repeated renders", async () => {
    const root = document.createElement("div");

    await renderApp(root, "0.1.0", {
      manifestOptions: { fetchManifestSource: async () => "[]" },
      fetchBytes: async () => new Uint8Array(),
      loadCharacter: okLoadCharacter("unused"),
    });
    await renderApp(root, "0.2.0", {
      manifestOptions: { fetchManifestSource: async () => "[]" },
      fetchBytes: async () => new Uint8Array(),
      loadCharacter: okLoadCharacter("unused"),
    });

    expect(root.querySelectorAll("wuik-app-shell")).toHaveLength(1);
    expect(root.querySelector('[slot="toolbar"]')?.textContent).toBe(
      "Quick Versus — v0.2.0",
    );
  });
});
