import { describe, expect, it } from "vitest";
import type { BGElement } from "../wasm/stage-types.ts";
import type { Frame, Sprite } from "../wasm/types.ts";
import {
  PLACEHOLDER_SIZE,
  buildFighterDrawCommand,
  buildMatchDrawPlan,
  buildStageElementDrawCommand,
  resolveSpriteFlip,
  splitElementsByLayer,
  spriteKey,
  stageXToCanvasX,
} from "./scene-composition.ts";

function frame(overrides: Partial<Frame> = {}): Frame {
  return {
    group: 0,
    image: 0,
    x: 0,
    y: 0,
    time: 1,
    flip: "",
    blend: "",
    clsn1: [],
    clsn2: [],
    ...overrides,
  };
}

function sprite(overrides: Partial<Sprite> = {}): Sprite {
  return {
    group: 0,
    image: 0,
    width: 40,
    height: 80,
    axisX: 20,
    axisY: 79,
    palette: 0,
    ...overrides,
  };
}

function element(overrides: Partial<BGElement> = {}): BGElement {
  return {
    name: "layer",
    type: "normal",
    sprite: { group: 0, image: 0 },
    actionNumber: 0,
    layerNo: 0,
    startX: 0,
    startY: 0,
    deltaX: 1,
    deltaY: 1,
    tileX: 0,
    tileY: 0,
    tileSpacingX: 0,
    tileSpacingY: 0,
    ...overrides,
  };
}

describe("stageXToCanvasX", () => {
  it("centers stage x=0 at half the local coordinate width", () => {
    expect(stageXToCanvasX(0, 400)).toBe(200);
    expect(stageXToCanvasX(-50, 400)).toBe(150);
    expect(stageXToCanvasX(50, 400)).toBe(250);
  });
});

describe("spriteKey", () => {
  it("produces a stable, distinct key per (group, image) pair", () => {
    expect(spriteKey(0, 1)).toBe(spriteKey(0, 1));
    expect(spriteKey(0, 1)).not.toBe(spriteKey(1, 0));
  });
});

describe("resolveSpriteFlip", () => {
  it("mirrors horizontally when facing left, with no frame flip", () => {
    expect(resolveSpriteFlip(1, "")).toEqual({ flipH: true, flipV: false });
  });

  it("does not mirror horizontally when facing right, with no frame flip", () => {
    expect(resolveSpriteFlip(0, "")).toEqual({ flipH: false, flipV: false });
  });

  it("combines facing and frame flip as an XOR on the horizontal axis", () => {
    // Facing left AND the frame's own H flip cancel out.
    expect(resolveSpriteFlip(1, "H")).toEqual({ flipH: false, flipV: false });
  });

  it("applies vertical flip independently of facing", () => {
    expect(resolveSpriteFlip(0, "V")).toEqual({ flipH: false, flipV: true });
    expect(resolveSpriteFlip(1, "HV")).toEqual({ flipH: false, flipV: true });
  });
});

describe("splitElementsByLayer", () => {
  it("puts layerNo 0 elements behind and layerNo 1+ elements in front, preserving relative order", () => {
    const behind1 = element({ name: "behind1", layerNo: 0 });
    const front1 = element({ name: "front1", layerNo: 1 });
    const behind2 = element({ name: "behind2", layerNo: 0 });

    const { behind, front } = splitElementsByLayer([behind1, front1, behind2]);

    expect(behind.map((e) => e.name)).toEqual(["behind1", "behind2"]);
    expect(front.map((e) => e.name)).toEqual(["front1"]);
  });

  it("sorts by layerNo ascending before splitting, not by original array order", () => {
    const front = element({ name: "front", layerNo: 1 });
    const behind = element({ name: "behind", layerNo: 0 });

    const result = splitElementsByLayer([front, behind]);

    expect(result.behind.map((e) => e.name)).toEqual(["behind"]);
    expect(result.front.map((e) => e.name)).toEqual(["front"]);
  });

  it("returns two empty arrays for an empty element list", () => {
    expect(splitElementsByLayer([])).toEqual({ behind: [], front: [] });
  });
});

describe("buildFighterDrawCommand", () => {
  const spriteMetaByKey = new Map([[spriteKey(0, 0), sprite()]]);
  const pixelsByKey = new Map([
    [
      spriteKey(0, 0),
      { pixels: new Uint8Array(40 * 80 * 4), width: 40, height: 80 },
    ],
  ]);

  it("returns null for a blank frame (MUGEN's no-sprite-shown sentinel)", () => {
    const cmd = buildFighterDrawCommand(
      { x: 0, y: 0 },
      0,
      frame({ group: -1, image: -1 }),
      spriteMetaByKey,
      pixelsByKey,
      200,
      400,
    );

    expect(cmd).toBeNull();
  });

  it("places the sprite's axis point at the fighter's mapped canvas position", () => {
    const cmd = buildFighterDrawCommand(
      { x: 10, y: 0 },
      0,
      frame(),
      spriteMetaByKey,
      pixelsByKey,
      200, // zOffset
      400, // localCoordWidth
    );

    expect(cmd).not.toBeNull();
    expect(cmd?.canvasX).toBe(stageXToCanvasX(10, 400));
    expect(cmd?.canvasY).toBe(200); // zOffset - y(0)
    expect(cmd?.axisX).toBe(20);
    expect(cmd?.axisY).toBe(79);
    expect(cmd?.kind).toBe("sprite");
  });

  it("maps a fighter's vertical position (upward-positive) below the ground line correctly", () => {
    const cmd = buildFighterDrawCommand(
      { x: 0, y: 50 }, // 50 units airborne
      0,
      frame(),
      spriteMetaByKey,
      pixelsByKey,
      200,
      400,
    );

    expect(cmd?.canvasY).toBe(150); // zOffset(200) - y(50)
  });

  it("degrades to a placeholder when the sprite reference has no metadata at all", () => {
    const cmd = buildFighterDrawCommand(
      { x: 0, y: 0 },
      0,
      frame({ group: 9, image: 9 }),
      spriteMetaByKey,
      pixelsByKey,
      200,
      400,
    );

    expect(cmd?.kind).toBe("placeholder");
    expect(cmd?.axisX).toBe(PLACEHOLDER_SIZE / 2);
  });

  it("degrades to a metadata-sized placeholder when metadata exists but pixels failed to resolve", () => {
    const cmd = buildFighterDrawCommand(
      { x: 0, y: 0 },
      0,
      frame(),
      spriteMetaByKey,
      new Map(), // no resolved pixels at all
      200,
      400,
    );

    expect(cmd?.kind).toBe("placeholder");
    expect(cmd?.axisX).toBe(20);
    expect(cmd?.axisY).toBe(79);
  });

  it("passes through facing/frame flip resolution", () => {
    const cmd = buildFighterDrawCommand(
      { x: 0, y: 0 },
      1, // facing left
      frame(),
      spriteMetaByKey,
      pixelsByKey,
      200,
      400,
    );

    expect(cmd?.flipH).toBe(true);
    expect(cmd?.flipV).toBe(false);
  });
});

