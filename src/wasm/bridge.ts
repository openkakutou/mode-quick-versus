// Bridge to the `character` WASM module: loads `wasm_exec.js`, instantiates
// `character.wasm`, and exposes a typed wrapper around the global
// `OpenKakutouCharacter.load` call. Same loading strategy (injectable
// fetch, `Function`-executed `wasm_exec.js`, unawaited `go.run`) and
// discriminated-union result shape as `character-viewer-web`'s own bridge —
// see that repo's `.vibe/decisions/002-wasm-bridge-loading-and-result-shape.md`
// for the full rationale, not re-derived here.
import type {
  Animation,
  CharacterResult,
  CommandFile,
  CommandFileResult,
  SpriteGroup,
  SpritePixelResult,
  StateDefBlob,
} from "./types.ts";

const DEFAULT_WASM_EXEC_URL = "./wasm/wasm_exec.js";
const DEFAULT_WASM_BINARY_URL = "./wasm/character.wasm";

/** The `Go` runtime instance `wasm_exec.js` (via `new globalThis.Go()`) produces. */
interface GoRuntime {
  importObject: WebAssembly.Imports;
  run(instance: WebAssembly.Instance): Promise<void>;
}

/** The `{character, error}` shape returned synchronously by `OpenKakutouCharacter.load`. */
interface RawLoadResult {
  character: string | null;
  error: string | null;
}

/** The `{commandFile, error}` shape returned synchronously by `OpenKakutouCharacter.loadCmd`. */
interface RawLoadCmdResult {
  commandFile: string | null;
  error: string | null;
}

/** One `resolveSprites` request result as returned raw by the WASM module: exactly one of `pixels`/`error` is non-null. */
interface RawSpritePixelResult {
  pixels: Uint8Array | null;
  width: number;
  height: number;
  error: string | null;
}

interface OpenKakutouCharacterGlobal {
  load(
    defBytes: Uint8Array,
    airBytes: Uint8Array,
    sffBytes: Uint8Array,
    cnsBytes: Uint8Array,
  ): RawLoadResult;
  loadCmd(cmdBytes: Uint8Array): RawLoadCmdResult;
  resolveSprites(
    sffBytes: Uint8Array,
    requests: [number, number][],
    overrideBytes: Uint8Array | null | undefined,
  ): RawSpritePixelResult[] | null;
}

export interface WasmBridgeOptions {
  /** Fetches `wasm_exec.js`'s source text. Defaults to `fetch(DEFAULT_WASM_EXEC_URL)`. */
  fetchWasmExecSource?: () => Promise<string>;
  /** Fetches `character.wasm`'s raw bytes. Defaults to `fetch(DEFAULT_WASM_BINARY_URL)`. */
  fetchWasmBytes?: () => Promise<Uint8Array>;
}

async function defaultFetchWasmExecSource(): Promise<string> {
  const response = await fetch(DEFAULT_WASM_EXEC_URL);
  if (!response.ok) {
    throw new Error(
      `failed to fetch ${DEFAULT_WASM_EXEC_URL}: ${response.status} ${response.statusText}`,
    );
  }
  return response.text();
}

async function defaultFetchWasmBytes(): Promise<Uint8Array> {
  const response = await fetch(DEFAULT_WASM_BINARY_URL);
  if (!response.ok) {
    throw new Error(
      `failed to fetch ${DEFAULT_WASM_BINARY_URL}: ${response.status} ${response.statusText}`,
    );
  }
  return new Uint8Array(await response.arrayBuffer());
}

function getGoConstructor(): new () => GoRuntime {
  return (globalThis as unknown as { Go: new () => GoRuntime }).Go;
}

function getOpenKakutouCharacter(): OpenKakutouCharacterGlobal {
  return (
    globalThis as unknown as {
      OpenKakutouCharacter: OpenKakutouCharacterGlobal;
    }
  ).OpenKakutouCharacter;
}

// Memoized across calls so repeated loadCharacter() calls don't re-fetch or
// re-instantiate the module. Reset between tests via resetWasmBridgeForTests.
let readyPromise: Promise<void> | null = null;

async function instantiateGoRuntime(options: WasmBridgeOptions): Promise<void> {
  const fetchWasmExecSource =
    options.fetchWasmExecSource ?? defaultFetchWasmExecSource;
  const fetchWasmBytes = options.fetchWasmBytes ?? defaultFetchWasmBytes;

  const wasmExecSource = await fetchWasmExecSource();
  // wasm_exec.js assigns `globalThis.Go = class {...}` itself — it never
  // relies on <script>/module top-level scoping — so executing its source
  // as a function body works identically in a real browser and under
  // jsdom/Node, without needing a DOM <script> element or a servable module
  // URL.
  new Function(wasmExecSource)();

  const go = new (getGoConstructor())();
  const wasmBytes = await fetchWasmBytes();
  const { instance } = await WebAssembly.instantiate(
    wasmBytes as BufferSource,
    go.importObject,
  );

  // Not awaited: Go's main() registers OpenKakutouCharacter synchronously
  // before blocking forever in select{} — awaiting go.run would hang since
  // main() never returns.
  go.run(instance);
}

