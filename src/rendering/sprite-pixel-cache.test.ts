import { describe, expect, it, vi } from "vitest";
import { spriteKey } from "./scene-composition.ts";
import { createSpritePixelCache } from "./sprite-pixel-cache.ts";

const sffBytes = new Uint8Array([1, 2, 3]);

function okResult(width: number, height: number) {
  return {
    ok: true as const,
    pixels: new Uint8Array(width * height * 4),
    width,
    height,
  };
}
function errResult(error: string) {
  return { ok: false as const, error };
}

describe("createSpritePixelCache", () => {
  it("resolves and stores a sprite it has never seen before", async () => {
    const cache = createSpritePixelCache();
    const resolveFn = vi.fn(async () => [okResult(10, 20)]);

    await cache.resolveMissing(sffBytes, [[0, 0]], resolveFn);

    expect(resolveFn).toHaveBeenCalledTimes(1);
    expect(cache.resolved.get(spriteKey(0, 0))).toEqual({
      pixels: expect.any(Uint8Array),
      width: 10,
      height: 20,
    });
  });

  it("never re-requests a sprite already successfully resolved", async () => {
    const cache = createSpritePixelCache();
    const resolveFn = vi.fn(async () => [okResult(10, 20)]);

    await cache.resolveMissing(sffBytes, [[0, 0]], resolveFn);
    await cache.resolveMissing(sffBytes, [[0, 0]], resolveFn);

    expect(resolveFn).toHaveBeenCalledTimes(1);
  });

  it("never re-requests a sprite that already failed to resolve", async () => {
    const cache = createSpritePixelCache();
    const resolveFn = vi.fn(async () => [errResult("sprite not found: 9,9")]);

    await cache.resolveMissing(sffBytes, [[9, 9]], resolveFn);
    await cache.resolveMissing(sffBytes, [[9, 9]], resolveFn);

    expect(resolveFn).toHaveBeenCalledTimes(1);
    expect(cache.resolved.has(spriteKey(9, 9))).toBe(false);
  });

  it("makes no call at all when every requested sprite is already known (hit or prior failure)", async () => {
    const cache = createSpritePixelCache();
    const resolveFn = vi.fn(async () => [okResult(1, 1)]);
    await cache.resolveMissing(sffBytes, [[0, 0]], resolveFn);

    resolveFn.mockClear();
    await cache.resolveMissing(sffBytes, [[0, 0]], resolveFn);

    expect(resolveFn).not.toHaveBeenCalled();
  });

  it("batches only the genuinely new requests in one call, alongside already-known ones", async () => {
    const cache = createSpritePixelCache();
    const firstResolve = vi.fn(async () => [okResult(1, 1)]);
    await cache.resolveMissing(sffBytes, [[0, 0]], firstResolve);

    const secondResolve = vi.fn(
      async (
        _sff: Uint8Array,
        requests: readonly (readonly [number, number])[],
      ) => requests.map(() => okResult(2, 2)),
    );
    await cache.resolveMissing(
      sffBytes,
      [
        [0, 0],
        [1, 1],
      ],
      secondResolve,
    );

    expect(secondResolve).toHaveBeenCalledWith(sffBytes, [[1, 1]]);
  });

  it("resolves an empty request list without calling the resolver", async () => {
    const cache = createSpritePixelCache();
    const resolveFn = vi.fn(async () => []);

    await cache.resolveMissing(sffBytes, [], resolveFn);

    expect(resolveFn).not.toHaveBeenCalled();
  });
});
