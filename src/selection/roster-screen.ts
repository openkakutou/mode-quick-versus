// Renders the character roster and lets each of the two local players
// independently pick one — the screen described by backlog item 001. See
// .vibe/decisions/001-roster-selection-screen-design.md for why picks are
// two always-visible per-card buttons (not a shared cursor) and why P1/P2
// are distinguished by label + position, never color alone.
import type { DiscoveredCharacter } from "../roster/discovery.ts";

export interface RosterScreenOptions {
  /** Called once both players have a pick and Continue is activated. */
  onContinue: (player1Id: string, player2Id: string) => void;
}

interface CardControls {
  player1Button: HTMLElement;
  player2Button: HTMLElement;
}

/**
 * Renders the roster screen into `root`, replacing its previous content.
 * An empty roster (no entries at all, e.g. an unconfigured deployment)
 * renders a distinct message instead of an empty grid.
 */
export function renderRosterScreen(
  root: HTMLElement,
  entries: readonly DiscoveredCharacter[],
  options: RosterScreenOptions,
): void {
  root.replaceChildren();

  if (entries.length === 0) {
    root.appendChild(buildEmptyState());
    return;
  }

  let player1Id: string | null = null;
  let player2Id: string | null = null;
  const cardControlsById = new Map<string, CardControls>();

  const continueButton = document.createElement("wuik-button");
  continueButton.textContent = "Continue";
  continueButton.setAttribute("disabled", "");
  continueButton.addEventListener("click", () => {
    if (player1Id === null || player2Id === null) return;
    options.onContinue(player1Id, player2Id);
  });

  function syncSelectionUI(): void {
    for (const [id, controls] of cardControlsById) {
      setPicked(controls.player1Button, player1Id === id, "Player 1");
      setPicked(controls.player2Button, player2Id === id, "Player 2");
    }
    if (player1Id !== null && player2Id !== null) {
      continueButton.removeAttribute("disabled");
    } else {
      continueButton.setAttribute("disabled", "");
    }
  }

  function pick(player: 1 | 2, id: string): void {
    if (player === 1) {
      player1Id = player1Id === id ? null : id;
    } else {
      player2Id = player2Id === id ? null : id;
    }
    syncSelectionUI();
  }

  const grid = document.createElement("div");
  grid.className = "roster-screen__grid";

  for (const entry of entries) {
    if (entry.status === "error") {
      grid.appendChild(buildErrorCard(entry));
      continue;
    }

    const { card, player1Button, player2Button } = buildCharacterCard(entry);
    player1Button.addEventListener("click", () => pick(1, entry.id));
    player2Button.addEventListener("click", () => pick(2, entry.id));
    cardControlsById.set(entry.id, { player1Button, player2Button });
    grid.appendChild(card);
  }

  const panel = document.createElement("wuik-panel");
  panel.className = "roster-screen";

  const heading = document.createElement("h2");
  heading.textContent = "Choose your character";
  panel.appendChild(heading);
  panel.appendChild(grid);
  panel.appendChild(continueButton);

  root.appendChild(panel);
  syncSelectionUI();
}

function buildEmptyState(): HTMLElement {
  const panel = document.createElement("wuik-panel");
  panel.className = "roster-screen__empty";
  const message = document.createElement("p");
  message.textContent =
    "No characters are available yet. Check back once the roster has been configured.";
  panel.appendChild(message);
  return panel;
}

function buildErrorCard(
  entry: DiscoveredCharacter & { status: "error" },
): HTMLElement {
  const card = document.createElement("wuik-panel");
  card.className = "roster-screen__card roster-screen__card--error";
  card.setAttribute("aria-disabled", "true");

  const portrait = buildPortrait(entry.portrait, `${entry.id} (unavailable)`);
  card.appendChild(portrait);

  const message = document.createElement("p");
  message.className = "roster-screen__error";
  message.textContent = `Unavailable: ${entry.message}`;
  card.appendChild(message);

  return card;
}

function buildCharacterCard(entry: DiscoveredCharacter & { status: "ok" }): {
  card: HTMLElement;
  player1Button: HTMLElement;
  player2Button: HTMLElement;
} {
  const card = document.createElement("wuik-panel");
  card.className = "roster-screen__card";

  card.appendChild(buildPortrait(entry.portrait, entry.name));

  const name = document.createElement("h3");
  name.className = "roster-screen__name";
  name.textContent = entry.name;
  card.appendChild(name);

  const buttonRow = document.createElement("div");
  buttonRow.className = "roster-screen__buttons";

  // Given their real label ("Player 1"/"Player 2") right away, before
  // they're ever connected to the document — `<wuik-button>` warns about a
  // missing accessible label the moment it connects, and `syncSelectionUI`
  // only runs once, after the whole screen is mounted.
  const player1Button = document.createElement("wuik-button");
  player1Button.setAttribute("variant", "secondary");
  player1Button.className = "roster-screen__pick roster-screen__pick--p1";
  player1Button.textContent = "Player 1";

  const player2Button = document.createElement("wuik-button");
  player2Button.setAttribute("variant", "secondary");
  player2Button.className = "roster-screen__pick roster-screen__pick--p2";
  player2Button.textContent = "Player 2";

  buttonRow.append(player1Button, player2Button);
  card.appendChild(buttonRow);

  return { card, player1Button, player2Button };
}

function buildPortrait(src: string, alt: string): HTMLImageElement {
  const portrait = document.createElement("img");
  portrait.className = "roster-screen__portrait";
  portrait.src = src;
  portrait.alt = alt;
  return portrait;
}

/** Position + text label encode P1/P2, not color alone — see the ADR referenced above. */
function setPicked(
  button: HTMLElement,
  picked: boolean,
  label: "Player 1" | "Player 2",
): void {
  button.textContent = picked ? `${label} ✓` : label;
  button.setAttribute("variant", picked ? "primary" : "secondary");
  button.setAttribute("aria-pressed", String(picked));
}
