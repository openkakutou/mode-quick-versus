import "@openkakutou/web-ui-kit";
import {
  type Mock,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { initAppI18n } from "../i18n/i18n.ts";
import { type MatchSetupConfig, renderSetupScreen } from "./setup-screen.ts";

function roundButton(root: HTMLElement, value: number): HTMLElement {
  const button = root.querySelector<HTMLElement>(
    `.setup-screen__round-select[data-value="${value}"]`,
  );
  if (!button) throw new Error(`round button for ${value} not found`);
  return button;
}

function timeButton(root: HTMLElement, label: string): HTMLElement {
  const button = root.querySelector<HTMLElement>(
    `.setup-screen__time-select[data-label="${label}"]`,
  );
  if (!button) throw new Error(`time button for ${label} not found`);
  return button;
}

function continueButton(root: HTMLElement): HTMLElement {
  const button = root.querySelector<HTMLElement>("wuik-button:not([class])");
  if (!button) throw new Error("continue button not found");
  return button;
}

let root: HTMLElement;
let onContinue: Mock<(config: MatchSetupConfig) => void>;

beforeEach(() => {
  root = document.createElement("div");
  onContinue = vi.fn<(config: MatchSetupConfig) => void>();
});

describe("renderSetupScreen", () => {
  it("renders the default round and time limit options as two independently labelled radiogroups", () => {
    renderSetupScreen(root, { onContinue });

    expect(roundButton(root, 1)).toBeTruthy();
    expect(roundButton(root, 3)).toBeTruthy();
    expect(roundButton(root, 5)).toBeTruthy();
    expect(timeButton(root, "60s")).toBeTruthy();
    expect(timeButton(root, "99s")).toBeTruthy();
    expect(timeButton(root, "Unlimited")).toBeTruthy();

    const groups = root.querySelectorAll('[role="radiogroup"]');
    expect(groups).toHaveLength(2);
    for (const group of groups) {
      const labelledBy = group.getAttribute("aria-labelledby");
      expect(labelledBy).toBeTruthy();
      expect(root.querySelector(`#${labelledBy}`)).toBeTruthy();
    }
    // The two groups must not share the same heading.
    const [firstLabel, secondLabel] = Array.from(groups).map((group) =>
      group.getAttribute("aria-labelledby"),
    );
    expect(firstLabel).not.toBe(secondLabel);
  });

  it("keeps Continue disabled until both a round count and a time limit are selected", () => {
    renderSetupScreen(root, { onContinue });
    const continue1 = continueButton(root);
    expect(continue1.hasAttribute("disabled")).toBe(true);

    roundButton(root, 3).click();
    expect(continueButton(root).hasAttribute("disabled")).toBe(true);

    timeButton(root, "99s").click();
    expect(continueButton(root).hasAttribute("disabled")).toBe(false);
  });

  it("also stays disabled when only the time limit is picked first", () => {
    renderSetupScreen(root, { onContinue });

    timeButton(root, "Unlimited").click();
    expect(continueButton(root).hasAttribute("disabled")).toBe(true);

    roundButton(root, 1).click();
    expect(continueButton(root).hasAttribute("disabled")).toBe(false);
  });

  it("calls onContinue with the exact selected rounds and a numeric time limit", () => {
    renderSetupScreen(root, { onContinue });

    roundButton(root, 5).click();
    timeButton(root, "60s").click();
    continueButton(root).click();

    expect(onContinue).toHaveBeenCalledExactlyOnceWith({
      rounds: 5,
      timeLimit: { seconds: 60 },
    });
  });

  it("calls onContinue with the unlimited marker, never a number, when Unlimited is selected", () => {
    renderSetupScreen(root, { onContinue });

    roundButton(root, 1).click();
    timeButton(root, "Unlimited").click();
    continueButton(root).click();

    expect(onContinue).toHaveBeenCalledExactlyOnceWith({
      rounds: 1,
      timeLimit: "unlimited",
    });
  });

  it("treats re-selecting the already-selected round count as a no-op", () => {
    renderSetupScreen(root, { onContinue });

    roundButton(root, 3).click();
    roundButton(root, 3).click();
    timeButton(root, "60s").click();
    continueButton(root).click();

    expect(onContinue).toHaveBeenCalledExactlyOnceWith({
      rounds: 3,
      timeLimit: { seconds: 60 },
    });
  });

  it("switches the round selection without disturbing an already-made time limit pick", () => {
    renderSetupScreen(root, { onContinue });

    roundButton(root, 1).click();
    timeButton(root, "99s").click();
    roundButton(root, 5).click();

    expect(roundButton(root, 1).getAttribute("aria-checked")).toBe("false");
    expect(roundButton(root, 5).getAttribute("aria-checked")).toBe("true");
    expect(timeButton(root, "99s").getAttribute("aria-checked")).toBe("true");
    expect(continueButton(root).hasAttribute("disabled")).toBe(false);
  });

  it("renders a blocking, named error state when a configured round count is not a positive odd integer", () => {
    renderSetupScreen(root, { roundOptions: [1, 2, 5], onContinue });

    expect(root.querySelector('[role="radiogroup"]')).toBeNull();
    expect(root.textContent).toContain("2");
    expect(onContinue).not.toHaveBeenCalled();
  });

  it("renders a blocking, named error state when a configured time limit is neither a positive integer of seconds nor 'unlimited'", () => {
    renderSetupScreen(root, {
      timeLimitOptions: [{ seconds: 60 }, { seconds: 0 }, "unlimited"],
      onContinue,
    });

    expect(root.querySelector('[role="radiogroup"]')).toBeNull();
    expect(root.textContent).toContain("0");
    expect(onContinue).not.toHaveBeenCalled();
  });

  describe("Controls section", () => {
    it("shows each player's own default direction and button keys, clearly attributed to that player", () => {
      renderSetupScreen(root, { onContinue });

      const sections = root.querySelectorAll(".setup-screen__controls-player");
      expect(sections).toHaveLength(2);
      // Player 1 defaults to WASD.
      expect(sections[0].textContent).toContain("W");
      expect(sections[0].textContent).toContain("A");
      expect(sections[0].textContent).toContain("S");
      expect(sections[0].textContent).toContain("D");
      // Player 2 defaults to the arrow keys.
      expect(sections[1].textContent).toContain("Arrow Up");
      expect(sections[1].textContent).toContain("Arrow Left");
    });

    it("lists all six button names for each player", () => {
      renderSetupScreen(root, { onContinue });

      const sections = root.querySelectorAll(".setup-screen__controls-player");
      for (const section of sections) {
        for (const name of ["a", "b", "c", "x", "y", "z"]) {
          expect(section.textContent?.toLowerCase()).toContain(name);
        }
      }
    });

    it("never assigns the same physical key to both players", () => {
      renderSetupScreen(root, { onContinue });

      const [p1] = root.querySelectorAll(".setup-screen__controls-player");
      const p1Keys = p1.textContent ?? "";
      // A crude but sufficient check for this fixed default set: none of
      // player 2's own bound keys appear verbatim in player 1's listing.
      expect(p1Keys).not.toContain("Arrow");
    });

    it("mentions gamepad support and its keyboard fallback", () => {
      renderSetupScreen(root, { onContinue });

      const controls = root.querySelector(".setup-screen__controls");
      expect(controls?.textContent?.toLowerCase()).toContain("gamepad");
      expect(controls?.textContent?.toLowerCase()).toContain("keyboard");
    });

    it("is not shown on the blocking error state", () => {
      renderSetupScreen(root, { roundOptions: [1, 2, 5], onContinue });

      expect(root.querySelector(".setup-screen__controls")).toBeNull();
    });
  });

  describe("live locale switching (backlog item 009)", () => {
    afterEach(async () => {
      const instance = await initAppI18n();
      await instance.changeLanguage("en");
      window.localStorage.clear();
    });

    it("re-translates headings, Continue, and the Controls section in place without losing the current picks", async () => {
      const instance = await initAppI18n();
      await instance.changeLanguage("en");
      renderSetupScreen(root, { onContinue });

      roundButton(root, 3).click();
      timeButton(root, "99s").click();

      await instance.changeLanguage("fr");
      await vi.waitFor(() => {
        expect(root.querySelector("h1")?.textContent).toBe(
          "Configuration du match",
        );
      });

      expect(continueButton(root).textContent).toBe("Continuer");
      const headings = Array.from(root.querySelectorAll("h2")).map(
        (el) => el.textContent,
      );
      expect(headings).toContain("Nombre de rounds");
      expect(headings).toContain("Limite de temps");
      expect(headings).toContain("Commandes");
      // Physical key names are never translated.
      const sections = root.querySelectorAll(".setup-screen__controls-player");
      expect(sections[0].textContent).toContain("W");
      expect(sections[1].textContent).toContain("Arrow Up");
      // The current picks survive the locale switch untouched.
      expect(roundButton(root, 3).getAttribute("aria-checked")).toBe("true");
      expect(timeButton(root, "99s").getAttribute("aria-checked")).toBe("true");
      expect(continueButton(root).hasAttribute("disabled")).toBe(false);
    });

    it("re-translates the blocking error state in place", async () => {
      const instance = await initAppI18n();
      await instance.changeLanguage("en");
      renderSetupScreen(root, { roundOptions: [1, 2, 5], onContinue });

      await instance.changeLanguage("fr");
      await vi.waitFor(() => {
        expect(root.textContent).toContain(
          "Option de nombre de rounds invalide",
        );
      });
      expect(root.textContent).toContain("2");
    });
  });
});
