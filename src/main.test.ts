import "@openkakutou/web-ui-kit";
import { describe, expect, it, vi } from "vitest";
import { renderApp } from "./main.ts";
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

function okLoadCharacter(name: string) {
  return vi.fn(
    async (): Promise<CharacterResult> => ({ ok: true, character: { name } }),
  );
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

  it("shows a confirmation naming both players' picks once the selection screen's Continue is activated", async () => {
    const root = document.createElement("div");

    await renderApp(root, "0.1.0", {
      manifestOptions: { fetchManifestSource: async () => manifestSource },
      fetchBytes: async () => new Uint8Array(),
      loadCharacter: okLoadCharacter("Ryu"),
    });

    const main = root.querySelector("main") as HTMLElement;
    const p1 = main.querySelector<HTMLElement>(".roster-screen__pick--p1");
    const p2 = main.querySelector<HTMLElement>(".roster-screen__pick--p2");
    p1?.click();
    p2?.click();
    const continueEl = Array.from(main.querySelectorAll("wuik-button")).find(
      (el) => el.textContent === "Continue",
    ) as HTMLElement;
    continueEl.click();

    expect(main.textContent).toContain("Player 1: ryu — Player 2: ryu");
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
