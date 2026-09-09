import "@openkakutou/web-ui-kit";
import { afterEach, describe, expect, it, vi } from "vitest";
import { initAppI18n } from "./i18n/i18n.ts";
import { renderApp } from "./main.ts";
import type { MatchRendererHandle } from "./rendering/match-renderer.ts";
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
      cmd: "roster/ryu/character.cmd",
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
    async (): Promise<CharacterResult> => ({
      ok: true,
      character: { name, animations: [], sprites: [], stateDefs: [] },
    }),
  );
}

function okLoadStage(name: string) {
  return vi.fn(
    async (): Promise<StageResult> => ({
      ok: true,
      stage: {
        name,
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

  it("mounts a locale switcher in the toolbar (backlog item 009)", async () => {
    const root = document.createElement("div");

    await renderApp(root, "0.1.0", {
      manifestOptions: { fetchManifestSource: async () => "[]" },
      fetchBytes: async () => new Uint8Array(),
      loadCharacter: okLoadCharacter("unused"),
    });

    const toolbar = root.querySelector('[slot="toolbar"]');
    const switcher = toolbar?.querySelector("wuik-locale-switcher");
    expect(switcher).not.toBeNull();
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

  /** Drives the flow from a fresh render all the way through match setup's Continue, with `renderMatch` overridden to a spy. Returns the spy and `main`. */
  async function renderAndStartMatch(
    root: HTMLElement,
    overrides: Parameters<typeof renderApp>[2] = {},
  ): Promise<{
    main: HTMLElement;
    renderMatch: ReturnType<typeof vi.fn>;
  }> {
    const noopHandle: MatchRendererHandle = { stop() {} };
    const renderMatchSpy = vi.fn(async () => noopHandle);

    const main = await renderAndPickCharacters(root, {
      renderMatch: renderMatchSpy,
      ...overrides,
    });
    main.querySelector<HTMLElement>(".stage-screen__select")?.click();
    const stageContinueEl = Array.from(
      main.querySelectorAll("wuik-button"),
    ).find((el) => el.textContent === "Continue") as HTMLElement;
    stageContinueEl.click();

    await vi.waitFor(() => {
      if (!main.textContent?.includes("Match Setup")) {
        throw new Error("setup screen not mounted yet");
      }
    });
    main.querySelector<HTMLElement>('[data-value="3"]')?.click();
    main.querySelector<HTMLElement>('[data-label="Unlimited"]')?.click();
    const setupContinueEl = Array.from(
      main.querySelectorAll("wuik-button"),
    ).find((el) => el.textContent === "Continue") as HTMLElement;
    setupContinueEl.click();

    await vi.waitFor(() => {
      expect(renderMatchSpy).toHaveBeenCalled();
    });
    return { main, renderMatch: renderMatchSpy };
  }

  it("starts match rendering with both players' loaded characters, the chosen stage, and the configured rounds/time limit once match setup's Continue is activated", async () => {
    const root = document.createElement("div");

    const { main, renderMatch } = await renderAndStartMatch(root);

    expect(renderMatch).toHaveBeenCalledTimes(1);
    const [renderRoot, input] = renderMatch.mock.calls[0];
    expect(renderRoot).toBe(main);
    expect(input.player1.character.name).toBe("Ryu");
    expect(input.player2.character.name).toBe("Ryu");
    expect(input.stage.stage.name).toBe("Training Room");
    expect(input.config).toEqual({
      rounds: 3,
      timeLimit: "unlimited",
    });
    // No loadCmd override supplied: the real bridge's own loadCmd rejects
    // under jsdom (no WASM stub configured for this test), so both players
    // degrade to the empty command file fallback rather than blocking the
    // match or throwing.
    expect(input.player1.commands).toEqual({
      remap: {},
      defaults: { time: 0, bufferTime: 0 },
      commands: [],
      states: [],
    });
    expect(input.player2.commands).toEqual({
      remap: {},
      defaults: { time: 0, bufferTime: 0 },
      commands: [],
      states: [],
    });
  });

  it("threads each player's own parsed command file into match rendering when loadCmd succeeds", async () => {
    const root = document.createElement("div");
    const p1Commands = {
      remap: { a: "a" },
      defaults: { time: 15, bufferTime: 1 },
      commands: [{ name: "p1", input: "a", time: 1, bufferTime: 1 }],
      states: [],
    };

    const { renderMatch } = await renderAndStartMatch(root, {
      loadCmd: vi.fn(async () => ({
        ok: true as const,
        commandFile: p1Commands,
      })),
    });

    const [, input] = renderMatch.mock.calls[0];
    expect(input.player1.commands).toEqual(p1Commands);
    expect(input.player2.commands).toEqual(p1Commands);
  });

  it("still starts the match, degrading to no recognized commands, when a fighter's .cmd file fails to load", async () => {
    const root = document.createElement("div");

    const { main, renderMatch } = await renderAndStartMatch(root, {
      loadCmd: vi.fn(async () => ({
        ok: false as const,
        error: "corrupt .cmd file",
      })),
    });

    expect(renderMatch).toHaveBeenCalledTimes(1);
    expect(main.textContent).not.toContain("corrupt .cmd file");
    const [, input] = renderMatch.mock.calls[0];
    expect(input.player1.commands).toEqual({
      remap: {},
      defaults: { time: 0, bufferTime: 0 },
      commands: [],
      states: [],
    });
  });

  it("shows a clear error message instead of a blank screen when a match asset fails to (re)load", async () => {
    const root = document.createElement("div");
    let callCount = 0;

    const main = await renderAndPickCharacters(root, {
      // The 3rd loadCharacter call happens during match assembly (after
      // the 2 initial roster-discovery calls) -- fail only that one.
      loadCharacter: vi.fn(async () => {
        callCount += 1;
        if (callCount <= 2) {
          return {
            ok: true as const,
            character: {
              name: "Ryu",
              animations: [],
              sprites: [],
              stateDefs: [],
            },
          };
        }
        return { ok: false as const, error: "corrupt .cns file" };
      }),
    });
    main.querySelector<HTMLElement>(".stage-screen__select")?.click();
    const stageContinueEl = Array.from(
      main.querySelectorAll("wuik-button"),
    ).find((el) => el.textContent === "Continue") as HTMLElement;
    stageContinueEl.click();

    await vi.waitFor(() => {
      if (!main.textContent?.includes("Match Setup")) {
        throw new Error("setup screen not mounted yet");
      }
    });
    main.querySelector<HTMLElement>('[data-value="3"]')?.click();
    main.querySelector<HTMLElement>('[data-label="Unlimited"]')?.click();
    const setupContinueEl = Array.from(
      main.querySelectorAll("wuik-button"),
    ).find((el) => el.textContent === "Continue") as HTMLElement;
    setupContinueEl.click();

    await vi.waitFor(() => {
      if (!main.textContent?.includes("corrupt .cns file")) {
        throw new Error("error message not shown yet");
      }
    });
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

  describe("live locale switching (backlog item 009)", () => {
    afterEach(async () => {
      const instance = await initAppI18n();
      await instance.changeLanguage("en");
      window.localStorage.clear();
    });

    it("re-translates the locale switcher's own accessible label in place", async () => {
      const instance = await initAppI18n();
      await instance.changeLanguage("en");
      const root = document.createElement("div");

      await renderApp(root, "0.1.0", {
        manifestOptions: { fetchManifestSource: async () => "[]" },
        fetchBytes: async () => new Uint8Array(),
        loadCharacter: okLoadCharacter("unused"),
      });

      const switcher = root.querySelector("wuik-locale-switcher");

      await instance.changeLanguage("fr");
      await vi.waitFor(() => {
        expect(switcher?.getAttribute("label")).toBe("Langue");
      });

      // The toolbar's brand title/version stay untranslated proper nouns.
      expect(root.querySelector('[slot="toolbar"]')?.textContent).toBe(
        "Quick Versus — v0.1.0",
      );
    });
  });
});
