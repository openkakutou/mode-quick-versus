// Builds and updates the round/match result overlay shown on top of the
// frozen last match frame (backlog item 007): a round result auto-advances
// after a fixed delay with a visible countdown -- it isn't a decision, so
// no button is asked for -- while a match result presents exactly two
// explicit actions (rematch / back to select), never both stacked, never a
// third silent path back into the still-running canvas. See
// `.vibe/decisions/010-round-match-result-and-cpu-opponent-design.md`.
//
// Plain DOM, built once by `createResultOverlay()` and mutated in place by
// `showRoundResult`/`showMatchResult`/`hide` -- matching this project's
// no-per-frame-allocation/create-once convention (`hud/hud-renderer.ts`).
// The one-shot outcome line is announced via a dedicated `aria-live`
// region; the countdown text is deliberately *not* live, so it never spams
// assistive tech once per second (the same restraint `.vibe/decisions/009`
// already applies to the HUD's own per-frame updates).
import { onLocaleChange, t } from "../i18n/i18n.ts";
import type { MatchEndView, OutcomeWinner, RoundEndView } from "./outcome.ts";

/** How long a round result stays up before automatically continuing to the next round. */
export const DEFAULT_ROUND_RESULT_DELAY_MS = 3000;

export interface ResultOverlayOptions {
  /** Called exactly once, after the countdown reaches zero, so the caller can reset for the next round (e.g. call `resetRound`). Never called after `hide()`/`dispose()` cancels the pending countdown. */
  onRoundResultDone: () => void;
  /** Called when the player activates "Rematch" on the match result. */
  onRematch: () => void;
  /** Called when the player activates "Back to select" on the match result. */
  onBackToSelect: () => void;
  /** How long a round result stays up before `onRoundResultDone` fires. Defaults to `DEFAULT_ROUND_RESULT_DELAY_MS`. */
  roundResultDelayMs?: number;
}

export interface ResultOverlay {
  /** The overlay's root element -- the caller decides where to mount it (see `rendering/match-renderer.ts`). Hidden until `showRoundResult`/`showMatchResult` is called. */
  element: HTMLElement;
  /** Shows a round result and starts its auto-advance countdown. Replaces any previously shown result/countdown. */
  showRoundResult(view: RoundEndView): void;
  /** Shows a match result with its Rematch / Back to select actions. Cancels any pending round-result countdown. */
  showMatchResult(view: MatchEndView): void;
  /** Hides the overlay and cancels any pending round-result countdown, so a stale timer can never fire once the caller has moved on. */
  hide(): void;
  /** Cancels any pending countdown and releases this overlay's locale-change subscription. Call once when the match scene is torn down. */
  dispose(): void;
}

type ShownState =
  | { kind: "round"; view: RoundEndView; secondsLeft: number }
  | { kind: "match"; view: MatchEndView }
  | null;

function winnerLabel(winner: OutcomeWinner): string {
  if (winner === "p1") return "1";
  if (winner === "p2") return "2";
  return "";
}

export function createResultOverlay(
  options: ResultOverlayOptions,
): ResultOverlay {
  const delayMs = options.roundResultDelayMs ?? DEFAULT_ROUND_RESULT_DELAY_MS;

  const element = document.createElement("div");
  element.className = "result-overlay";
  element.setAttribute("hidden", "");

  const panel = document.createElement("wuik-panel");
  panel.className = "result-overlay__panel";
  element.appendChild(panel);

  const outcomeText = document.createElement("p");
  outcomeText.className = "result-overlay__outcome";
  outcomeText.setAttribute("aria-live", "polite");
  panel.appendChild(outcomeText);

  const countdownText = document.createElement("p");
  countdownText.className = "result-overlay__countdown";
  countdownText.hidden = true;
  panel.appendChild(countdownText);

  const actions = document.createElement("div");
  actions.className = "result-overlay__actions";
  actions.hidden = true;
  panel.appendChild(actions);

  const rematchButton = document.createElement("wuik-button");
  rematchButton.className = "result-overlay__rematch";
  rematchButton.addEventListener("click", () => options.onRematch());
  actions.appendChild(rematchButton);

  const backButton = document.createElement("wuik-button");
  backButton.className = "result-overlay__back";
  backButton.addEventListener("click", () => options.onBackToSelect());
  actions.appendChild(backButton);

  let shown: ShownState = null;
  let intervalHandle: ReturnType<typeof setInterval> | null = null;

  function clearCountdown(): void {
    if (intervalHandle !== null) {
      clearInterval(intervalHandle);
      intervalHandle = null;
    }
  }

  function renderRoundText(view: RoundEndView): void {
    outcomeText.textContent =
      view.winner === "draw"
        ? t("result.roundDraw", "Round {{round}}: Draw!", {
            round: String(view.round),
          })
        : t("result.roundWinner", "Round {{round}}: Player {{number}} wins!", {
            round: String(view.round),
            number: winnerLabel(view.winner),
          });
  }

  function renderCountdownText(secondsLeft: number): void {
    countdownText.textContent = t(
      "result.continuingIn",
      "Next round in {{seconds}}…",
      { seconds: String(secondsLeft) },
    );
  }

  function renderMatchText(view: MatchEndView): void {
    outcomeText.textContent =
      view.winner === "draw"
        ? t("result.matchDraw", "The match ends in a draw!")
        : t("result.matchWinner", "Player {{number}} wins the match!", {
            number: winnerLabel(view.winner),
          });
    rematchButton.textContent = t("result.rematch", "Rematch");
    backButton.textContent = t("result.backToSelect", "Back to select");
  }

  function showRoundResult(view: RoundEndView): void {
    clearCountdown();
    element.className = "result-overlay result-overlay--round";
    element.removeAttribute("hidden");
    countdownText.hidden = false;
    actions.hidden = true;

    renderRoundText(view);
    let secondsLeft = Math.ceil(delayMs / 1000);
    renderCountdownText(secondsLeft);
    shown = { kind: "round", view, secondsLeft };

    intervalHandle = setInterval(() => {
      secondsLeft -= 1;
      if (secondsLeft <= 0) {
        clearCountdown();
        options.onRoundResultDone();
        return;
      }
      renderCountdownText(secondsLeft);
      if (shown?.kind === "round") shown = { ...shown, secondsLeft };
    }, 1000);
  }

  function showMatchResult(view: MatchEndView): void {
    clearCountdown();
    element.className = "result-overlay result-overlay--match";
    element.removeAttribute("hidden");
    countdownText.hidden = true;
    actions.hidden = false;

    renderMatchText(view);
    shown = { kind: "match", view };
  }

  function hide(): void {
    clearCountdown();
    element.setAttribute("hidden", "");
    shown = null;
  }

  const unsubscribe = onLocaleChange(() => {
    if (shown?.kind === "round") {
      renderRoundText(shown.view);
      renderCountdownText(shown.secondsLeft);
    } else if (shown?.kind === "match") {
      renderMatchText(shown.view);
    }
  });

  return {
    element,
    showRoundResult,
    showMatchResult,
    hide,
    dispose(): void {
      clearCountdown();
      unsubscribe();
    },
  };
}
