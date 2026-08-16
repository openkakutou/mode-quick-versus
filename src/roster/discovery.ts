// Turns a validated roster manifest into the actual displayable roster: for
// each entry, fetches its character files and validates them through the
// `character` WASM bridge, so a corrupt/incomplete character surfaces as a
// clear per-entry error instead of crashing the whole screen or being
// silently dropped from the list. See backlog item 001.
import type { loadCharacter } from "../wasm/bridge.ts";
import type { RosterManifestEntry } from "./manifest.ts";

export type DiscoveredCharacter =
  | { id: string; portrait: string; status: "ok"; name: string }
  | { id: string; portrait: string; status: "error"; message: string };

export interface DiscoverRosterDeps {
  /** Fetches one character file's raw bytes, given its manifest path. */
  fetchBytes: (filePath: string) => Promise<Uint8Array>;
  /** Same contract as `wasm/bridge.ts`'s `loadCharacter`. */
  loadCharacter: typeof loadCharacter;
}

/**
 * Discovers the roster: loads and validates every manifest entry in
 * parallel. Each entry resolves independently — one entry's fetch/load
 * failure never affects another's, and never rejects the overall call.
 */
export async function discoverRoster(
  entries: readonly RosterManifestEntry[],
  deps: DiscoverRosterDeps,
): Promise<DiscoveredCharacter[]> {
  return Promise.all(entries.map((entry) => discoverOne(entry, deps)));
}

async function discoverOne(
  entry: RosterManifestEntry,
  deps: DiscoverRosterDeps,
): Promise<DiscoveredCharacter> {
  let defBytes: Uint8Array;
  let airBytes: Uint8Array;
  let sffBytes: Uint8Array;
  let cnsBytes: Uint8Array;
  try {
    [defBytes, airBytes, sffBytes, cnsBytes] = await Promise.all([
      deps.fetchBytes(entry.files.def),
      deps.fetchBytes(entry.files.air),
      deps.fetchBytes(entry.files.sff),
      deps.fetchBytes(entry.files.cns),
    ]);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      id: entry.id,
      portrait: entry.portrait,
      status: "error",
      message: `could not fetch character files: ${message}`,
    };
  }

  const result = await deps.loadCharacter(
    defBytes,
    airBytes,
    sffBytes,
    cnsBytes,
  );

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
    name: result.character.name,
  };
}
