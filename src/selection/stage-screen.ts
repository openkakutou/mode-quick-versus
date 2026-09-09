// Renders the available stages and lets the two local players pick ONE
// shared stage to fight on — the screen described by backlog item 002. See
// .vibe/decisions/002-stage-selection-screen-design.md for why this is a
// single-choice (role="radiogroup") grid rather than item 001's
// two-button-per-card pattern: a stage is shared by both players, not
// picked independently.
//
// UI text is localized (backlog item 009, see
// .vibe/decisions/006-i18n-integration-approach.md): this screen holds an
// in-progress, not-yet-submitted pick in a local closure that a full
// re-render from scratch would destroy, so it subscribes to
// `onLocaleChange` internally and re-translates only its already-rendered
// text in place.
import { onLocaleChange, t } from "../i18n/i18n.ts";
import type { DiscoveredStage } from "../stage/discovery.ts";

export interface StageScreenOptions {
  /** Called once a stage is selected and Continue is activated. */
  onContinue: (stageId: string) => void;
}

/** Stops the previous render call's locale-change subscription for a given
 * root before a new render replaces its content — same convention
 * `selection/roster-screen.ts` and `rendering/match-renderer.ts` use. */
const activeUnsubscribeByRoot = new WeakMap<HTMLElement, () => void>();

/**
 * Renders the stage screen into `root`, replacing its previous content.
 * An empty list (no entries at all, e.g. an unconfigured deployment)
 * renders a distinct message instead of an empty grid.
 */
export function renderStageScreen(
  root: HTMLElement,
  entries: readonly DiscoveredStage[],
  options: StageScreenOptions,
): void {
  activeUnsubscribeByRoot.get(root)?.();
  activeUnsubscribeByRoot.delete(root);
  root.replaceChildren();

  if (entries.length === 0) {
    const empty = buildEmptyState();
    root.appendChild(empty.element);
    activeUnsubscribeByRoot.set(root, onLocaleChange(empty.retranslate));
    return;
  }

  let selectedId: string | null = null;
  const selectButtonsById = new Map<string, HTMLElement>();
  const errorMessagesByEntry = new Map<HTMLElement, string>();

  const continueButton = document.createElement("wuik-button");
  continueButton.textContent = t("stage.continue", "Continue");
  continueButton.setAttribute("disabled", "");
  continueButton.addEventListener("click", () => {
    if (selectedId === null) return;
    options.onContinue(selectedId);
  });

  function syncSelectionUI(): void {
    for (const [id, button] of selectButtonsById) {
      setSelected(button, selectedId === id);
    }
    if (selectedId !== null) {
      continueButton.removeAttribute("disabled");
    } else {
      continueButton.setAttribute("disabled", "");
    }
  }

  // Selecting never toggles back to "no selection" — unlike character
  // selection's per-player slots, there is no valid empty state to return
  // to once a stage has been picked (see .vibe/decisions/002).
  function select(id: string): void {
    selectedId = id;
    syncSelectionUI();
  }

  const grid = document.createElement("div");
  grid.className = "stage-screen__grid";
  grid.setAttribute("role", "radiogroup");
  grid.setAttribute("aria-label", t("stage.gridLabel", "Available stages"));

  for (const entry of entries) {
    if (entry.status === "error") {
      const { card, messageElement } = buildErrorCard(entry);
      errorMessagesByEntry.set(messageElement, entry.message);
      grid.appendChild(card);
      continue;
    }

    const { card, selectButton } = buildStageCard(entry);
    selectButton.addEventListener("click", () => select(entry.id));
    selectButtonsById.set(entry.id, selectButton);
    grid.appendChild(card);
  }

  const panel = document.createElement("wuik-panel");
  panel.className = "stage-screen";

  const heading = document.createElement("h2");
  heading.textContent = t("stage.heading", "Choose your stage");
  panel.appendChild(heading);
  panel.appendChild(grid);
  panel.appendChild(continueButton);

  root.appendChild(panel);
  syncSelectionUI();

  function retranslate(): void {
    heading.textContent = t("stage.heading", "Choose your stage");
    continueButton.textContent = t("stage.continue", "Continue");
    grid.setAttribute("aria-label", t("stage.gridLabel", "Available stages"));
    syncSelectionUI();
    for (const [messageElement, message] of errorMessagesByEntry) {
      messageElement.textContent = t(
        "stage.unavailable",
        "Unavailable: {{message}}",
        {
          message,
        },
      );
    }
  }

  activeUnsubscribeByRoot.set(root, onLocaleChange(retranslate));
}

function buildEmptyState(): { element: HTMLElement; retranslate: () => void } {
  const panel = document.createElement("wuik-panel");
  panel.className = "stage-screen__empty";
  const message = document.createElement("p");
  panel.appendChild(message);

  function retranslate(): void {
    message.textContent = t(
      "stage.empty",
      "No stages are available yet. Check back once the stage list has been configured.",
    );
  }
  retranslate();

  return { element: panel, retranslate };
}

function buildErrorCard(entry: DiscoveredStage & { status: "error" }): {
  card: HTMLElement;
  messageElement: HTMLElement;
} {
  const card = document.createElement("wuik-panel");
  card.className = "stage-screen__card stage-screen__card--error";
  card.setAttribute("aria-disabled", "true");

  const portrait = buildPortrait(entry.portrait, `${entry.id} (unavailable)`);
  card.appendChild(portrait);

  const message = document.createElement("p");
  message.className = "stage-screen__error";
  message.textContent = t("stage.unavailable", "Unavailable: {{message}}", {
    message: entry.message,
  });
  card.appendChild(message);

  return { card, messageElement: message };
}

function buildStageCard(entry: DiscoveredStage & { status: "ok" }): {
  card: HTMLElement;
  selectButton: HTMLElement;
} {
  const card = document.createElement("wuik-panel");
  card.className = "stage-screen__card";

  card.appendChild(buildPortrait(entry.portrait, entry.name));

  const name = document.createElement("h3");
  name.className = "stage-screen__name";
  name.textContent = entry.name;
  card.appendChild(name);

  // A single radio-role control per card — the grid is one mutually
  // exclusive choice, not two independent per-player toggles like the
  // character roster's cards.
  const selectButton = document.createElement("wuik-button");
  selectButton.setAttribute("variant", "secondary");
  selectButton.setAttribute("role", "radio");
  selectButton.setAttribute("aria-checked", "false");
  selectButton.className = "stage-screen__select";
  selectButton.textContent = t("stage.select", "Select this stage");
  card.appendChild(selectButton);

  return { card, selectButton };
}

function buildPortrait(src: string, alt: string): HTMLImageElement {
  const portrait = document.createElement("img");
  portrait.className = "stage-screen__portrait";
  portrait.src = src;
  portrait.alt = alt;
  return portrait;
}

/**
 * The picked-state checkmark ("✓") is appended here, in code, never
 * embedded inside a catalog string — same convention as
 * `selection/roster-screen.ts`'s `setPicked` (see `.vibe/decisions/006`).
 */
function setSelected(button: HTMLElement, selected: boolean): void {
  const label = t(
    selected ? "stage.selected" : "stage.select",
    selected ? "Selected" : "Select this stage",
  );
  button.textContent = selected ? `${label} ✓` : label;
  button.setAttribute("variant", selected ? "primary" : "secondary");
  button.setAttribute("aria-checked", String(selected));
}
