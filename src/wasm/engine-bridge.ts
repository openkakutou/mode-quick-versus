// Bridge to the `engine` WASM module: loads `engine-wasm_exec.js`,
// instantiates `engine.wasm`, and exposes typed wrappers around the global
// `OpenKakutouEngine.newMatch`/`tick`/`closeMatch` calls. A third,
// independent WASM module from `character`'s/`stage`'s own bridges — same
// loading strategy (injectable fetch, `Function`-executed `wasm_exec.js`,
// unawaited `go.run`) as both, but a different call shape: every exposed
// function takes and returns exactly one JSON string rather than typed
// arguments, so this bridge also owns `JSON.stringify`/`JSON.parse` at the
// boundary. See `.vibe/decisions/004-match-rendering-architecture.md` for
// why only `newMatch`/`tick`/`closeMatch` are exposed (not `resetRound`).
import type {
  EngineResult,
  NewMatchRequest,
  NewMatchResponseData,
  TickRequest,
  TickResponseData,
} from "./engine-types.ts";

const DEFAULT_WASM_EXEC_URL = "./wasm/engine-wasm_exec.js";
const DEFAULT_WASM_BINARY_URL = "./wasm/engine.wasm";

/** The `Go` runtime instance `wasm_exec.js` (via `new globalThis.Go()`) produces. */
interface GoRuntime {
  importObject: WebAssembly.Imports;
  run(instance: WebAssembly.Instance): Promise<void>;
}

/** The `{data, error}` shape returned synchronously by every `OpenKakutouEngine` call. */
interface RawCallResult {
  data: string | null;
  error: string | null;
}

interface OpenKakutouEngineGlobal {
  newMatch(requestJSON: string): RawCallResult;
  tick(requestJSON: string): RawCallResult;
  closeMatch(requestJSON: string): RawCallResult;
}

export interface EngineWasmBridgeOptions {
  /** Fetches `engine-wasm_exec.js`'s source text. Defaults to `fetch(DEFAULT_WASM_EXEC_URL)`. */
  fetchWasmExecSource?: () => Promise<string>;
  /** Fetches `engine.wasm`'s raw bytes. Defaults to `fetch(DEFAULT_WASM_BINARY_URL)`. */
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

function getOpenKakutouEngine(): OpenKakutouEngineGlobal {
  return (
    globalThis as unknown as { OpenKakutouEngine: OpenKakutouEngineGlobal }
  ).OpenKakutouEngine;
}

// Memoized across calls so repeated bridge calls don't re-fetch or
// re-instantiate the module. Reset between tests via
// resetEngineWasmBridgeForTests. Kept as its own module-level variable,
// independent of the character/stage bridges' own `readyPromise` — each
// WASM binary needs its own Go runtime instance.
let readyPromise: Promise<void> | null = null;

async function instantiateGoRuntime(
  options: EngineWasmBridgeOptions,
): Promise<void> {
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

  // Not awaited: Go's main() registers OpenKakutouEngine synchronously
  // before blocking forever in select{} — awaiting go.run would hang since
  // main() never returns.
  go.run(instance);
}

function ensureGoRuntimeReady(options: EngineWasmBridgeOptions): Promise<void> {
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
export function resetEngineWasmBridgeForTests(): void {
  readyPromise = null;
}

/** Parses a raw `{data, error}` envelope into a typed discriminated-union result, never throwing on malformed JSON. */
function parseEnvelope<T>(
  raw: RawCallResult,
  callName: string,
): EngineResult<T> {
  if (raw.error !== null) {
    return { ok: false, error: raw.error };
  }
  if (raw.data === null) {
    return {
      ok: false,
      error: `OpenKakutouEngine.${callName} returned neither data nor an error`,
    };
  }
  try {
    return { ok: true, data: JSON.parse(raw.data) as T };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: `OpenKakutouEngine.${callName} returned malformed JSON: ${message}`,
    };
  }
}

/**
 * Starts a new match via the `engine` WASM module: builds round 1 from
 * both fighters' loaded combat programs and starting position/state/
 * health, returning an opaque match ID `tick`/`closeMatch` operate on
 * going forward.
 */
export async function newMatch(
  request: NewMatchRequest,
  options: EngineWasmBridgeOptions = {},
): Promise<EngineResult<NewMatchResponseData>> {
  await ensureGoRuntimeReady(options);
  const raw = getOpenKakutouEngine().newMatch(JSON.stringify(request));
  return parseEnvelope<NewMatchResponseData>(raw, "newMatch");
}

/**
 * Advances `request.matchId`'s session by exactly one simulation tick and
 * returns the resulting state, this tick's round outcome (if any), and
 * updated match progress.
 */
export async function tick(
  request: TickRequest,
  options: EngineWasmBridgeOptions = {},
): Promise<EngineResult<TickResponseData>> {
  await ensureGoRuntimeReady(options);
  const raw = getOpenKakutouEngine().tick(JSON.stringify(request));
  return parseEnvelope<TickResponseData>(raw, "tick");
}

/** Releases `matchId`'s Go-resident session state. A caller done with a match ID (match ended, page navigated away) should call this, or that session's runtime state stays resident for the life of the WASM instance. */
export async function closeMatch(
  matchId: number,
  options: EngineWasmBridgeOptions = {},
): Promise<EngineResult<Record<string, never>>> {
  await ensureGoRuntimeReady(options);
  const raw = getOpenKakutouEngine().closeMatch(JSON.stringify({ matchId }));
  return parseEnvelope<Record<string, never>>(raw, "closeMatch");
}
