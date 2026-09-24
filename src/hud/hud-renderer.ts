// Builds and updates the in-match HUD: a lifebar and power bar per player,
// plus the round display (round number, each player's round wins, best-of).
// Plain DOM (not drawn on the game canvas), built once by `createHud()` and
// mutated in place by `update()` -- no `createElement`/`appendChild` on the
// update path, matching this project's no-per-frame-allocation rendering
// discipline (see `.vibe/decisions/009`). `update()` never throws: a
// malformed/unexpected `state`/`progress` payload swaps the whole HUD into
// one shared, translated error region instead of a broken bar, a frozen
// display, or a crash -- match simulation/rendering elsewhere is untouched
// by a HUD-only error (backlog item 004's acceptance criteria).
import { onLocaleChange, t } from "../i18n/i18n.ts";
import { DEFAULT_HEALTH, MAX_POWER } from "../rendering/match-config.ts";
import {
  type HudRoundView,
  type HudViewModel,
  deriveHudViewModel,
} from "./hud-view-model.ts";

export interface HudOptions {
  /** The health value that reads as a 100% full lifebar. Defaults to `match-config.ts`'s `DEFAULT_HEALTH` placeholder. */
  maxHealth?: number;
  /** The power value that reads as a 100% full power bar. Defaults to this module's `MAX_POWER` placeholder, mirroring `engine`'s own hardcoded cap. */
  maxPower?: number;
}

export interface Hud {
  /** The HUD's root element -- the caller decides where to mount it (see `rendering/match-renderer.ts`). */
  element: HTMLElement;
  /**
   * Applies one rendered frame's live match state/progress. Never throws:
   * an invalid payload swaps the whole HUD into its error region instead of
   * partially updating (see `.vibe/decisions/009` for why the HUD degrades
   * as one unit, not per field).
   */
  update(state: unknown, progress: unknown): void;
  /** Releases this HUD's locale-change subscription. Call once when the match scene is torn down. */
  dispose(): void;
}

interface PlayerBarElements {
  wins: HTMLElement;
  health: HTMLElement;
  healthFill: HTMLElement;
  healthValueText: HTMLElement;
  power: HTMLElement;
  powerFill: HTMLElement;
  powerValueText: HTMLElement;
}

function buildPlayerColumn(index: 0 | 1): {
  element: HTMLElement;
  bars: PlayerBarElements;
} {
  const playerNumber = index + 1;
  const column = document.createElement("div");
  column.className = `hud__player hud__player--${playerNumber}`;

  const wins = document.createElement("p");
  wins.className = "hud__wins";
  column.appendChild(wins);

  function buildBar(kind: "health" | "power"): {
    bar: HTMLElement;
    fill: HTMLElement;
    valueText: HTMLElement;
  } {
    const bar = document.createElement("div");
    bar.className = `hud__${kind} hud__${kind}--${playerNumber}`;
    bar.setAttribute("role", "progressbar");
    bar.setAttribute("aria-valuemin", "0");

    const fill = document.createElement("div");
    fill.className = `hud__${kind}-fill hud__${kind}-fill--${playerNumber}`;
    bar.appendChild(fill);

    const valueText = document.createElement("span");
    valueText.className = "hud__value-text";
    bar.appendChild(valueText);

    column.appendChild(bar);
    return { bar, fill, valueText };
  }

  const health = buildBar("health");
  const power = buildBar("power");

  return {
    element: column,
    bars: {
      wins,
      health: health.bar,
      healthFill: health.fill,
      healthValueText: health.valueText,
      power: power.bar,
      powerFill: power.fill,
      powerValueText: power.valueText,
    },
  };
}

function roundInfoEqual(a: HudRoundView, b: HudRoundView): boolean {
  return (
    a.round === b.round && a.wins[0] === b.wins[0] && a.wins[1] === b.wins[1]
  );
}

/**
 * Builds a new HUD. Nothing is mounted anywhere yet -- the caller appends
 * `element` wherever it belongs (see `rendering/match-renderer.ts`'s
 * `renderMatch`).
 */
