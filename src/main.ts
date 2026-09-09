import "@openkakutou/web-ui-kit/tokens.css";
import "@openkakutou/web-ui-kit";
import type { WuikLocaleSwitcherElement } from "@openkakutou/web-ui-kit";
import { getI18n, initAppI18n, onLocaleChange, t } from "./i18n/i18n.ts";
import { emptyCommandFile } from "./rendering/match-config.ts";
import { renderMatch as renderMatchDefault } from "./rendering/match-renderer.ts";
import { discoverRoster } from "./roster/discovery.ts";
import {
  type FetchRosterManifestOptions,
  type RosterManifestEntry,
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
  type StageManifestEntry,
  fetchStageManifest,
} from "./stage/manifest.ts";
import { appVersion } from "./version.ts";
import {
  type WasmBridgeOptions,
  loadCharacter,
  loadCmd,
} from "./wasm/bridge.ts";
import type { CommandFileBlob } from "./wasm/engine-types.ts";
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
  /**
   * Overrides the `.cmd` command-file loader used during match assembly,
   * same rationale as `loadCharacter` above. Defaults to the real bridge's
   * `loadCmd`, driven by `bridgeOptions` (the same character WASM module).
   */
  loadCmd?: typeof loadCmd;
  /** Forwarded to the real bridge's `loadCharacter`/`loadCmd` when neither is overridden. */
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
  /**
   * Overrides the match renderer used once match setup completes,
   * bypassing the real canvas/WASM tick loop entirely — the composition/
   * wiring this module owns is tested against a fake here; the real
   * renderer is exercised for real by `rendering/match-renderer.test.ts`.
   * Defaults to the real `renderMatch`.
   */
  renderMatch?: typeof renderMatchDefault;
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
 * Stops the previous `renderApp` call's toolbar locale-change subscription
 * for a given root before a new call replaces its content — same "stop the
 * previous one first" convention the individual screens
 * (`selection/roster-screen.ts` etc.) and `rendering/match-renderer.ts` use.
 */
const activeUnsubscribeByRoot = new WeakMap<HTMLElement, () => void>();

/**
 * Builds the app's root frame — a `web-ui-kit` `<wuik-app-shell>` with the
 * app title (plus version) and a `<wuik-locale-switcher>` (backlog item
 * 009) in the toolbar — then discovers the character roster (backlog item
 * 001) and renders the selection screen in the main content area. A
 * roster manifest that fails to load, or an empty roster, both degrade to
 * a clear message instead of a blank/broken screen.
 *
 * The toolbar's brand title/version stay untranslated proper nouns, so
 * they don't need to react to a locale change; the locale switcher's own
 * accessible label does, since it stays mounted for the whole session
 * across every screen transition (see `.vibe/decisions/006`). The
 * transient one-line status text below is translated at the moment it is
 * shown, but is not itself wired to retranslate live — it is shown for a
 * few hundred milliseconds while a manifest/asset fetch is in flight, not
 * one of this item's three named screens, and holds no state a user could
 * lose.
 */
export async function renderApp(
  root: HTMLElement,
  version: string,
  options: RenderAppOptions = {},
): Promise<void> {
  activeUnsubscribeByRoot.get(root)?.();
  activeUnsubscribeByRoot.delete(root);
  root.replaceChildren();

  const shell = document.createElement("wuik-app-shell");

  const toolbar = document.createElement("wuik-toolbar");
  toolbar.slot = "toolbar";
  toolbar.setAttribute("role", "banner");
  const title = document.createElement("span");
  title.className = "app-title";
  title.textContent = `${APP_TITLE} — v${version}`;
  toolbar.appendChild(title);

  const localeSwitcher = document.createElement(
    "wuik-locale-switcher",
  ) as unknown as WuikLocaleSwitcherElement;
  localeSwitcher.className = "locale-switcher";
  localeSwitcher.setAttribute("label", t("app.languageLabel", "Language"));
  localeSwitcher.i18n = getI18n();
  toolbar.appendChild(localeSwitcher);

  shell.appendChild(toolbar);

  const main = document.createElement("main");
  const status = document.createElement("p");
  status.className = "app-status";
  status.textContent = t("status.discoveringRoster", "Discovering roster…");
  main.appendChild(status);
  shell.appendChild(main);

  root.appendChild(shell);

  activeUnsubscribeByRoot.set(
    root,
    onLocaleChange(() => {
      localeSwitcher.setAttribute("label", t("app.languageLabel", "Language"));
    }),
  );

  const manifestResult = await fetchRosterManifest(options.manifestOptions);
  if (!manifestResult.ok) {
    status.textContent = t(
      "status.rosterLoadError",
      "Could not load the character roster: {{error}}",
      { error: manifestResult.error },
    );
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
      void showStageSelection(
        main,
        player1Id,
        player2Id,
        manifestResult.entries,
        options,
      );
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
  rosterEntries: readonly RosterManifestEntry[],
  options: RenderAppOptions,
): Promise<void> {
  main.replaceChildren();
  const status = document.createElement("p");
  status.className = "app-status";
  status.textContent = t("status.discoveringStages", "Discovering stages…");
  main.appendChild(status);

  const stageManifestResult = await fetchStageManifest(
    options.stageManifestOptions,
  );
  if (!stageManifestResult.ok) {
    status.textContent = t(
      "status.stageLoadError",
      "Could not load the stage list: {{error}}",
      { error: stageManifestResult.error },
    );
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
      showMatchSetup(
        main,
        player1Id,
        player2Id,
        stageId,
        rosterEntries,
        stageManifestResult.entries,
        options,
      );
    },
  });
}

