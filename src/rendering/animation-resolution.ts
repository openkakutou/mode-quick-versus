// Client-side reimplementation of `engine`'s own Go `currentFrame`/
// `findAnimation` helpers (see `engine`'s `tick.go`) — pure, no WASM
// involved. `engine`'s WASM response exposes each fighter's resolved
// `animNo`/`animTime` (ticks elapsed since that animation started) but
// never a resolved frame index (deliberate, see `engine`'s own
// `.vibe/decisions/011`/`012`), so a renderer must walk the frame sequence
// itself to know which sprite is currently showing. This must mirror
// `engine`'s algorithm exactly — see
// `.vibe/decisions/004-match-rendering-architecture.md` point 2.
import type { Animation, Frame } from "../wasm/types.ts";

const ZERO_FRAME: Frame = {
  group: 0,
  image: 0,
  x: 0,
  y: 0,
  time: 0,
  flip: "",
  blend: "",
  clsn1: [],
  clsn2: [],
};

/**
 * Returns the `Frame` of `frames` active at `animTime` ticks since the
 * animation started playing, honoring `loopStart` once the sequence has
 * played through once. A frame whose `time` is zero or negative holds
 * indefinitely (MUGEN/Ikemen's "-1 = infinite" convention, generalized to
 * "non-positive" so a malformed zero-duration frame can never loop
 * forever). Returns the zero `Frame` if `frames` is empty. An out-of-range
 * `loopStart` defaults to index 0 rather than producing an invalid index.
 */
export function resolveCurrentFrame(
  frames: readonly Frame[],
  loopStart: number,
  animTime: number,
): Frame {
  if (frames.length === 0) return ZERO_FRAME;

  let elapsed = animTime;
  let i = 0;
  // A malformed/negative animTime falls straight through to frame 0 on the
  // first iteration below (elapsed < frames[0].time is trivially true for
  // any non-positive elapsed against a normal positive-time first frame).
  for (;;) {
    const f = frames[i];
    if (f.time <= 0 || elapsed < f.time) return f;
    elapsed -= f.time;
    i++;
    if (i >= frames.length) {
      i = loopStart >= 0 && loopStart < frames.length ? loopStart : 0;
    }
  }
}

/** Returns the `Animation` in `animations` matching `number`, or `undefined` when none matches. */
export function findAnimationByNumber(
  animations: readonly Animation[],
  number: number,
): Animation | undefined {
  return animations.find((a) => a.number === number);
}