export function createHud(options: HudOptions = {}): Hud {
  const maxHealth = options.maxHealth ?? DEFAULT_HEALTH;
  const maxPower = options.maxPower ?? MAX_POWER;

  const element = document.createElement("div");
  element.className = "hud";

  const content = document.createElement("div");
  content.className = "hud__content";
  element.appendChild(content);

  const player1 = buildPlayerColumn(0);
  content.appendChild(player1.element);

  const round = document.createElement("div");
  round.className = "hud__round";
  const roundText = document.createElement("p");
  round.appendChild(roundText);
  content.appendChild(round);

  const player2 = buildPlayerColumn(1);
  content.appendChild(player2.element);

  const players: [PlayerBarElements, PlayerBarElements] = [
    player1.bars,
    player2.bars,
  ];

  const announcement = document.createElement("p");
  announcement.className = "hud__announcement";
  announcement.setAttribute("aria-live", "polite");
  element.appendChild(announcement);

  const errorRegion = document.createElement("p");
  errorRegion.className = "hud__error";
  errorRegion.setAttribute("hidden", "");
  element.appendChild(errorRegion);

  let lastValid: HudViewModel | null = null;
  let lastRawHealth: [number, number] | null = null;
  let lastAnnouncedRoundInfo: HudRoundView | null = null;
  let lastError: string | null = null;

  function setBarLabels(): void {
    players[0].health.setAttribute(
      "aria-label",
      t("hud.playerHealth", "Player {{number}} health", { number: "1" }),
    );
    players[1].health.setAttribute(
      "aria-label",
      t("hud.playerHealth", "Player {{number}} health", { number: "2" }),
    );
    players[0].power.setAttribute(
      "aria-label",
      t("hud.playerPower", "Player {{number}} power", { number: "1" }),
    );
    players[1].power.setAttribute(
      "aria-label",
      t("hud.playerPower", "Player {{number}} power", { number: "2" }),
    );
  }
  setBarLabels();

  function renderBar(
    bar: PlayerBarElements["health"],
    fill: HTMLElement,
    valueText: HTMLElement,
    value: number,
    max: number,
    percent: number,
  ): void {
    bar.setAttribute("aria-valuemax", String(max));
    bar.setAttribute("aria-valuenow", String(value));
    const text = t("hud.valueOfMax", "{{value}} / {{max}}", {
      value: String(value),
      max: String(max),
    });
    bar.setAttribute("aria-valuetext", text);
    fill.style.width = `${percent}%`;
    valueText.textContent = text;
  }

  function renderRoundText(info: HudRoundView): void {
    roundText.textContent = t(
      "hud.roundInfo",
      "Round {{round}} · Best of {{bestOf}}",
      { round: String(info.round), bestOf: String(info.bestOf) },
    );
    players[0].wins.textContent = t("hud.wins", "Wins: {{count}}", {
      count: String(info.wins[0]),
    });
    players[1].wins.textContent = t("hud.wins", "Wins: {{count}}", {
      count: String(info.wins[1]),
    });
  }

  function renderValid(data: HudViewModel, rawHealth: [number, number]): void {
    content.removeAttribute("hidden");
    errorRegion.setAttribute("hidden", "");

    renderBar(
      players[0].health,
      players[0].healthFill,
      players[0].healthValueText,
      rawHealth[0],
      maxHealth,
      data.fighters[0].healthPercent,
    );
    renderBar(
      players[1].health,
      players[1].healthFill,
      players[1].healthValueText,
      rawHealth[1],
      maxHealth,
      data.fighters[1].healthPercent,
    );
    renderPowerBars(data);
    renderRoundText(data.roundInfo);

    if (
      !lastAnnouncedRoundInfo ||
      !roundInfoEqual(lastAnnouncedRoundInfo, data.roundInfo)
    ) {
      announcement.textContent = t(
        "hud.roundAnnouncement",
        "Round {{round}} started. {{p1Wins}} - {{p2Wins}}.",
        {
          round: String(data.roundInfo.round),
          p1Wins: String(data.roundInfo.wins[0]),
          p2Wins: String(data.roundInfo.wins[1]),
        },
      );
      lastAnnouncedRoundInfo = data.roundInfo;
    }

    lastValid = data;
    lastRawHealth = rawHealth;
    lastError = null;
  }

  function renderPowerBars(data: HudViewModel): void {
    // Power's own raw value isn't threaded separately (unlike health, which
    // renderValid's caller carries alongside the view model for its
    // aria-valuenow/value text) -- recomputed here from the percent since
    // renderBar needs a displayable raw number; percent->value is exact for
    // power because deriveHudViewModel's own clampPercent is a plain ratio
    // below 100%, and power display above the cap is expected to read as
    // the cap itself (a clamped display, not a fabricated overflow number).
    const p1Power = Math.round(
      (data.fighters[0].powerPercent / 100) * maxPower,
    );
    const p2Power = Math.round(
      (data.fighters[1].powerPercent / 100) * maxPower,
    );
    renderBar(
      players[0].power,
      players[0].powerFill,
      players[0].powerValueText,
      p1Power,
      maxPower,
      data.fighters[0].powerPercent,
    );
    renderBar(
      players[1].power,
      players[1].powerFill,
      players[1].powerValueText,
      p2Power,
      maxPower,
      data.fighters[1].powerPercent,
    );
  }

  function renderError(message: string): void {
    content.setAttribute("hidden", "");
    errorRegion.removeAttribute("hidden");
    errorRegion.textContent = t(
      "hud.error",
      "The match display could not be updated: {{error}}",
      { error: message },
    );
    lastError = message;
  }

  function update(state: unknown, progress: unknown): void {
    const result = deriveHudViewModel(state, progress, maxHealth, maxPower);
    if (!result.ok) {
      renderError(result.error);
      return;
    }
    // Threading the raw (unclamped-by-percent) health values through
    // separately from the view model: HudFighterView only ever carries the
    // *percentage*, but the bar's own aria-valuenow/value text want the
    // real underlying number for an accurate "800 / 1000" readout.
    const stateRecord = state as {
      fighters: [{ health: number }, { health: number }];
    };
    renderValid(result.data, [
      stateRecord.fighters[0].health,
      stateRecord.fighters[1].health,
    ]);
  }

  const unsubscribe = onLocaleChange(() => {
    setBarLabels();
    if (lastValid && lastRawHealth) {
      // Value-text/aria-valuetext strings depend on t(), so they also need
      // a fresh render on locale change -- re-running the same bar render
      // calls with the last known values, not a re-derivation (no new
      // engine data arrived).
      renderBar(
        players[0].health,
        players[0].healthFill,
        players[0].healthValueText,
        lastRawHealth[0],
        maxHealth,
        lastValid.fighters[0].healthPercent,
      );
      renderBar(
        players[1].health,
        players[1].healthFill,
        players[1].healthValueText,
        lastRawHealth[1],
        maxHealth,
        lastValid.fighters[1].healthPercent,
      );
      renderPowerBars(lastValid);
      renderRoundText(lastValid.roundInfo);
    } else if (lastError !== null) {
      renderError(lastError);
    }
  });

  return {
    element,
    update,
    dispose: unsubscribe,
  };
}
