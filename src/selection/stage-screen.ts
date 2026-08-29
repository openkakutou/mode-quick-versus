// Renders the available stages and lets the two local players pick ONE
// shared stage to fight on — the screen described by backlog item 002. See
// .vibe/decisions/002-stage-selection-screen-design.md for why this is a
// single-choice (role="radiogroup") grid rather than item 001's
// two-button-per-card pattern: a stage is shared by both players, not
// picked independently.
import type { DiscoveredStage } from "../stage/discovery.ts";

export interface StageScreenOptions {
  /** Called once a stage is selected and Continue is activated. */
  onContinue: (stageId: string) => void;
}

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
  root.replaceChildren();

  if (entries.length === 0) {
    root.appendChild(buildEmptyState());
    return;
  }

  let selectedId: string | null = null;
  const selectButtonsById = new Map<string, HTMLElement>();

  const continueButton = document.createElement("wuik-button");
  continueButton.textContent = "Continue";
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
  grid.setAttribute("aria-label", "Available stages");

  for (const entry of entries) {
    if (entry.status === "error") {
      grid.appendChild(buildErrorCard(entry));
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
  heading.textContent = "Choose your stage";
  panel.appendChild(heading);
  panel.appendChild(grid);
  panel.appendChild(continueButton);

  root.appendChild(panel);
  syncSelectionUI();
}

function buildEmptyState(): HTMLElement {
  const panel = document.createElement("wuik-panel");
  panel.className = "stage-screen__empty";
  const message = document.createElement("p");
  message.textContent =
    "No stages are available yet. Check back once the stage list has been configured.";
  panel.appendChild(message);
  return panel;
}

function buildErrorCard(
  entry: DiscoveredStage & { status: "error" },
): HTMLElement {
  const card = document.createElement("wuik-panel");
  card.className = "stage-screen__card stage-screen__card--error";
  card.setAttribute("aria-disabled", "true");

  const portrait = buildPortrait(entry.portrait, `${entry.id} (unavailable)`);
  card.appendChild(portrait);

  const message = document.createElement("p");
  message.className = "stage-screen__error";
  message.textContent = `Unavailable: ${entry.message}`;
  card.appendChild(message);

  return card;
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
  selectButton.textContent = "Select this stage";
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

function setSelected(button: HTMLElement, selected: boolean): void {
  button.textContent = selected ? "Selected ✓" : "Select this stage";
  button.setAttribute("variant", selected ? "primary" : "secondary");
  button.setAttribute("aria-checked", String(selected));
}
