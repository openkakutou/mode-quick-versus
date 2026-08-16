// The character roster is a deploy-time-configured JSON manifest fetched at
// runtime (`public/roster-manifest.json`), not compiled into the JS bundle —
// so a deployment can swap the roster without a rebuild. See
// .vibe/decisions/001-roster-selection-screen-design.md.

const DEFAULT_MANIFEST_URL = "./roster-manifest.json";

/** One character's file paths and static portrait image, as listed in the manifest. */
export interface RosterManifestEntry {
  id: string;
  files: {
    def: string;
    air: string;
    sff: string;
    cns: string;
  };
  portrait: string;
}

export type RosterManifestResult =
  | { ok: true; entries: RosterManifestEntry[] }
  | { ok: false; error: string };

export interface FetchRosterManifestOptions {
  /** Fetches the manifest's raw JSON text. Defaults to `fetch(DEFAULT_MANIFEST_URL)`. */
  fetchManifestSource?: () => Promise<string>;
}

async function defaultFetchManifestSource(): Promise<string> {
  const response = await fetch(DEFAULT_MANIFEST_URL);
  if (!response.ok) {
    throw new Error(
      `failed to fetch ${DEFAULT_MANIFEST_URL}: ${response.status} ${response.statusText}`,
    );
  }
  return response.text();
}

function isValidEntry(value: unknown): value is RosterManifestEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  if (typeof entry.id !== "string" || entry.id.length === 0) return false;
  if (typeof entry.portrait !== "string" || entry.portrait.length === 0) {
    return false;
  }
  const files = entry.files;
  if (typeof files !== "object" || files === null) return false;
  const f = files as Record<string, unknown>;
  return (
    typeof f.def === "string" &&
    typeof f.air === "string" &&
    typeof f.sff === "string" &&
    typeof f.cns === "string"
  );
}

/**
 * Fetches and validates the roster manifest, returning a typed result
 * instead of throwing on a network failure or malformed JSON. An empty
 * array (`[]`) is a valid manifest — the committed default ships empty; a
 * real deployment overwrites the file with its actual roster.
 */
export async function fetchRosterManifest(
  options: FetchRosterManifestOptions = {},
): Promise<RosterManifestResult> {
  const fetchManifestSource =
    options.fetchManifestSource ?? defaultFetchManifestSource;

  let source: string;
  try {
    source = await fetchManifestSource();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `failed to fetch roster manifest: ${message}` };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: `roster manifest is not valid JSON: ${message}`,
    };
  }

  if (!Array.isArray(parsed)) {
    return { ok: false, error: "roster manifest must be a JSON array" };
  }

  const entries: RosterManifestEntry[] = [];
  for (const [index, item] of parsed.entries()) {
    if (!isValidEntry(item)) {
      return {
        ok: false,
        error: `roster manifest entry at index ${index} is missing required fields (id, portrait, files.def/air/sff/cns)`,
      };
    }
    entries.push(item);
  }

  return { ok: true, entries };
}
