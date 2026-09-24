import { afterEach, describe, expect, it, vi } from "vitest";
import { initAppI18n } from "../i18n/i18n.ts";
import { createHud } from "./hud-renderer.ts";

function state(
  round: number,
  fighters: [
    { health: number; power: number },
    { health: number; power: number },
  ],
) {
  return {
    round,
    roundTimer: 6000,
    fighters: [
      { side: 0, ...fighters[0] },
      { side: 1, ...fighters[1] },
    ],
  };
}

function progress(bestOf: number, wins: [number, number]) {
  return { bestOf, wins, roundsPlayed: 0 };
}

describe("createHud", () => {
  it("renders both players' health/power bars with the real placeholder ranges on the first update", () => {
    const hud = createHud({ maxHealth: 1000, maxPower: 3000 });

    hud.update(
      state(1, [
        { health: 800, power: 450 },
        { health: 300, power: 1500 },
      ]),
      progress(3, [0, 0]),
    );

    const p1Health = hud.element.querySelector(
      '[aria-label="Player 1 health"]',
    );
    const p2Health = hud.element.querySelector(
      '[aria-label="Player 2 health"]',
    );
    const p1Power = hud.element.querySelector('[aria-label="Player 1 power"]');
    const p2Power = hud.element.querySelector('[aria-label="Player 2 power"]');

    expect(p1Health?.getAttribute("role")).toBe("progressbar");
    expect(p1Health?.getAttribute("aria-valuemin")).toBe("0");
    expect(p1Health?.getAttribute("aria-valuemax")).toBe("1000");
    expect(p1Health?.getAttribute("aria-valuenow")).toBe("800");
    expect(p1Health?.getAttribute("aria-valuetext")).toBe("800 / 1000");

    expect(p2Health?.getAttribute("aria-valuenow")).toBe("300");
    expect(p1Power?.getAttribute("aria-valuemax")).toBe("3000");
    expect(p1Power?.getAttribute("aria-valuenow")).toBe("450");
    expect(p2Power?.getAttribute("aria-valuenow")).toBe("1500");
  });

  it("uses a custom max health/power range when supplied, never a hardcoded 100", () => {
    const hud = createHud({ maxHealth: 500, maxPower: 200 });

    hud.update(
      state(1, [
        { health: 250, power: 100 },
        { health: 500, power: 200 },
      ]),
      progress(1, [0, 0]),
    );

    const p1Health = hud.element.querySelector(
      '[aria-label="Player 1 health"]',
    );
    expect(p1Health?.getAttribute("aria-valuemax")).toBe("500");
    const fill = hud.element.querySelector(
      ".hud__health-fill--1",
    ) as HTMLElement;
    expect(fill.style.width).toBe("50%");
  });

  it("shows the current round number, each player's win count, and the best-of setting", () => {
    const hud = createHud();

    hud.update(
      state(2, [
        { health: 1000, power: 0 },
        { health: 1000, power: 0 },
      ]),
      progress(3, [1, 0]),
    );

    const roundBlock = hud.element.querySelector(".hud__round");
    expect(roundBlock?.textContent).toContain("2");
    expect(roundBlock?.textContent).toContain("3");
    const wins = hud.element.querySelectorAll(".hud__wins");
    expect(wins[0].textContent).toContain("1");
    expect(wins[1].textContent).toContain("0");
  });

  it("announces a round/win change once via aria-live, but never on an ordinary health/power-only update", () => {
    const hud = createHud();
    const announcement = hud.element.querySelector(
      "[aria-live]",
    ) as HTMLElement;
    let setCount = 0;
    const descriptor = Object.getOwnPropertyDescriptor(
      Node.prototype,
      "textContent",
    );
    if (!descriptor?.get || !descriptor?.set) {
      throw new Error("expected Node.prototype.textContent accessors");
    }
    Object.defineProperty(announcement, "textContent", {
      get() {
        return descriptor.get?.call(announcement);
      },
      set(value: string | null) {
        setCount++;
        descriptor.set?.call(announcement, value);
      },
    });

    hud.update(
      state(1, [
        { health: 1000, power: 0 },
        { health: 1000, power: 0 },
      ]),
      progress(3, [0, 0]),
    );
    expect(setCount).toBe(1);

    // Health-only change, same round/wins: no new announcement.
    hud.update(
      state(1, [
        { health: 900, power: 0 },
        { health: 1000, power: 0 },
      ]),
      progress(3, [0, 0]),
    );
    expect(setCount).toBe(1);

    // Wins change: a new announcement fires.
    hud.update(
      state(2, [
        { health: 1000, power: 0 },
        { health: 1000, power: 0 },
      ]),
      progress(3, [1, 0]),
    );
    expect(setCount).toBe(2);
  });

  it("shows a clear error state instead of throwing when match state is malformed", () => {
    const hud = createHud();

    hud.update(
      { round: 1, fighters: [{ health: -5 }, { health: 10 }] },
      progress(3, [0, 0]),
    );

    const error = hud.element.querySelector(".hud__error");
    expect(error?.hasAttribute("hidden")).toBe(false);
    expect(error?.textContent?.length ?? 0).toBeGreaterThan(0);
    const content = hud.element.querySelector(".hud__content");
    expect(content?.hasAttribute("hidden")).toBe(true);
  });

  it("never throws on completely unexpected input and still shows the error state", () => {
    const hud = createHud();

    expect(() => hud.update("garbage", 42)).not.toThrow();
    const error = hud.element.querySelector(".hud__error");
    expect(error?.hasAttribute("hidden")).toBe(false);
  });

  it("recovers from the error state once a later update is valid again", () => {
    const hud = createHud();

    hud.update("garbage", 42);
    expect(
      hud.element.querySelector(".hud__error")?.hasAttribute("hidden"),
    ).toBe(false);

    hud.update(
      state(1, [
        { health: 1000, power: 0 },
        { health: 1000, power: 0 },
      ]),
      progress(3, [0, 0]),
    );

    expect(
      hud.element.querySelector(".hud__error")?.hasAttribute("hidden"),
    ).toBe(true);
    expect(
      hud.element.querySelector(".hud__content")?.hasAttribute("hidden"),
    ).toBe(false);
  });

  describe("live locale switching (backlog item 009)", () => {
    afterEach(async () => {
      const instance = await initAppI18n();
      await instance.changeLanguage("en");
      window.localStorage.clear();
    });

    it("re-translates the round label in place without losing bar values", async () => {
      const instance = await initAppI18n();
      await instance.changeLanguage("en");
      const hud = createHud();
      hud.update(
        state(2, [
          { health: 700, power: 0 },
          { health: 900, power: 0 },
        ]),
        progress(3, [1, 0]),
      );
      const englishLabel =
        hud.element.querySelector(".hud__round")?.textContent;

      await instance.changeLanguage("fr");
      await vi.waitFor(() => {
        expect(hud.element.querySelector(".hud__round")?.textContent).not.toBe(
          englishLabel,
        );
      });
      const frenchLabel = hud.element.querySelector(".hud__round")?.textContent;
      expect(frenchLabel).toContain("2");
      expect(frenchLabel).toContain("3");
      const p1Health = hud.element.querySelector(".hud__health--1");
      expect(p1Health?.getAttribute("aria-valuenow")).toBe("700");
      hud.dispose();
    });

    it("stops re-translating after dispose()", async () => {
      const instance = await initAppI18n();
      await instance.changeLanguage("en");
      const hud = createHud();
      hud.update(
        state(1, [
          { health: 1000, power: 0 },
          { health: 1000, power: 0 },
        ]),
        progress(1, [0, 0]),
      );
      const before = hud.element.querySelector(".hud__round")?.textContent;

      hud.dispose();
      await instance.changeLanguage("fr");
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(hud.element.querySelector(".hud__round")?.textContent).toBe(
        before,
      );
    });
  });
});