function ensureGoRuntimeReady(options: WasmBridgeOptions): Promise<void> {
  if (!readyPromise) {
    readyPromise = instantiateGoRuntime(options).catch((err: unknown) => {
      // Allow a later call to retry instantiation instead of being stuck
      // with a permanently rejected memoized promise.
      readyPromise = null;
      throw err;
    });
  }
  return readyPromise;
}

/** Resets the memoized WASM instantiation. Test-only. */
export function resetWasmBridgeForTests(): void {
  readyPromise = null;
}

/**
 * Loads a character from raw `.def`/`.air`/`.sff`/`.cns` file bytes via the
 * `character` WASM module, returning a typed result instead of throwing on
 * malformed/missing input. Only the `name` field is mapped out of the full
 * JSON contract — this app has no use for the rest yet.
 */
export async function loadCharacter(
  defBytes: Uint8Array,
  airBytes: Uint8Array,
  sffBytes: Uint8Array,
  cnsBytes: Uint8Array,
  options: WasmBridgeOptions = {},
): Promise<CharacterResult> {
  await ensureGoRuntimeReady(options);

  const raw = getOpenKakutouCharacter().load(
    defBytes,
    airBytes,
    sffBytes,
    cnsBytes,
  );

  if (raw.error !== null) {
    return { ok: false, error: raw.error };
  }
  if (raw.character === null) {
    return {
      ok: false,
      error:
        "OpenKakutouCharacter.load returned neither a character nor an error",
    };
  }

  // `name`, `animations`, `sprites`, and `stateDefs` are picked out of the
  // full JSON payload, matching what `CharacterSummary` actually promises.
  const parsed = JSON.parse(raw.character) as {
    name: string;
    animations: Animation[];
    sprites: SpriteGroup[];
    stateDefs: StateDefBlob[];
  };
  return {
    ok: true,
    character: {
      name: parsed.name,
      animations: parsed.animations,
      sprites: parsed.sprites,
      stateDefs: parsed.stateDefs,
    },
  };
}

/**
 * Resolves one or more `(group, image)` sprite references against a loaded
 * `.sff` sheet into actual displayable RGBA pixels, via the `character`
 * WASM module's batched `resolveSprites` global — see that module's own
 * `docs/wasm.md` for the full contract. A request naming a sprite the
 * sheet has no metadata for resolves to a typed error for that entry only;
 * a `null` return (an internal panic recovered mid-call, before any
 * per-request result could be built) degrades to every request reporting
 * the same error, never a thrown exception.
 */
export async function resolveSprites(
  sffBytes: Uint8Array,
  requests: readonly (readonly [number, number])[],
  overrideBytes: Uint8Array | null = null,
  options: WasmBridgeOptions = {},
): Promise<SpritePixelResult[]> {
  await ensureGoRuntimeReady(options);

  const raw = getOpenKakutouCharacter().resolveSprites(
    sffBytes,
    requests.map(([group, image]) => [group, image]),
    overrideBytes,
  );

  if (raw === null) {
    return requests.map(() => ({
      ok: false,
      error: "OpenKakutouCharacter.resolveSprites returned no results",
    }));
  }

  return raw.map((result) => {
    if (result.error !== null) {
      return { ok: false, error: result.error };
    }
    if (result.pixels === null) {
      return {
        ok: false,
        error:
          "OpenKakutouCharacter.resolveSprites returned neither pixels nor an error for a request",
      };
    }
    return {
      ok: true,
      pixels: result.pixels,
      width: result.width,
      height: result.height,
    };
  });
}

/**
 * Parses a `.cmd` file's raw bytes via the `character` WASM module's
 * `loadCmd` global, returning a typed result instead of throwing on
 * malformed input — same discriminated-union contract as `loadCharacter`.
 * Unlike `loadCharacter`, `.cmd` parsing never touches `.def`/`.air`/`.sff`/
 * `.cns` at all: a `.cmd` file stands alone.
 */
export async function loadCmd(
  cmdBytes: Uint8Array,
  options: WasmBridgeOptions = {},
): Promise<CommandFileResult> {
  await ensureGoRuntimeReady(options);

  const raw = getOpenKakutouCharacter().loadCmd(cmdBytes);

  if (raw.error !== null) {
    return { ok: false, error: raw.error };
  }
  if (raw.commandFile === null) {
    return {
      ok: false,
      error:
        "OpenKakutouCharacter.loadCmd returned neither a command file nor an error",
    };
  }

  return {
    ok: true,
    commandFile: JSON.parse(raw.commandFile) as CommandFile,
  };
}
