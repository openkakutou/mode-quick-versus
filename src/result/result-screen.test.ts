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
import { createResultOverlay } from "./result-screen.ts";

let onRoundResultDone: Mock<() => void>;
let onRematch: Mock<() => void>;
let onBackToSelect: Mock<() => void>;

beforeEach(() => {
  onRoundResultDone = vi.fn<() => void>();
  onRematch = vi.fn<() => void>();
  onBackToSelect = vi.fn<() => void>();
});

function buildOverlay(delayMs = 3000) {
  return createResultOverlay({
    onRoundResultDone,
    onRematch,
    onBackToSelect,
    roundResultDelayMs: delayMs,
  });
}

describe("createResultOverlay", () => {
  it("is hidden until a result is shown", () => {
    const overlay = buildOverlay();
    expect(overlay.element.hasAttribute("hidden")).toBe(true);
  });

  it("shows the round winner and a visible countdown, with no rematch/back actions", () => {
    const overlay = buildOverlay();

    overlay.showRoundResult({ round: 2, winner: "p1" });

    expect(overlay.element.hasAttribute("hidden")).toBe(false);
    expect(overlay.element.textContent).toContain("Round 2");
    expect(overlay.element.textContent).toContain("Player 1");
    expect(
      overlay.element.querySelector<HTMLElement>(".result-overlay__actions")
        ?.hidden,
    ).toBe(true);
  });

  it("shows a draw round result distinctly from a player win", () => {
    const overlay = buildOverlay();

    overlay.showRoundResult({ round: 1, winner: "draw" });

    expect(overlay.element.textContent).toContain("Draw");
    expect(overlay.element.textContent).not.toContain("Player");
  });

  it("shows the match winner with visible Rematch and Back to select actions, and no countdown", () => {
    const overlay = buildOverlay();

    overlay.showMatchResult({ winner: "p2" });

    expect(overlay.element.hasAttribute("hidden")).toBe(false);
    expect(overlay.element.textContent).toContain("Player 2");
    expect(overlay.element.textContent).toContain("wins the match");
    expect(
      overlay.element.querySelector<HTMLElement>(".result-overlay__countdown")
        ?.hidden,
    ).toBe(true);
    const actions = overlay.element.querySelector<HTMLElement>(
      ".result-overlay__actions",
    );
    expect(actions?.hidden).toBe(false);
  });

  it("shows a drawn match result distinctly from either side winning", () => {
    const overlay = buildOverlay();

    overlay.showMatchResult({ winner: "draw" });

    expect(overlay.element.textContent).toContain("draw");
  });

  it("calls onRematch when the Rematch action is activated", () => {
    const overlay = buildOverlay();
    overlay.showMatchResult({ winner: "p1" });

    overlay.element
      .querySelector<HTMLElement>(".result-overlay__rematch")
      ?.click();

    expect(onRematch).toHaveBeenCalledTimes(1);
    expect(onBackToSelect).not.toHaveBeenCalled();
  });

  it("calls onBackToSelect when the Back to select action is activated", () => {
    const overlay = buildOverlay();
    overlay.showMatchResult({ winner: "p1" });

    overlay.element
      .querySelector<HTMLElement>(".result-overlay__back")
      ?.click();

    expect(onBackToSelect).toHaveBeenCalledTimes(1);
    expect(onRematch).not.toHaveBeenCalled();
  });

  it("visually distinguishes a round result from a match result", () => {
    const overlay = buildOverlay();

    overlay.showRoundResult({ round: 1, winner: "p1" });
    expect(overlay.element.className).toContain("result-overlay--round");

    overlay.showMatchResult({ winner: "p1" });
    expect(overlay.element.className).toContain("result-overlay--match");
  });

  it("replaces a match result with a fresh round result if shown again (rematch's round 1)", () => {
    const overlay = buildOverlay(3000);
    overlay.showMatchResult({ winner: "p1" });

    overlay.showRoundResult({ round: 1, winner: "p2" });

    expect(overlay.element.className).toContain("result-overlay--round");
    expect(
      overlay.element.querySelector<HTMLElement>(".result-overlay__actions")
        ?.hidden,
    ).toBe(true);
    expect(overlay.element.textContent).toContain("Player 2");
  });

  describe("round-result auto-advance timing", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("calls onRoundResultDone exactly once after the configured delay elapses", () => {
      const overlay = buildOverlay(3000);

      overlay.showRoundResult({ round: 1, winner: "p2" });
      vi.advanceTimersByTime(2999);
      expect(onRoundResultDone).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(onRoundResultDone).toHaveBeenCalledTimes(1);

      // The interval is cleared once it fires -- no repeated calls afterward.
      vi.advanceTimersByTime(10000);
      expect(onRoundResultDone).toHaveBeenCalledTimes(1);
    });

    it("counts the visible countdown down to zero, once per second", () => {
      const overlay = buildOverlay(3000);

      overlay.showRoundResult({ round: 1, winner: "p1" });
      expect(overlay.element.textContent).toContain("3");

      vi.advanceTimersByTime(1000);
      expect(overlay.element.textContent).toContain("2");

      vi.advanceTimersByTime(1000);
      expect(overlay.element.textContent).toContain("1");
    });

    it("cancels a pending round-result countdown when hidden, so onRoundResultDone never fires afterward", () => {
      const overlay = buildOverlay(3000);
      overlay.showRoundResult({ round: 1, winner: "p1" });

      overlay.hide();
      vi.advanceTimersByTime(10000);

      expect(onRoundResultDone).not.toHaveBeenCalled();
      expect(overlay.element.hasAttribute("hidden")).toBe(true);
    });

    it("cancels a pending round-result countdown on dispose, so a torn-down overlay never calls back", () => {
      const overlay = buildOverlay(3000);
      overlay.showRoundResult({ round: 1, winner: "p1" });

      overlay.dispose();
      vi.advanceTimersByTime(10000);

      expect(onRoundResultDone).not.toHaveBeenCalled();
    });
  });

  describe("live locale switching (backlog item 009)", () => {
    afterEach(async () => {
      const instance = await initAppI18n();
      await instance.changeLanguage("en");
      window.localStorage.clear();
    });

    it("re-translates the currently shown round result in place", async () => {
      const instance = await initAppI18n();
      await instance.changeLanguage("en");
      const overlay = buildOverlay();
      overlay.showRoundResult({ round: 2, winner: "p1" });

      await instance.changeLanguage("fr");
      await vi.waitFor(() => {
        expect(overlay.element.textContent).toContain("gagne");
      });
      expect(overlay.element.textContent).toContain("Round 2");
      overlay.dispose();
    });

    it("re-translates the currently shown match result in place", async () => {
      const instance = await initAppI18n();
      await instance.changeLanguage("en");
      const overlay = buildOverlay();
      overlay.showMatchResult({ winner: "p2" });

      await instance.changeLanguage("fr");
      await vi.waitFor(() => {
        expect(
          overlay.element.querySelector<HTMLElement>(".result-overlay__rematch")
            ?.textContent,
        ).toBe("Revanche");
      });
      overlay.dispose();
    });

    it("stops re-translating after dispose()", async () => {
      const instance = await initAppI18n();
      await instance.changeLanguage("en");
      const overlay = buildOverlay();
      overlay.showRoundResult({ round: 1, winner: "p1" });
      overlay.dispose();
      const before = overlay.element.textContent;

      await instance.changeLanguage("fr");
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(overlay.element.textContent).toBe(before);
    });
  });
});