/**
 * Renders the match setup screen (backlog item 003) in `main`, replacing
 * the stage selection screen. Continue starts real match rendering
 * (backlog item 005) — visual-only for now: the in-match HUD (item 004,
 * blocked) and player input (item 006) aren't wired in yet.
 */
function showMatchSetup(
  main: HTMLElement,
  player1Id: string,
  player2Id: string,
  stageId: string,
  rosterEntries: readonly RosterManifestEntry[],
  stageEntries: readonly StageManifestEntry[],
  options: RenderAppOptions,
): void {
  main.replaceChildren();
  renderSetupScreen(main, {
    onContinue: (config: MatchSetupConfig) => {
      void startMatch(
        main,
        player1Id,
        player2Id,
        stageId,
        rosterEntries,
        stageEntries,
        config,
        options,
      );
    },
  });
}

/**
 * Assembles a real match from both players' chosen characters and the
 * chosen stage — re-fetching and re-loading their files (discovery,
 * backlog items 001/002, didn't retain raw bytes or full parsed data,
 * only the name needed for the selection screens) — then starts rendering
 * it (backlog item 005). A fetch/load failure at this point (rare: every
 * file already loaded successfully once during discovery) degrades to a
 * clear error message instead of a blank/broken screen, same handling
 * this module already uses at every earlier screen boundary.
 */
