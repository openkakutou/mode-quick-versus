import "@openkakutou/web-ui-kit";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DiscoveredCharacter } from "../roster/discovery.ts";
import { renderRosterScreen } from "./roster-screen.ts";

const ryu: DiscoveredCharacter = {
  id: "ryu",
  portrait: "roster/ryu/portrait.png",
  status: "ok",
  name: "Ryu",
};
const kyo: DiscoveredCharacter = {
  id: "kyo",
  portrait: "roster/kyo/portrait.png",
  status: "ok",
  name: "Kyo",
};
const broken: DiscoveredCharacter = {
  id: "broken",
  portrait: "roster/broken/portrait.png",
  status: "error",
  message: "cns: line 3: malformed section header",
};

function cardFor(root: HTMLElement, id: string): HTMLElement {
  const portrait = root.querySelector<HTMLImageElement>(
    `img[src="roster/${id}/portrait.png"]`,
  );
  const card = portrait?.closest("wuik-panel");
  if (!card) throw new Error(`card for ${id} not found`);
  return card as HTMLElement;
}

function player1ButtonFor(root: HTMLElement, id: string): HTMLElement {
  const button = cardFor(root, id).querySelector<HTMLElement>(
    ".roster-screen__pick--p1",
  );
  if (!button) throw new Error(`player 1 button for ${id} not found`);
  return button;
}

function player2ButtonFor(root: HTMLElement, id: string): HTMLElement {
  const button = cardFor(root, id).querySelector<HTMLElement>(
    ".roster-screen__pick--p2",
  );
  if (!button) throw new Error(`player 2 button for ${id} not found`);
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

describe("renderRosterScreen", () => {
  it("displays every character's name and portrait", () => {
    renderRosterScreen(root, [ryu, kyo], { onContinue: vi.fn() });

    expect(cardFor(root, "ryu").textContent).toContain("Ryu");
    expect(cardFor(root, "kyo").textContent).toContain("Kyo");
  });

  it("shows an empty-state message instead of a blank grid when the roster has no entries", () => {
    renderRosterScreen(root, [], { onContinue: vi.fn() });

    expect(root.textContent).toContain("No characters are available");
    expect(root.querySelector(".roster-screen__grid")).toBeNull();
  });

  it("shows a character that failed to load as a visible, non-interactive error card", () => {
    renderRosterScreen(root, [ryu, broken], { onContinue: vi.fn() });

    const card = cardFor(root, "broken");
    expect(card.getAttribute("aria-disabled")).toBe("true");
    expect(card.textContent).toContain("cns: line 3: malformed section header");
    expect(card.querySelector(".roster-screen__pick--p1")).toBeNull();
    expect(card.querySelector(".roster-screen__pick--p2")).toBeNull();
  });

  it("keeps Continue disabled until both players have picked", () => {
    renderRosterScreen(root, [ryu, kyo], { onContinue: vi.fn() });
    const continueEl = continueButton(root);
    expect(continueEl.hasAttribute("disabled")).toBe(true);

    player1ButtonFor(root, "ryu").click();
    expect(continueEl.hasAttribute("disabled")).toBe(true);

    player2ButtonFor(root, "kyo").click();
    expect(continueEl.hasAttribute("disabled")).toBe(false);
  });

  it("lets each player pick independently, without affecting the other player's pick", () => {
    renderRosterScreen(root, [ryu, kyo], { onContinue: vi.fn() });

    player1ButtonFor(root, "ryu").click();
    player2ButtonFor(root, "kyo").click();
    // Player 2 changes their mind.
    player2ButtonFor(root, "ryu").click();

    expect(player1ButtonFor(root, "ryu").getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(player2ButtonFor(root, "ryu").getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(player2ButtonFor(root, "kyo").getAttribute("aria-pressed")).toBe(
      "false",
    );
  });

  it("allows both players to pick the same character (mirror match) without error", () => {
    renderRosterScreen(root, [ryu, kyo], { onContinue: vi.fn() });

    player1ButtonFor(root, "ryu").click();
    player2ButtonFor(root, "ryu").click();

    expect(player1ButtonFor(root, "ryu").getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(player2ButtonFor(root, "ryu").getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(continueButton(root).hasAttribute("disabled")).toBe(false);
  });

  it("calls onContinue with both players' picks once Continue is activated", () => {
    const onContinue = vi.fn();
    renderRosterScreen(root, [ryu, kyo], { onContinue });

    player1ButtonFor(root, "ryu").click();
    player2ButtonFor(root, "kyo").click();
    continueButton(root).click();

    expect(onContinue).toHaveBeenCalledExactlyOnceWith("ryu", "kyo");
  });

  it("does not call onContinue when Continue is activated before both players have picked", () => {
    const onContinue = vi.fn();
    renderRosterScreen(root, [ryu, kyo], { onContinue });

    player1ButtonFor(root, "ryu").click();
    continueButton(root).click();

    expect(onContinue).not.toHaveBeenCalled();
  });

  it("replaces previous content instead of appending on repeated renders", () => {
    renderRosterScreen(root, [ryu, kyo], { onContinue: vi.fn() });
    renderRosterScreen(root, [ryu], { onContinue: vi.fn() });

    expect(root.querySelectorAll(".roster-screen__grid")).toHaveLength(1);
    expect(root.querySelector(`img[src="roster/kyo/portrait.png"]`)).toBeNull();
  });
});
