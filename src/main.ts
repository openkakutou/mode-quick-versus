import "@openkakutou/web-ui-kit/tokens.css";
import "@openkakutou/web-ui-kit";
import { discoverRoster } from "./roster/discovery.ts";
import {
  type FetchRosterManifestOptions,
  fetchRosterManifest,
} from "./roster/manifest.ts";
import { renderRosterScreen } from "./selection/roster-screen.ts";
import { renderStageScreen } from "./selection/stage-screen.ts";
import {
  type MatchSetupConfig,
  renderSetupScreen,
} from "./setup/setup-screen.ts";
import { discoverStages } from "./stage/discovery.ts";
import {
  type FetchStageManifestOptions,
  fetchStageManifest,
} from "./stage/manifest.ts";
import { appVersion } from "./version.ts";
import { type WasmBridgeOptions, loadCharacter } from "./wasm/bridge.ts";
import { type StageWasmBridgeOptions, loadStage } from "./wasm/stage-bridge.ts";

const APP_TITLE = "Quick Versus";

export interface RenderAppOptions {
  /** Forwarded to `fetchRosterManifest`; injectable for testing. */
  manifestOptions?: FetchRosterManifestOptions;
  /** Fetches one character or stage file's raw bytes. Defaults to `fetch()`; injectable for testing. */
  fetchBytes?: (filePath: string) => Promise<Uint8Array>;
  /**
   * Overrides the character loader used during roster discovery, bypassing
   * the real WASM bridge entirely — the composition/wiring this module
   * owns is tested against a fake here; the real bridge is exercised for
   * real by `wasm/bridge.test.ts` and `roster/discovery.smoke.test.ts`.
   * Defaults to the real bridge's `loadCharacter`, driven by `bridgeOptions`.
   */
  loadCharacter?: typeof loadCharacter;
  /** Forwarded to the real bridge's `loadCharacter` when `loadCharacter` is not overridden. */
  bridgeOptions?: WasmBridgeOptions;
  /** Forwarded to `fetchStageManifest`; injectable for testing. */
  stageManifestOptions?: FetchStageManifestOptions;
  /**
   * Overrides the stage loader used during stage discovery, same rationale
   * as `loadCharacter` above. Defaults to the real bridge's `loadStage`,
   * driven by `stageBridgeOptions`.
   */
  loadStage?: typeof loadStage;
  /** Forwarded to the real bridge's `loadStage` when `loadStage` is not overridden. */
  stageBridgeOptions?: StageWasmBridgeOptions;
}

async function defaultFetchBytes(filePath: string): Promise<Uint8Array> {
  const response = await fetch(filePath);
  if (!response.ok) {
    throw new Error(
      `failed to fetch ${filePath}: ${response.status} ${response.statusText}`,
    );
  }
  return new Uint8Array(await response.arrayBuffer());
}

/**
 * Builds the app's root frame — a `web-ui-kit` `<wuik-app-shell>` with the
 * app title (plus version) in the toolbar — then discovers the character
 * roster (backlog item 001) and renders the selection screen in the main
 * content area. A roster manifest that fails to load, or an empty roster,
 * both degrade to a clear message instead of a blank/broken screen.
 */
export async function renderApp(
  root: HTMLElement,
  version: string,
  options: RenderAppOptions = {},
): Promise<void> {
  root.replaceChildren();

  const shell = document.createElement("wuik-app-shell");

  const toolbar = document.createElement("wuik-toolbar");
  toolbar.slot = "toolbar";
  toolbar.setAttribute("role", "banner");
  const title = document.createElement("span");
  title.className = "app-title";
  title.textContent = `${APP_TITLE} — v${version}`;
  toolbar.appendChild(title);
  shell.appendChild(toolbar);

  const main = document.createElement("main");
  const status = document.createElement("p");
  status.className = "app-status";
  status.textContent = "Discovering roster…";
  main.appendChild(status);
  shell.appendChild(main);

  root.appendChild(shell);

  const manifestResult = await fetchRosterManifest(options.manifestOptions);
  if (!manifestResult.ok) {
    status.textContent = `Could not load the character roster: ${manifestResult.error}`;
    return;
  }

  const resolveCharacter =
    options.loadCharacter ??
    ((
      defBytes: Uint8Array,
      airBytes: Uint8Array,
      sffBytes: Uint8Array,
      cnsBytes: Uint8Array,
    ) =>
      loadCharacter(
        defBytes,
        airBytes,
        sffBytes,
        cnsBytes,
        options.bridgeOptions,
      ));

  const discovered = await discoverRoster(manifestResult.entries, {
    fetchBytes: options.fetchBytes ?? defaultFetchBytes,
    loadCharacter: resolveCharacter,
  });

  main.replaceChildren();
  renderRosterScreen(main, discovered, {
    onContinue: (player1Id, player2Id) => {
      void showStageSelection(main, player1Id, player2Id, options);
    },
  });
}

/**
 * Discovers the stage list (backlog item 002) and renders the stage
 * selection screen in `main`, replacing the character selection screen. A
 * stage manifest that fails to load degrades to a clear message instead of
 * a blank/broken screen, same as the character roster's own handling.
 */
async function showStageSelection(
  main: HTMLElement,
  player1Id: string,
  player2Id: string,
  options: RenderAppOptions,
): Promise<void> {
  main.replaceChildren();
  const status = document.createElement("p");
  status.className = "app-status";
  status.textContent = "Discovering stages…";
  main.appendChild(status);

  const stageManifestResult = await fetchStageManifest(
    options.stageManifestOptions,
  );
  if (!stageManifestResult.ok) {
    status.textContent = `Could not load the stage list: ${stageManifestResult.error}`;
    return;
  }

  const resolveStage =
    options.loadStage ??
    ((defBytes: Uint8Array) => loadStage(defBytes, options.stageBridgeOptions));

  const discoveredStages = await discoverStages(stageManifestResult.entries, {
    fetchBytes: options.fetchBytes ?? defaultFetchBytes,
    loadStage: resolveStage,
  });

  main.replaceChildren();
  renderStageScreen(main, discoveredStages, {
    onContinue: (stageId) => {
      showMatchSetup(main, player1Id, player2Id, stageId);
    },
  });
}

/**
 * Renders the match setup screen (backlog item 003) in `main`, replacing
 * the stage selection screen. The in-match HUD/rendering/input this screen
 * would normally hand off to isn't built yet, so Continue degrades to a
 * confirmation message carrying every choice made so far — same "coming
 * soon" handling this repo already uses at the previous screen boundary.
 */
function showMatchSetup(
  main: HTMLElement,
  player1Id: string,
  player2Id: string,
  stageId: string,
): void {
  main.replaceChildren();
  renderSetupScreen(main, {
    onContinue: (config: MatchSetupConfig) => {
      main.replaceChildren();
      const confirmation = document.createElement("p");
      confirmation.className = "app-status";
      const timeLimitLabel =
        config.timeLimit === "unlimited"
          ? "Unlimited"
          : `${config.timeLimit.seconds}s`;
      confirmation.textContent = `Player 1: ${player1Id} — Player 2: ${player2Id} — Stage: ${stageId} — Rounds: ${config.rounds} — Time limit: ${timeLimitLabel}. The match is coming soon.`;
      main.appendChild(confirmation);
    },
  });
}

const app = document.querySelector<HTMLDivElement>("#app");
if (app) {
  renderApp(app, appVersion);
}
