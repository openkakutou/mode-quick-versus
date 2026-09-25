import { onLocaleChange, t } from "../i18n/i18n.ts";
// Renders the match setup screen — the last screen before handing off to
// the (not yet built) in-match HUD) and match rendering/input, where the
// two local players jointly configure round count and per-round time
// limit, the screen described by backlog item 003. See
// .vibe/decisions/003-match-setup-screen-design.md for why this reuses the
// stage screen's radiogroup-button idiom twice (once per field) rather than
// introducing a new input pattern, and why "unlimited" is modeled as a
// first-class tagged value rather than a numeric sentinel. The Controls
// section (backlog item 006) is this project's only player-facing surface
// for the default keyboard/gamepad bindings — see
// `.vibe/decisions/005-input-routing-design.md`.
//
// UI text is localized (backlog item 009, see
// .vibe/decisions/006-i18n-integration-approach.md): this screen holds
// in-progress, not-yet-submitted round/time picks in local closures that a
// full re-render from scratch would destroy, so it subscribes to
// `onLocaleChange` internally and re-translates only its already-rendered
// text in place. The physical key/button names shown in the Controls
// section (`keyLabel(key)`, button names) are never translated — they name
// a physical input, not a described action.
import {
  BUTTON_NAMES,
  DEFAULT_KEYBOARD_BINDINGS,
  keyLabel,
} from "../input/key-bindings.ts";

/** A configured time limit: a fixed duration in seconds, or no timer at all. */
export type TimeLimitOption = { readonly seconds: number } | "unlimited";

/**
 * Who drives player 2 during the match: a second local human, or the
 * minimal CPU opponent (backlog item 007). Pre-selected to `"human"` by
 * default (see the Player 2 Control section below) rather than left
 * unselected like the round-count/time-limit fields, so the existing
 * two-human flow needs no extra click and Continue's gating never depends
 * on this field being touched. See
 * `.vibe/decisions/010-round-match-result-and-cpu-opponent-design.md`.
 */
export type PlayerTwoControl = "human" | "cpu";

