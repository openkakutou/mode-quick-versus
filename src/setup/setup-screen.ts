// Renders the match setup screen — the last screen before handing off to
// the (not yet built) in-match HUD/rendering/input — where the two local
// players jointly configure round count and per-round time limit, the
// screen described by backlog item 003. See
// .vibe/decisions/003-match-setup-screen-design.md for why this reuses the
// stage screen's radiogroup-button idiom twice (once per field) rather than
// introducing a new input pattern, and why "unlimited" is modeled as a
// first-class tagged value rather than a numeric sentinel.

/** A configured time limit: a fixed duration in seconds, or no timer at all. */
export type TimeLimitOption = { readonly seconds: number } | "unlimited";

/** The values carried forward once both fields are chosen and Continue is activated. */
export interface MatchSetupConfig {
  rounds: number;
  timeLimit: TimeLimitOption;
}

export interface SetupScreenOptions {
  /** Selectable round counts. Defaults to `[1, 3, 5]`. Each must be a positive odd integer. */
  roundOptions?: readonly number[];
  /**
   * Selectable time limits. Defaults to 60s, 99s, and unlimited. Each
   * numeric option must be a positive integer number of seconds.
   */
  timeLimitOptions?: readonly TimeLimitOption[];
  /** Called once both fields have a selection and Continue is activated. */
  onContinue: (config: MatchSetupConfig) => void;
}

const DEFAULT_ROUND_OPTIONS: readonly number[] = [1, 3, 5];
const DEFAULT_TIME_LIMIT_OPTIONS: readonly TimeLimitOption[] = [
  { seconds: 60 },
  { seconds: 99 },
  "unlimited",
];

/** A positive, odd integer — the only shape a round count is ever valid as. */
export function isValidRoundCount(value: number): boolean {
  return Number.isInteger(value) && value > 0 && value % 2 === 1;
}

/** Either the "unlimited" tag, or a positive integer number of seconds. */
export function isValidTimeLimitOption(value: TimeLimitOption): boolean {
  if (value === "unlimited") return true;
  return Number.isInteger(value.seconds) && value.seconds > 0;
}

function timeLimitLabel(value: TimeLimitOption): string {
  return value === "unlimited" ? "Unlimited" : `${value.seconds}s`;
}

/**
 * Renders the setup screen into `root`, replacing its previous content. A
 * misconfigured option set (an invalid round count or time limit passed by
 * the caller) renders a blocking, named error state instead of silently
 * dropping or clamping the bad value — this is a developer/configuration
 * error, never a value a player can produce through the UI.
 */
