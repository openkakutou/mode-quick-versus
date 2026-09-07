// End-to-end sanity check (mirrors `roster/discovery.smoke.test.ts`'s own
// naming/intent): a real character loaded via the real `character` WASM
// module, assembled into an `engine` `newMatch` request via
// `match-config.ts`, driven through the real `engine` WASM module. Proves
// the two modules' shared Go types (`character/cns`, `character/air`) really
// do round-trip through this app's JSON boundary without any field-mapping
// mismatch — not just that the TypeScript types compile.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadCharacter, resetWasmBridgeForTests } from "../wasm/bridge.ts";
import {
  newMatch,
  resetEngineWasmBridgeForTests,
  tick,
} from "../wasm/engine-bridge.ts";
import type { StageSummary } from "../wasm/stage-types.ts";
import {
  buildNewMatchRequest,
  buildStartingFighters,
  resolveStageBoundaries,
} from "./match-config.ts";

const publicWasmDir = path.resolve(
  import.meta.dirname,
  "..",
  "..",
  "public",
  "wasm",
);
const characterTestOptions = {
  fetchWasmExecSource: async () =>
    readFileSync(path.join(publicWasmDir, "wasm_exec.js"), "utf-8"),
  fetchWasmBytes: async () =>
    new Uint8Array(readFileSync(path.join(publicWasmDir, "character.wasm"))),
};
const engineTestOptions = {
  fetchWasmExecSource: async () =>
    readFileSync(path.join(publicWasmDir, "engine-wasm_exec.js"), "utf-8"),
  fetchWasmBytes: async () =>
    new Uint8Array(readFileSync(path.join(publicWasmDir, "engine.wasm"))),
};

const testdataDir = path.resolve(import.meta.dirname, "..", "wasm", "testdata");
function fixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(path.join(testdataDir, name)));
}
function textBytes(text: string): Uint8Array {
  return new Uint8Array(new TextEncoder().encode(text));
}

const defBytes = textBytes("[Info]\nname = Smoke Test Fighter\n");
const airBytes = fixture("sample.air");
const sffBytes = fixture("v1-basic.sff");
const cnsBytes = fixture("sample.cns");

const noBoundaryStage: StageSummary = {
  name: "Smoke Test Stage",
  bgDef: {
    spriteFile: "",
    localCoordWidth: 400,
    localCoordHeight: 240,
    zOffset: 200,
    zoomOut: 1,
    zoomIn: 1,
    modelFile: "",
    xScale: 1,
    yScale: 1,
  },
  elements: [],
  animations: {},
  stageBoundaries: { left: 0, right: 0, topBound: 0, bottomBound: 0 },
};

it("resolveStageBoundaries falls back to the stage's own local coordinate width", () => {
  const bounds = resolveStageBoundaries(noBoundaryStage);
  expect(bounds.left).toBe(-200);
  expect(bounds.right).toBe(200);
});

describe("buildNewMatchRequest against the real character and engine WASM modules", () => {
  it("starts and ticks a real match from a real loaded character's state defs/animations", async () => {
    resetWasmBridgeForTests();
    resetEngineWasmBridgeForTests();

    const loaded = await loadCharacter(
      defBytes,
      airBytes,
      sffBytes,
      cnsBytes,
      characterTestOptions,
    );
    if (!loaded.ok) throw new Error(`expected an ok load: ${loaded.error}`);

    const request = buildNewMatchRequest(
      loaded.character,
      loaded.character,
      noBoundaryStage,
      { rounds: 3, timeLimit: { seconds: 99 } },
    );

    const created = await newMatch(request, engineTestOptions);
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error(`expected an ok result: ${created.error}`);
    // sample.cns's Statedef 0 has anim=0, which sample.air has no [Begin
    // Action 0] block for -- engine still starts cleanly (animNo just
    // resolves to nothing drawable, a rendering-side concern, not a match-
    // start error).
    expect(created.data.animations[0].animNo).toBe(0);
    expect(created.data.state.fighters[0].health).toBe(1000);

    const bounds = resolveStageBoundaries(noBoundaryStage);
    const [p1] = buildStartingFighters(bounds);
    expect(created.data.state.fighters[0].position.x).toBe(p1.position.x);

    const afterTick = await tick(
      { matchId: created.data.matchId, inputs: [{}, {}] },
      engineTestOptions,
    );
    expect(afterTick.ok).toBe(true);
    if (!afterTick.ok)
      throw new Error(`expected an ok result: ${afterTick.error}`);
    expect(afterTick.data.animations[0].animTime).toBe(1);
  });
});