/** The values carried forward once both required fields are chosen and Continue is activated. */
export interface MatchSetupConfig {
  rounds: number;
  timeLimit: TimeLimitOption;
  player2Control: PlayerTwoControl;
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

/** Stops the previous render call's locale-change subscription for a given
 * root before a new render replaces its content — same convention
 * `selection/roster-screen.ts` and `selection/stage-screen.ts` use. */
const activeUnsubscribeByRoot = new WeakMap<HTMLElement, () => void>();

/** A positive, odd integer — the only shape a round count is ever valid as. */
export function isValidRoundCount(value: number): boolean {
  return Number.isInteger(value) && value > 0 && value % 2 === 1;
}

/** Either the "unlimited" tag, or a positive integer number of seconds. */
export function isValidTimeLimitOption(value: TimeLimitOption): boolean {
  if (value === "unlimited") return true;
  return Number.isInteger(value.seconds) && value.seconds > 0;
}

/**
 * A stable, untranslated identifier for a time limit option, used only as
 * an internal lookup key (`dataset.label`, the selection map) — never
 * shown to the user. The *displayed* label is produced separately by
 * `timeLimitDisplayLabel`, which goes through `t()`.
 */
function timeLimitKey(value: TimeLimitOption): string {
  return value === "unlimited" ? "Unlimited" : `${value.seconds}s`;
}

function timeLimitDisplayLabel(value: TimeLimitOption): string {
  return value === "unlimited"
    ? t("setup.timeLimitUnlimited", "Unlimited")
    : t("setup.timeLimitSeconds", "{{seconds}}s", {
        seconds: String(value.seconds),
      });
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
  activeUnsubscribeByRoot.get(root)?.();
  activeUnsubscribeByRoot.delete(root);
  root.replaceChildren();

  const roundOptions = options.roundOptions ?? DEFAULT_ROUND_OPTIONS;
  const timeLimitOptions =
    options.timeLimitOptions ?? DEFAULT_TIME_LIMIT_OPTIONS;

  const invalidRoundOption = roundOptions.find(
    (value) => !isValidRoundCount(value),
  );
  if (invalidRoundOption !== undefined) {
    const errorState = buildErrorState(() =>
      t(
        "setup.invalidRoundOption",
        "Invalid round count option: {{value}}. Round counts must be positive odd integers.",
        { value: String(invalidRoundOption) },
      ),
    );
    root.appendChild(errorState.element);
    activeUnsubscribeByRoot.set(root, onLocaleChange(errorState.retranslate));
    return;
  }

  const invalidTimeLimitOption = timeLimitOptions.find(
    (value) => !isValidTimeLimitOption(value),
  );
  if (invalidTimeLimitOption !== undefined) {
    const errorState = buildErrorState(() =>
      t(
        "setup.invalidTimeLimitOption",
        'Invalid time limit option: {{value}}. Time limits must be a positive number of seconds, or "unlimited".',
        { value: timeLimitKey(invalidTimeLimitOption) },
      ),
    );
    root.appendChild(errorState.element);
    activeUnsubscribeByRoot.set(root, onLocaleChange(errorState.retranslate));
    return;
  }

  let selectedRounds: number | null = null;
  let selectedTimeLimit: TimeLimitOption | null = null;
  // Pre-selected, unlike the two fields above: see `PlayerTwoControl`'s own
  // doc comment for why Continue's gating never depends on this field.
  let selectedPlayer2Control: PlayerTwoControl = "human";
  const roundButtonsByValue = new Map<number, HTMLElement>();
  const timeButtonsByKey = new Map<string, HTMLElement>();
  const player2ControlButtonsByValue = new Map<PlayerTwoControl, HTMLElement>();

  const continueButton = document.createElement("wuik-button");
  continueButton.textContent = t("setup.continue", "Continue");
  continueButton.setAttribute("disabled", "");
  continueButton.addEventListener("click", () => {
    if (selectedRounds === null || selectedTimeLimit === null) return;
    options.onContinue({
      rounds: selectedRounds,
      timeLimit: selectedTimeLimit,
      player2Control: selectedPlayer2Control,
    });
  });

  function syncContinueState(): void {
    if (selectedRounds !== null && selectedTimeLimit !== null) {
      continueButton.removeAttribute("disabled");
    } else {
      continueButton.setAttribute("disabled", "");
    }
  }

  function refreshRoundButtonLabels(): void {
    for (const [value, button] of roundButtonsByValue) {
      button.textContent = t("setup.roundsOption", "Rounds: {{value}}", {
        value: String(value),
      });
    }
  }

  function refreshTimeButtonLabels(): void {
    for (const value of timeLimitOptions) {
      const button = timeButtonsByKey.get(timeLimitKey(value));
      if (button) button.textContent = timeLimitDisplayLabel(value);
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
    const key = timeLimitKey(value);
    for (const [optionKey, button] of timeButtonsByKey) {
      setSelected(button, optionKey === key);
    }
    syncContinueState();
  }

  function selectPlayer2Control(value: PlayerTwoControl): void {
    if (selectedPlayer2Control === value) return;
    selectedPlayer2Control = value;
    for (const [optionValue, button] of player2ControlButtonsByValue) {
      setSelected(button, optionValue === value);
    }
    controls.setPlayer2Cpu(value === "cpu");
  }

  const roundsHeadingId = "setup-screen-rounds-heading";
  const roundsHeading = document.createElement("h2");
  roundsHeading.id = roundsHeadingId;
  roundsHeading.textContent = t("setup.roundsHeading", "Round Count");

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
    button.addEventListener("click", () => selectRounds(value));
    roundButtonsByValue.set(value, button);
    roundsGroup.appendChild(button);
  }
  refreshRoundButtonLabels();

  const timeHeadingId = "setup-screen-time-heading";
  const timeHeading = document.createElement("h2");
  timeHeading.id = timeHeadingId;
  timeHeading.textContent = t("setup.timeHeading", "Time Limit");

  const timeGroup = document.createElement("div");
  timeGroup.className = "setup-screen__grid";
  timeGroup.setAttribute("role", "radiogroup");
  timeGroup.setAttribute("aria-labelledby", timeHeadingId);

  for (const value of timeLimitOptions) {
    const key = timeLimitKey(value);
    const button = document.createElement("wuik-button");
    button.setAttribute("variant", "secondary");
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", "false");
    button.className = "setup-screen__time-select";
    button.dataset.label = key;
    button.addEventListener("click", () => selectTimeLimit(value));
    timeButtonsByKey.set(key, button);
    timeGroup.appendChild(button);
  }
  refreshTimeButtonLabels();

  const player2ControlHeadingId = "setup-screen-player2-control-heading";
  const player2ControlHeading = document.createElement("h2");
  player2ControlHeading.id = player2ControlHeadingId;

  const player2ControlGroup = document.createElement("div");
  player2ControlGroup.className = "setup-screen__grid";
  player2ControlGroup.setAttribute("role", "radiogroup");
  player2ControlGroup.setAttribute("aria-labelledby", player2ControlHeadingId);

  const player2ControlValues: readonly PlayerTwoControl[] = ["human", "cpu"];
  for (const value of player2ControlValues) {
    const button = document.createElement("wuik-button");
    button.setAttribute("variant", "secondary");
    button.setAttribute("role", "radio");
    button.className = "setup-screen__player2-control-select";
    button.dataset.value = value;
    button.addEventListener("click", () => selectPlayer2Control(value));
    player2ControlButtonsByValue.set(value, button);
    player2ControlGroup.appendChild(button);
  }

  function refreshPlayer2ControlLabels(): void {
    player2ControlHeading.textContent = t(
      "setup.player2ControlHeading",
      "Player 2 Control",
    );
    for (const [value, button] of player2ControlButtonsByValue) {
      button.textContent =
        value === "human"
          ? t("setup.player2ControlHuman", "Human")
          : t("setup.player2ControlCpu", "CPU");
    }
  }
  refreshPlayer2ControlLabels();
  // Pre-selected to Human, unlike the round-count/time-limit radiogroups
  // above -- see `PlayerTwoControl`'s own doc comment.
  for (const [value, button] of player2ControlButtonsByValue) {
    setSelected(button, value === selectedPlayer2Control);
  }

  const panel = document.createElement("wuik-panel");
  panel.className = "setup-screen";

  const heading = document.createElement("h1");
  heading.textContent = t("setup.heading", "Match Setup");
  panel.appendChild(heading);

  const roundsSection = document.createElement("section");
  roundsSection.appendChild(roundsHeading);
  roundsSection.appendChild(roundsGroup);
  panel.appendChild(roundsSection);

  const timeSection = document.createElement("section");
  timeSection.appendChild(timeHeading);
  timeSection.appendChild(timeGroup);
  panel.appendChild(timeSection);

  const player2ControlSection = document.createElement("section");
  player2ControlSection.appendChild(player2ControlHeading);
  player2ControlSection.appendChild(player2ControlGroup);
  panel.appendChild(player2ControlSection);

  const controls = buildControlsSection();
  panel.appendChild(controls.element);
  panel.appendChild(continueButton);

  root.appendChild(panel);

  function retranslate(): void {
    heading.textContent = t("setup.heading", "Match Setup");
    roundsHeading.textContent = t("setup.roundsHeading", "Round Count");
    timeHeading.textContent = t("setup.timeHeading", "Time Limit");
    continueButton.textContent = t("setup.continue", "Continue");
    refreshRoundButtonLabels();
    refreshTimeButtonLabels();
    refreshPlayer2ControlLabels();
    controls.retranslate();
  }

  activeUnsubscribeByRoot.set(root, onLocaleChange(retranslate));
}

/**
 * A read-only listing of both players' default keyboard bindings, plus a
 * note that a connected gamepad is used automatically and falls back to
 * keyboard if it disconnects — the discoverability acceptance criterion
 * backlog item 006 requires. No rebinding UI exists yet; only the current
 * default mapping is shown (see `.vibe/decisions/005`). The semantic
 * direction labels ("Up"/"Down"/"Left"/"Right") are translated; the actual
 * bound key/button names (`keyLabel(key)`, button names) are not -- they
 * name a physical input, not a described action.
 */
function buildControlsSection(): {
  element: HTMLElement;
  retranslate: () => void;
  /** Swaps player 2's own listing between its keyboard binding table and a plain "controlled automatically" note (backlog item 007's CPU opponent) — player 1's listing is never affected. */
  setPlayer2Cpu: (isCpu: boolean) => void;
} {
  const section = document.createElement("section");
  section.className = "setup-screen__controls";

  const heading = document.createElement("h2");
  heading.id = "setup-screen-controls-heading";
  section.appendChild(heading);

  const grid = document.createElement("div");
  grid.className = "setup-screen__controls-grid";
  grid.setAttribute("aria-labelledby", heading.id);

  const playerHeadings: HTMLElement[] = [];
  const directionLabelCells: {
    labelKey: string;
    defaultLabel: string;
    element: HTMLElement;
  }[] = [];
  let player2List!: HTMLElement;
  let player2CpuNote!: HTMLElement;
  let player2Cpu = false;

  DEFAULT_KEYBOARD_BINDINGS.forEach((binding, index) => {
    const playerSection = document.createElement("div");
    playerSection.className = "setup-screen__controls-player";

    const playerHeading = document.createElement("h3");
    playerSection.appendChild(playerHeading);
    playerHeadings.push(playerHeading);

    const list = document.createElement("dl");
    const addDirectionEntry = (
      labelKey: string,
      defaultLabel: string,
      key: string,
    ) => {
      const dt = document.createElement("dt");
      list.appendChild(dt);
      directionLabelCells.push({ labelKey, defaultLabel, element: dt });
      const dd = document.createElement("dd");
      dd.textContent = keyLabel(key);
      list.appendChild(dd);
    };
    addDirectionEntry("setup.directionUp", "Up", binding.up);
    addDirectionEntry("setup.directionDown", "Down", binding.down);
    addDirectionEntry("setup.directionLeft", "Left", binding.left);
    addDirectionEntry("setup.directionRight", "Right", binding.right);
    for (const name of BUTTON_NAMES) {
      // Button names (a/b/c/x/y/z) are physical control names, not
      // translated -- only their uppercase display casing is applied.
      const dt = document.createElement("dt");
      dt.textContent = name.toUpperCase();
      list.appendChild(dt);
      const dd = document.createElement("dd");
      dd.textContent = keyLabel(binding.buttons[name]);
      list.appendChild(dd);
    }
    playerSection.appendChild(list);

    if (index === 1) {
      player2List = list;
      const note = document.createElement("p");
      note.className = "setup-screen__controls-cpu-note";
      note.hidden = true;
      playerSection.appendChild(note);
      player2CpuNote = note;
    }

    grid.appendChild(playerSection);
  });

  section.appendChild(grid);

  const gamepadNote = document.createElement("p");
  gamepadNote.className = "setup-screen__controls-note";
  section.appendChild(gamepadNote);

  function playerHeadingKeyFor(index: number): {
    key: string;
    defaultLabel: string;
  } {
    return index === 1 && player2Cpu
      ? {
          key: "setup.controlsPlayerHeadingCpu",
          defaultLabel: "Player {{number}} (CPU)",
        }
      : {
          key: "setup.controlsPlayerHeading",
          defaultLabel: "Player {{number}} (keyboard)",
        };
  }

  function retranslate(): void {
    heading.textContent = t("setup.controlsHeading", "Controls");
    for (const [index, playerHeading] of playerHeadings.entries()) {
      const { key, defaultLabel } = playerHeadingKeyFor(index);
      playerHeading.textContent = t(key, defaultLabel, {
        number: String(index + 1),
      });
    }
    for (const { labelKey, defaultLabel, element } of directionLabelCells) {
      element.textContent = t(labelKey, defaultLabel);
    }
    gamepadNote.textContent = t(
      "setup.gamepadNote",
      "A connected gamepad is used automatically for whichever player it's assigned to (first connected → Player 1, next → Player 2). If it disconnects mid-match, that player falls back to their keyboard controls above.",
    );
    player2CpuNote.textContent = t(
      "setup.player2CpuNote",
      "Controlled automatically (CPU).",
    );
  }
  retranslate();

  function setPlayer2Cpu(isCpu: boolean): void {
    player2Cpu = isCpu;
    player2List.hidden = isCpu;
    player2CpuNote.hidden = !isCpu;
    const { key, defaultLabel } = playerHeadingKeyFor(1);
    playerHeadings[1].textContent = t(key, defaultLabel, { number: "2" });
  }

  return { element: section, retranslate, setPlayer2Cpu };
}

function buildErrorState(message: () => string): {
  element: HTMLElement;
  retranslate: () => void;
} {
  const panel = document.createElement("wuik-panel");
  panel.className = "setup-screen__error";
  const text = document.createElement("p");
  panel.appendChild(text);

  function retranslate(): void {
    text.textContent = message();
  }
  retranslate();

  return { element: panel, retranslate };
}

function setSelected(button: HTMLElement, selected: boolean): void {
  button.setAttribute("variant", selected ? "primary" : "secondary");
  button.setAttribute("aria-checked", String(selected));
}
