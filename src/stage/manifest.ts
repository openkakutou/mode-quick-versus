// The stage manifest is a deploy-time-configured JSON manifest fetched at
// runtime (`public/stage-manifest.json`), not compiled into the JS bundle —
// same design as `roster/manifest.ts`'s character roster, so a deployment
// can swap the available stages without a rebuild. See
// .vibe/decisions/002-stage-selection-screen-design.md.

const DEFAULT_MANIFEST_URL = "./stage-manifest.json";

/** One stage's file path and static portrait image, as listed in the manifest. */
export interface StageManifestEntry {
  id: string;
  files: {
    def: string;
  };
  portrait: string;
}

export type StageManifestResult =
  | { ok: true; entries: StageManifestEntry[] }
  | { ok: false; error: string };

export interface FetchStageManifestOptions {
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

function isValidEntry(value: unknown): value is StageManifestEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  if (typeof entry.id !== "string" || entry.id.length === 0) return false;
  if (typeof entry.portrait !== "string" || entry.portrait.length === 0) {
    return false;
  }
  const files = entry.files;
  if (typeof files !== "object" || files === null) return false;
  return typeof (files as Record<string, unknown>).def === "string";
}

/**
 * Fetches and validates the stage manifest, returning a typed result
 * instead of throwing on a network failure or malformed JSON. An empty
 * array (`[]`) is a valid manifest — the committed default ships empty; a
 * real deployment overwrites the file with its actual stage list.
 */
export async function fetchStageManifest(
  options: FetchStageManifestOptions = {},
): Promise<StageManifestResult> {
  const fetchManifestSource =
    options.fetchManifestSource ?? defaultFetchManifestSource;

  let source: string;
  try {
    source = await fetchManifestSource();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `failed to fetch stage manifest: ${message}` };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: `stage manifest is not valid JSON: ${message}`,
    };
  }

  if (!Array.isArray(parsed)) {
    return { ok: false, error: "stage manifest must be a JSON array" };
  }

  const entries: StageManifestEntry[] = [];
  for (const [index, item] of parsed.entries()) {
    if (!isValidEntry(item)) {
      return {
        ok: false,
        error: `stage manifest entry at index ${index} is missing required fields (id, portrait, files.def)`,
      };
    }
    entries.push(item);
  }

  return { ok: true, entries };
}
