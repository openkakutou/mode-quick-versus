// Bridge to the `stage` WASM module: loads `stage-wasm_exec.js`,
// instantiates `stage.wasm`, and exposes a typed wrapper around the global
// `OpenKakutouStage.load` call. A second, independent WASM module from
// `character`'s own bridge.ts — see .vibe/decisions/002 for why this is a
// separate bridge file (and a separate `wasm_exec.js` on disk) rather than
// a shared/generalized loader. Same loading strategy (injectable fetch,
// `Function`-executed `wasm_exec.js`, unawaited `go.run`) and discriminated-
// union result shape as `bridge.ts`.
import type { StageResult } from "./stage-types.ts";

const DEFAULT_WASM_EXEC_URL = "./wasm/stage-wasm_exec.js";
const DEFAULT_WASM_BINARY_URL = "./wasm/stage.wasm";

/** The `Go` runtime instance `wasm_exec.js` (via `new globalThis.Go()`) produces. */
interface GoRuntime {
  importObject: WebAssembly.Imports;
  run(instance: WebAssembly.Instance): Promise<void>;
}

/** The `{stage, error}` shape returned synchronously by `OpenKakutouStage.load`. */
interface RawLoadResult {
  stage: string | null;
  error: string | null;
}

interface OpenKakutouStageGlobal {
  load(defBytes: Uint8Array): RawLoadResult;
}

export interface StageWasmBridgeOptions {
  /** Fetches `stage-wasm_exec.js`'s source text. Defaults to `fetch(DEFAULT_WASM_EXEC_URL)`. */
  fetchWasmExecSource?: () => Promise<string>;
  /** Fetches `stage.wasm`'s raw bytes. Defaults to `fetch(DEFAULT_WASM_BINARY_URL)`. */
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

function getOpenKakutouStage(): OpenKakutouStageGlobal {
  return (
    globalThis as unknown as {
      OpenKakutouStage: OpenKakutouStageGlobal;
    }
  ).OpenKakutouStage;
}

// Memoized across calls so repeated loadStage() calls don't re-fetch or
// re-instantiate the module. Reset between tests via
// resetStageWasmBridgeForTests. Kept as its own module-level variable,
// independent of bridge.ts's own `readyPromise` for the character module —
// each WASM binary needs its own Go runtime instance.
let readyPromise: Promise<void> | null = null;

async function instantiateGoRuntime(
  options: StageWasmBridgeOptions,
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

  // Not awaited: Go's main() registers OpenKakutouStage synchronously
  // before blocking forever in select{} — awaiting go.run would hang since
  // main() never returns.
  go.run(instance);
}

function ensureGoRuntimeReady(options: StageWasmBridgeOptions): Promise<void> {
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
export function resetStageWasmBridgeForTests(): void {
  readyPromise = null;
}

/**
 * Loads a stage from raw `.def` file bytes via the `stage` WASM module,
 * returning a typed result instead of throwing on malformed input. Only
 * the `name` field is mapped out of the full JSON contract — this app has
 * no use for the rest yet.
 */
export async function loadStage(
  defBytes: Uint8Array,
  options: StageWasmBridgeOptions = {},
): Promise<StageResult> {
  await ensureGoRuntimeReady(options);

  const raw = getOpenKakutouStage().load(defBytes);

  if (raw.error !== null) {
    return { ok: false, error: raw.error };
  }
  if (raw.stage === null) {
    return {
      ok: false,
      error: "OpenKakutouStage.load returned neither a stage nor an error",
    };
  }

  // Only `name` is picked out of the full JSON payload, matching what
  // `StageSummary` actually promises — the WASM module's contract carries
  // much more (BG elements, camera bounds, animations) that this app has
  // no use for yet.
  const parsed = JSON.parse(raw.stage) as { name: string };
  return { ok: true, stage: { name: parsed.name } };
}
