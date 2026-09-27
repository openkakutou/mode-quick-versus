// Pure PCM conversion logic for a decoded character sound (backlog item
// 013): `character`'s WASM contract (`wasm/types.ts`'s `Sound.pcm`) is a
// plain, interleaved, signed-16-bit JSON number array — never a
// `Uint8Array`, unlike every other binary payload this app's bridges
// expose. The Web Audio API instead wants one planar `Float32Array` per
// channel, each sample normalized to `[-1, 1]`. No DOM/`AudioContext`
// dependency here — `match-audio.ts` is the only caller, and owns turning
// the result into a real `AudioBuffer`.

/**
 * Deinterleaves and normalizes a signed-16-bit interleaved PCM array into
 * one `Float32Array` per channel, each sample scaled to `[-1, 1]`. A
 * non-positive `channels` count (malformed decoded data) degrades to mono
 * rather than dividing by zero or throwing; a sample outside the valid
 * signed-16-bit range clamps to `[-1, 1]` instead of overflowing past it.
 * An empty `pcm` array returns `channels` worth of empty `Float32Array`s —
 * the caller treats that as "nothing to play", not an error.
 */
export function buildPlanarChannels(
  pcm: readonly number[],
  channels: number,
): Float32Array<ArrayBuffer>[] {
  const safeChannels = channels > 0 ? Math.floor(channels) : 1;
  const frameCount = Math.floor(pcm.length / safeChannels);

  const result: Float32Array<ArrayBuffer>[] = [];
  for (let channel = 0; channel < safeChannels; channel++) {
    const channelData: Float32Array<ArrayBuffer> = new Float32Array(frameCount);
    for (let frame = 0; frame < frameCount; frame++) {
      channelData[frame] = int16ToNormalizedFloat(
        pcm[frame * safeChannels + channel] ?? 0,
      );
    }
    result.push(channelData);
  }
  return result;
}

/** Normalizes one signed-16-bit sample to `[-1, 1]`, clamping an out-of-range value instead of overflowing past it. */
function int16ToNormalizedFloat(sample: number): number {
  return Math.max(-1, Math.min(1, sample / 32768));
}