describe("buildStageElementDrawCommand", () => {
  const pixelsByKey = new Map([
    [
      spriteKey(0, 0),
      { pixels: new Uint8Array(64 * 32 * 4), width: 64, height: 32 },
    ],
  ]);

  it("draws a normal/parallax element at its configured start position, axis untreated", () => {
    const cmd = buildStageElementDrawCommand(
      element({ startX: 10, startY: 20 }),
      null,
      pixelsByKey,
      400,
    );

    expect(cmd).toEqual({
      kind: "sprite",
      canvasX: stageXToCanvasX(10, 400),
      canvasY: 20,
      axisX: 0,
      axisY: 0,
      width: 64,
      height: 32,
      pixels: pixelsByKey.get(spriteKey(0, 0))?.pixels,
      flipH: false,
      flipV: false,
    });
  });

  it("draws nothing for an anim element with no resolved sprite (no matching action block)", () => {
    const cmd = buildStageElementDrawCommand(
      element({ type: "anim", actionNumber: 5 }),
      null,
      pixelsByKey,
      400,
    );

    expect(cmd).toBeNull();
  });

  it("draws nothing for an anim element resolved to the blank sentinel", () => {
    const cmd = buildStageElementDrawCommand(
      element({ type: "anim", actionNumber: 5 }),
      { group: -1, image: -1 },
      pixelsByKey,
      400,
    );

    expect(cmd).toBeNull();
  });

  it("draws an anim element's currently resolved sprite when present", () => {
    const cmd = buildStageElementDrawCommand(
      element({ type: "anim", actionNumber: 5, startX: 0, startY: 0 }),
      { group: 0, image: 0 },
      pixelsByKey,
      400,
    );

    expect(cmd?.kind).toBe("sprite");
  });

  it("degrades to a placeholder when the sprite reference fails to resolve", () => {
    const cmd = buildStageElementDrawCommand(
      element({ sprite: { group: 99, image: 99 } }),
      null,
      pixelsByKey,
      400,
    );

    expect(cmd?.kind).toBe("placeholder");
  });
});

describe("buildMatchDrawPlan", () => {
  it("orders behind-layer elements, then both fighters (P1 before P2), then front-layer elements", () => {
    const pixelsByKey = new Map([
      [spriteKey(0, 0), { pixels: new Uint8Array(4), width: 1, height: 1 }],
    ]);
    const spriteMetaByKey = new Map([
      [spriteKey(0, 0), sprite({ width: 1, height: 1 })],
    ]);

    const plan = buildMatchDrawPlan({
      elements: [
        element({ name: "sky", layerNo: 0 }),
        element({ name: "foreground-fence", layerNo: 1 }),
      ],
      resolvedAnimSpriteByElementIndex: new Map(),
      fighters: [
        { position: { x: -10, y: 0 }, facing: 0, frame: frame() },
        { position: { x: 10, y: 0 }, facing: 1, frame: frame() },
      ],
      fighterSpriteMetaByKey: [spriteMetaByKey, spriteMetaByKey],
      fighterPixelsByKey: [pixelsByKey, pixelsByKey],
      stagePixelsByKey: pixelsByKey,
      zOffset: 100,
      localCoordWidth: 400,
    });

    // sky, P1, P2, fence -- behind/fighters/front ordering.
    expect(plan).toHaveLength(4);
    expect(plan[0].canvasY).toBe(0); // sky's startY
    expect(plan[1].canvasX).toBe(stageXToCanvasX(-10, 400)); // P1
    expect(plan[2].canvasX).toBe(stageXToCanvasX(10, 400)); // P2
    expect(plan[3].canvasY).toBe(0); // fence's startY
  });

  it("skips a fighter draw command entirely for a blank current frame", () => {
    const plan = buildMatchDrawPlan({
      elements: [],
      resolvedAnimSpriteByElementIndex: new Map(),
      fighters: [
        {
          position: { x: 0, y: 0 },
          facing: 0,
          frame: frame({ group: -1, image: -1 }),
        },
        {
          position: { x: 0, y: 0 },
          facing: 1,
          frame: frame({ group: -1, image: -1 }),
        },
      ],
      fighterSpriteMetaByKey: [new Map(), new Map()],
      fighterPixelsByKey: [new Map(), new Map()],
      stagePixelsByKey: new Map(),
      zOffset: 0,
      localCoordWidth: 400,
    });

    expect(plan).toHaveLength(0);
  });
});
