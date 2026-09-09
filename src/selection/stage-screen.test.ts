import "@openkakutou/web-ui-kit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initAppI18n } from "../i18n/i18n.ts";
import type { DiscoveredStage } from "../stage/discovery.ts";
import { renderStageScreen } from "./stage-screen.ts";

const trainingRoom: DiscoveredStage = {
  id: "training-room",
  portrait: "stages/training-room/portrait.png",
  status: "ok",
  name: "Training Room",
};
const harbor: DiscoveredStage = {
  id: "harbor",
  portrait: "stages/harbor/portrait.png",
  status: "ok",
  name: "Harbor",
};
const corrupt: DiscoveredStage = {
  id: "corrupt-stage",
  portrait: "stages/corrupt-stage/portrait.png",
  status: "error",
  message: "stage: line 3: malformed section header",
};

function cardFor(root: HTMLElement, id: string): HTMLElement {
  const portrait = root.querySelector<HTMLImageElement>(
    `img[src="stages/${id}/portrait.png"]`,
  );
  const card = portrait?.closest("wuik-panel");
  if (!card) throw new Error(`card for ${id} not found`);
  return card as HTMLElement;
}

function selectButtonFor(root: HTMLElement, id: string): HTMLElement {
  const button = cardFor(root, id).querySelector<HTMLElement>(
    ".stage-screen__select",
  );
  if (!button) throw new Error(`select button for ${id} not found`);
  return button;
}

function continueButton(root: HTMLElement): HTMLElement {
  const button = root.querySelector<HTMLElement>("wuik-button:not([class])");
  if (!button) throw new Error("continue button not found");
  return button;
}

let root: HTMLElement;

beforeEach(() => {
  root = document.createElement("div");
});