export function renderSetupScreen(
  root: HTMLElement,
  options: SetupScreenOptions,
): void {
  root.replaceChildren();

  const roundOptions = options.roundOptions ?? DEFAULT_ROUND_OPTIONS;
  const timeLimitOptions =
    options.timeLimitOptions ?? DEFAULT_TIME_LIMIT_OPTIONS;

  const invalidRoundOption = roundOptions.find(
    (value) => !isValidRoundCount(value),
  );
  if (invalidRoundOption !== undefined) {
    root.appendChild(
      buildErrorState(
        `Invalid round count option: ${invalidRoundOption}. Round counts must be positive odd integers.`,
      ),
    );
    return;
  }

  const invalidTimeLimitOption = timeLimitOptions.find(
    (value) => !isValidTimeLimitOption(value),
  );
  if (invalidTimeLimitOption !== undefined) {
    root.appendChild(
      buildErrorState(
        `Invalid time limit option: ${timeLimitLabel(invalidTimeLimitOption)}. Time limits must be a positive number of seconds, or "unlimited".`,
      ),
    );
    return;
  }

  let selectedRounds: number | null = null;
  let selectedTimeLimit: TimeLimitOption | null = null;
  const roundButtonsByValue = new Map<number, HTMLElement>();
  const timeButtonsByLabel = new Map<string, HTMLElement>();

  const continueButton = document.createElement("wuik-button");
  continueButton.textContent = "Continue";
  continueButton.setAttribute("disabled", "");
  continueButton.addEventListener("click", () => {
    if (selectedRounds === null || selectedTimeLimit === null) return;
    options.onContinue({
      rounds: selectedRounds,
      timeLimit: selectedTimeLimit,
    });
  });

  function syncContinueState(): void {
    if (selectedRounds !== null && selectedTimeLimit !== null) {
      continueButton.removeAttribute("disabled");
    } else {
      continueButton.setAttribute("disabled", "");
    }
  }

  // Re-selecting the current choice is a no-op, same convention as the
  // stage screen — neither field ever returns to "unselected" once picked.
  function selectRounds(value: number): void {
    selectedRounds = value;
    for (const [optionValue, button] of roundButtonsByValue) {
      setSelected(button, optionValue === value);
    }
    syncContinueState();
  }

  function selectTimeLimit(value: TimeLimitOption): void {
    selectedTimeLimit = value;
    const label = timeLimitLabel(value);
    for (const [optionLabel, button] of timeButtonsByLabel) {
      setSelected(button, optionLabel === label);
    }
    syncContinueState();
  }

  const roundsHeadingId = "setup-screen-rounds-heading";
  const roundsHeading = document.createElement("h2");
  roundsHeading.id = roundsHeadingId;
  roundsHeading.textContent = "Round Count";

  const roundsGroup = document.createElement("div");
  roundsGroup.className = "setup-screen__grid";
  roundsGroup.setAttribute("role", "radiogroup");
  roundsGroup.setAttribute("aria-labelledby", roundsHeadingId);

  for (const value of roundOptions) {
    const button = document.createElement("wuik-button");
    button.setAttribute("variant", "secondary");
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", "false");
    button.className = "setup-screen__round-select";
    button.dataset.value = String(value);
    button.textContent = `${value} Round${value === 1 ? "" : "s"}`;
    button.addEventListener("click", () => selectRounds(value));
    roundButtonsByValue.set(value, button);
    roundsGroup.appendChild(button);
  }

  const timeHeadingId = "setup-screen-time-heading";
  const timeHeading = document.createElement("h2");
  timeHeading.id = timeHeadingId;
  timeHeading.textContent = "Time Limit";

  const timeGroup = document.createElement("div");
  timeGroup.className = "setup-screen__grid";
  timeGroup.setAttribute("role", "radiogroup");
  timeGroup.setAttribute("aria-labelledby", timeHeadingId);

  for (const value of timeLimitOptions) {
    const label = timeLimitLabel(value);
    const button = document.createElement("wuik-button");
    button.setAttribute("variant", "secondary");
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", "false");
    button.className = "setup-screen__time-select";
    button.dataset.label = label;
    button.textContent = label;
    button.addEventListener("click", () => selectTimeLimit(value));
    timeButtonsByLabel.set(label, button);
    timeGroup.appendChild(button);
  }

  const panel = document.createElement("wuik-panel");
  panel.className = "setup-screen";

  const heading = document.createElement("h1");
  heading.textContent = "Match Setup";
  panel.appendChild(heading);

  const roundsSection = document.createElement("section");
  roundsSection.appendChild(roundsHeading);
  roundsSection.appendChild(roundsGroup);
  panel.appendChild(roundsSection);

  const timeSection = document.createElement("section");
  timeSection.appendChild(timeHeading);
  timeSection.appendChild(timeGroup);
  panel.appendChild(timeSection);

  panel.appendChild(continueButton);

  root.appendChild(panel);
}

function buildErrorState(message: string): HTMLElement {
  const panel = document.createElement("wuik-panel");
  panel.className = "setup-screen__error";
  const text = document.createElement("p");
  text.textContent = message;
  panel.appendChild(text);
  return panel;
}

function setSelected(button: HTMLElement, selected: boolean): void {
  button.setAttribute("variant", selected ? "primary" : "secondary");
  button.setAttribute("aria-checked", String(selected));
}
