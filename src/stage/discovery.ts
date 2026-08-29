// Turns a validated stage manifest into the actual displayable stage list:
// for each entry, fetches its `.def` file and validates it through the
// `stage` WASM bridge, so a corrupt/incomplete stage surfaces as a clear
// per-entry error instead of crashing the whole screen or being silently
// dropped from the list. Mirrors `roster/discovery.ts`'s character
// equivalent — see backlog item 002 and .vibe/decisions/002.
import type { loadStage } from "../wasm/stage-bridge.ts";
import type { StageManifestEntry } from "./manifest.ts";

export type DiscoveredStage =
  | { id: string; portrait: string; status: "ok"; name: string }
  | { id: string; portrait: string; status: "error"; message: string };

export interface DiscoverStagesDeps {
  /** Fetches one stage file's raw bytes, given its manifest path. */
  fetchBytes: (filePath: string) => Promise<Uint8Array>;
  /** Same contract as `wasm/stage-bridge.ts`'s `loadStage`. */
  loadStage: typeof loadStage;
}

/**
 * Discovers the stage list: loads and validates every manifest entry in
 * parallel. Each entry resolves independently — one entry's fetch/load
 * failure never affects another's, and never rejects the overall call.
 */
export async function discoverStages(
  entries: readonly StageManifestEntry[],
  deps: DiscoverStagesDeps,
): Promise<DiscoveredStage[]> {
  return Promise.all(entries.map((entry) => discoverOne(entry, deps)));
}

async function discoverOne(
  entry: StageManifestEntry,
  deps: DiscoverStagesDeps,
): Promise<DiscoveredStage> {
  let defBytes: Uint8Array;
  try {
    defBytes = await deps.fetchBytes(entry.files.def);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      id: entry.id,
      portrait: entry.portrait,
      status: "error",
      message: `could not fetch stage file: ${message}`,
    };
  }

  const result = await deps.loadStage(defBytes);

  if (!result.ok) {
    return {
      id: entry.id,
      portrait: entry.portrait,
      status: "error",
      message: result.error,
    };
  }

  return {
    id: entry.id,
    portrait: entry.portrait,
    status: "ok",
    name: result.stage.name,
  };
}