describe("renderStageScreen", () => {
  it("displays every stage's name and portrait", () => {
    renderStageScreen(root, [trainingRoom, harbor], { onContinue: vi.fn() });

    expect(cardFor(root, "training-room").textContent).toContain(
      "Training Room",
    );
    expect(cardFor(root, "harbor").textContent).toContain("Harbor");
  });

  it("shows an empty-state message instead of a blank grid when no stages are configured", () => {
    renderStageScreen(root, [], { onContinue: vi.fn() });

    expect(root.textContent).toContain("No stages are available");
    expect(root.querySelector(".stage-screen__grid")).toBeNull();
  });

  it("shows a stage that failed to load as a visible, non-interactive error card", () => {
    renderStageScreen(root, [trainingRoom, corrupt], { onContinue: vi.fn() });

    const card = cardFor(root, "corrupt-stage");
    expect(card.getAttribute("aria-disabled")).toBe("true");
    expect(card.textContent).toContain(
      "stage: line 3: malformed section header",
    );
    expect(card.querySelector(".stage-screen__select")).toBeNull();
  });

  it("exposes the grid as a single-choice radio group", () => {
    renderStageScreen(root, [trainingRoom, harbor], { onContinue: vi.fn() });

    expect(
      root.querySelector(".stage-screen__grid")?.getAttribute("role"),
    ).toBe("radiogroup");
    expect(selectButtonFor(root, "training-room").getAttribute("role")).toBe(
      "radio",
    );
  });

  it("keeps Continue disabled until a stage is selected", () => {
    renderStageScreen(root, [trainingRoom, harbor], { onContinue: vi.fn() });
    const continueEl = continueButton(root);
    expect(continueEl.hasAttribute("disabled")).toBe(true);

    selectButtonFor(root, "training-room").click();
    expect(continueEl.hasAttribute("disabled")).toBe(false);
  });

  it("selects exactly one stage at a time — picking a new one deselects the previous one", () => {
    renderStageScreen(root, [trainingRoom, harbor], { onContinue: vi.fn() });

    selectButtonFor(root, "training-room").click();
    selectButtonFor(root, "harbor").click();

    expect(
      selectButtonFor(root, "training-room").getAttribute("aria-checked"),
    ).toBe("false");
    expect(selectButtonFor(root, "harbor").getAttribute("aria-checked")).toBe(
      "true",
    );
  });

  it("re-clicking the already-selected stage keeps it selected instead of deselecting it", () => {
    renderStageScreen(root, [trainingRoom, harbor], { onContinue: vi.fn() });

    selectButtonFor(root, "training-room").click();
    selectButtonFor(root, "training-room").click();

    expect(
      selectButtonFor(root, "training-room").getAttribute("aria-checked"),
    ).toBe("true");
    expect(continueButton(root).hasAttribute("disabled")).toBe(false);
  });

  it("calls onContinue with the selected stage once Continue is activated", () => {
    const onContinue = vi.fn();
    renderStageScreen(root, [trainingRoom, harbor], { onContinue });

    selectButtonFor(root, "harbor").click();
    continueButton(root).click();

    expect(onContinue).toHaveBeenCalledExactlyOnceWith("harbor");
  });

  it("does not call onContinue when Continue is activated before a stage is selected", () => {
    const onContinue = vi.fn();
    renderStageScreen(root, [trainingRoom, harbor], { onContinue });

    continueButton(root).click();

    expect(onContinue).not.toHaveBeenCalled();
  });

  it("replaces previous content instead of appending on repeated renders", () => {
    renderStageScreen(root, [trainingRoom, harbor], { onContinue: vi.fn() });
    renderStageScreen(root, [trainingRoom], { onContinue: vi.fn() });

    expect(root.querySelectorAll(".stage-screen__grid")).toHaveLength(1);
    expect(
      root.querySelector(`img[src="stages/harbor/portrait.png"]`),
    ).toBeNull();
  });

  describe("live locale switching (backlog item 009)", () => {
    afterEach(async () => {
      const instance = await initAppI18n();
      await instance.changeLanguage("en");
      window.localStorage.clear();
    });

    it("re-translates the heading, Continue, and select labels in place without losing the current pick", async () => {
      const instance = await initAppI18n();
      await instance.changeLanguage("en");
      renderStageScreen(root, [trainingRoom, harbor], { onContinue: vi.fn() });

      selectButtonFor(root, "harbor").click();

      await instance.changeLanguage("fr");
      await vi.waitFor(() => {
        expect(root.querySelector("h2")?.textContent).toBe(
          "Choisissez votre stage",
        );
      });

      expect(continueButton(root).textContent).toBe("Continuer");
      expect(selectButtonFor(root, "harbor").textContent).toBe("Choisi ✓");
      expect(selectButtonFor(root, "training-room").textContent).toBe(
        "Choisir ce stage",
      );
      // The selection itself must survive the locale switch untouched.
      expect(selectButtonFor(root, "harbor").getAttribute("aria-checked")).toBe(
        "true",
      );
      expect(continueButton(root).hasAttribute("disabled")).toBe(false);
    });

    it("re-translates the empty-state message in place", async () => {
      const instance = await initAppI18n();
      await instance.changeLanguage("en");
      renderStageScreen(root, [], { onContinue: vi.fn() });

      await instance.changeLanguage("fr");
      await vi.waitFor(() => {
        expect(root.textContent).toContain("Aucun stage n'est disponible");
      });
    });

    it("re-translates an error card's prefix in place while keeping the raw message untouched", async () => {
      const instance = await initAppI18n();
      await instance.changeLanguage("en");
      renderStageScreen(root, [corrupt], { onContinue: vi.fn() });

      await instance.changeLanguage("fr");
      await vi.waitFor(() => {
        expect(cardFor(root, "corrupt-stage").textContent).toContain(
          "Indisponible",
        );
      });
      expect(cardFor(root, "corrupt-stage").textContent).toContain(
        "stage: line 3: malformed section header",
      );
    });
  });
});