async function startMatch(
  main: HTMLElement,
  player1Id: string,
  player2Id: string,
  stageId: string,
  rosterEntries: readonly RosterManifestEntry[],
  stageEntries: readonly StageManifestEntry[],
  config: MatchSetupConfig,
  options: RenderAppOptions,
): Promise<void> {
  main.replaceChildren();
  const status = document.createElement("p");
  status.className = "app-status";
  status.textContent = t("status.loadingMatchAssets", "Loading match assets…");
  main.appendChild(status);

  const fetchBytes = options.fetchBytes ?? defaultFetchBytes;
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
  const resolveStage =
    options.loadStage ??
    ((defBytes: Uint8Array) => loadStage(defBytes, options.stageBridgeOptions));
  const resolveCmd =
    options.loadCmd ??
    ((cmdBytes: Uint8Array) => loadCmd(cmdBytes, options.bridgeOptions));
  const renderMatch = options.renderMatch ?? renderMatchDefault;

  const player1Entry = rosterEntries.find((e) => e.id === player1Id);
  const player2Entry = rosterEntries.find((e) => e.id === player2Id);
  const stageEntry = stageEntries.find((e) => e.id === stageId);
  if (!player1Entry || !player2Entry || !stageEntry) {
    status.textContent = t(
      "status.matchStartMissingPick",
      "Could not start the match: one of the selected picks is no longer available.",
    );
    return;
  }

  async function loadFighter(entry: RosterManifestEntry) {
    const [defBytes, airBytes, sffBytes, cnsBytes] = await Promise.all([
      fetchBytes(entry.files.def),
      fetchBytes(entry.files.air),
      fetchBytes(entry.files.sff),
      fetchBytes(entry.files.cns),
    ]);
    const result = await resolveCharacter(
      defBytes,
      airBytes,
      sffBytes,
      cnsBytes,
    );
    const commands = await loadFighterCommands(entry);
    return { result, sffBytes, commands };
  }

  /**
   * Fetches and parses this fighter's own `.cmd` file so routed player
   * input (backlog item 006) can resolve to recognized commands. A
   * fetch/parse failure degrades this one fighter to no recognized
   * commands (`emptyCommandFile()`) instead of blocking the whole match —
   * same "degrade, don't block" precedent already used for a sprite that
   * fails to resolve.
   */
  async function loadFighterCommands(
    entry: RosterManifestEntry,
  ): Promise<CommandFileBlob> {
    try {
      const cmdBytes = await fetchBytes(entry.files.cmd);
      const parsed = await resolveCmd(cmdBytes);
      return parsed.ok ? parsed.commandFile : emptyCommandFile();
    } catch {
      return emptyCommandFile();
    }
  }

  let player1Loaded: Awaited<ReturnType<typeof loadFighter>>;
  let player2Loaded: Awaited<ReturnType<typeof loadFighter>>;
  let stageLoaded: Awaited<ReturnType<typeof resolveStage>>;
  let stageSffBytes: Uint8Array;
  try {
    let stageDefBytes: Uint8Array;
    [player1Loaded, player2Loaded, stageDefBytes] = await Promise.all([
      loadFighter(player1Entry),
      loadFighter(player2Entry),
      fetchBytes(stageEntry.files.def),
    ]);
    stageLoaded = await resolveStage(stageDefBytes);
    // The stage manifest lists only the .def path (unlike the roster
    // manifest, which lists every character file explicitly) -- a
    // stage's own .sff sprite sheet path is instead embedded inside its
    // .def ([BGDef] "spr"), resolved by basename against the .def's own
    // directory, mirroring the org-wide "resolve a referenced asset by
    // basename in the same folder" convention (see character's own item
    // 050 precedent).
    stageSffBytes = stageLoaded.ok
      ? await fetchBytes(
          resolveStageSffPath(
            stageEntry.files.def,
            stageLoaded.stage.bgDef.spriteFile,
          ),
        )
      : new Uint8Array();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    status.textContent = t(
      "status.matchStartFetchError",
      "Could not start the match: could not fetch match files: {{message}}",
      { message },
    );
    return;
  }

  if (!player1Loaded.result.ok) {
    status.textContent = t(
      "status.matchStartCharacterError",
      "Could not start the match: {{error}}",
      { error: player1Loaded.result.error },
    );
    return;
  }
  if (!player2Loaded.result.ok) {
    status.textContent = t(
      "status.matchStartCharacterError",
      "Could not start the match: {{error}}",
      { error: player2Loaded.result.error },
    );
    return;
  }
  if (!stageLoaded.ok) {
    status.textContent = t(
      "status.matchStartStageError",
      "Could not start the match: {{error}}",
      { error: stageLoaded.error },
    );
    return;
  }

  await renderMatch(main, {
    player1: {
      character: player1Loaded.result.character,
      sffBytes: player1Loaded.sffBytes,
      commands: player1Loaded.commands,
    },
    player2: {
      character: player2Loaded.result.character,
      sffBytes: player2Loaded.sffBytes,
      commands: player2Loaded.commands,
    },
    stage: { stage: stageLoaded.stage, sffBytes: stageSffBytes },
    config,
  });
}

/**
 * Resolves a stage's `.sff` sprite sheet path by basename against its
 * `.def` file's own directory — the stage manifest never lists it
 * explicitly (unlike the roster manifest's character files), since a
 * stage's `.def` references its own sheet internally (`[BGDef] "spr"`).
 */
function resolveStageSffPath(
  stageDefPath: string,
  spriteFileName: string,
): string {
  const lastSlash = stageDefPath.lastIndexOf("/");
  const dir = lastSlash === -1 ? "" : stageDefPath.slice(0, lastSlash + 1);
  const basename = spriteFileName.replace(/\\/g, "/").split("/").pop() ?? "";
  return `${dir}${basename}`;
}

/**
 * `initAppI18n` is awaited here, before the very first `renderApp` call --
 * never inside `renderApp` itself, which stays synchronous-callable so
 * tests can keep calling it directly with deterministic English defaults
 * (see `.vibe/decisions/006-i18n-integration-approach.md`). This is also
 * why the real app never flashes English before a persisted locale
 * resolves: the first paint already has the right language.
 */
async function mount(): Promise<void> {
  await initAppI18n();
  const app = document.querySelector<HTMLDivElement>("#app");
  if (app) {
    void renderApp(app, appVersion);
  }
}

void mount();
