import type { Sound } from "../wasm/types.ts";
// The Web Audio API driver for match audio (backlog item 013): stage
// background music on loop, and one-shot character sound effects triggered
// live during combat. This is the DOM/`AudioContext` glue on top of the
// pure `pcm-conversion.ts`/`sound-lookup.ts` logic — mirrors the existing
// pure/impure split already established for rendering (`scene-
// composition.ts` resolves what to draw, `match-renderer.ts` just draws).
//
// Never throws, and never rejects a returned promise: an unsupported
// environment (no `AudioContext`), an undecodable music file, or a
// triggered sound with no matching decoded sample all degrade to silence
// for that one thing, matching this app's existing "degrade, don't crash
// or stall the match" convention (`.vibe/decisions/004`).
import { buildPlanarChannels } from "./pcm-conversion.ts";

/**
 * Caps how many one-shot sound effects can be playing at once. A worst-case
 * catch-up burst (several simulation ticks in one rendered frame, each
 * fighter triggering more than one `PlaySnd`) could otherwise spawn an
 * unbounded number of `AudioBufferSourceNode`s in a single frame; past this
 * cap, the newest trigger is dropped silently rather than piling up voices.
 */
const MAX_CONCURRENT_VOICES = 16;

export interface MatchAudioOptions {
  /** Constructs the underlying `AudioContext`. Defaults to the real global `AudioContext` (falling back to `webkitAudioContext`). Overridable for testing, and for an environment where audio is unsupported -- a thrown error here degrades this whole controller to a silent no-op, it never propagates to the caller. */
  createAudioContext?: () => AudioContext;
  /** Decodes a stage's raw (compressed) music file bytes. Defaults to `ctx.decodeAudioData(data)`. */
  decodeAudioData?: (
    ctx: AudioContext,
    data: ArrayBuffer,
  ) => Promise<AudioBuffer>;
  /** Injectable for testing the visibility-driven `resume()` behavior. Defaults to the real `document`. */
  document?: Pick<
    Document,
    "addEventListener" | "removeEventListener" | "visibilityState"
  >;
}

export interface MatchAudio {
  /**
   * Starts this match's background music on loop, replacing any music
   * already playing. `null`/`undefined`/empty bytes (a stage with no
   * `[Music]` section), or any decode failure, degrades to no music
   * playing -- this never throws or rejects.
   */
  playMusic(musicBytes: Uint8Array | null | undefined): Promise<void>;
  /**
   * Plays one already-decoded sound effect immediately, fire-and-forget.
   * The underlying `AudioBuffer` is built once per distinct `Sound` and
   * reused for every later play of that same sound (keyed by object
   * identity, matching how a character's own `sounds` array is stable for
   * the life of a match) -- never throws.
   */
  playSound(sound: Sound): void;
  /** Stops all audio (music and any still-playing one-shots) and releases the audio context. Idempotent. */
  stop(): void;
}

function defaultCreateAudioContext(): AudioContext {
  const ctor =
    globalThis.AudioContext ??
    (globalThis as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!ctor) {
    throw new Error("AudioContext is not supported in this environment");
  }
  return new ctor();
}

function defaultDecodeAudioData(
  ctx: AudioContext,
  data: ArrayBuffer,
): Promise<AudioBuffer> {
  return ctx.decodeAudioData(data);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

/** Builds a real `AudioBuffer` from a decoded `Sound`'s interleaved PCM, or `null` when there is nothing to play (empty/degenerate PCM) -- never throws; a `createBuffer` failure (e.g. an invalid sample rate) also degrades to `null`. */
function buildAudioBuffer(ctx: AudioContext, sound: Sound): AudioBuffer | null {
  const channels = buildPlanarChannels(sound.pcm, sound.channels);
  const frameCount = channels[0]?.length ?? 0;
  if (channels.length === 0 || frameCount === 0) return null;

  try {
    const buffer = ctx.createBuffer(
      channels.length,
      frameCount,
      sound.sampleRate > 0 ? sound.sampleRate : 44100,
    );
    channels.forEach((data, index) => buffer.copyToChannel(data, index));
    return buffer;
  } catch {
    return null;
  }
}

export function createMatchAudio(options: MatchAudioOptions = {}): MatchAudio {
  const decodeAudioData = options.decodeAudioData ?? defaultDecodeAudioData;
  const doc = options.document ?? document;

  let ctx: AudioContext | null;
  try {
    ctx = (options.createAudioContext ?? defaultCreateAudioContext)();
  } catch {
    // Unsupported environment (no AudioContext at all) -- degrade this
    // whole controller to a silent no-op rather than ever throwing into
    // the caller (the match itself must never fail to start over this).
    ctx = null;
  }

  let stopped = false;
  let musicSource: AudioBufferSourceNode | null = null;
  const bufferCache = new WeakMap<Sound, AudioBuffer>();
  const activeVoices = new Set<AudioBufferSourceNode>();

  function handleVisibilityChange(): void {
    if (!ctx || stopped) return;
    if (doc.visibilityState === "visible" && ctx.state === "suspended") {
      // Fire-and-forget: never awaited, and never gates tick/audio work on
      // whether it has settled yet -- a still-suspended context simply
      // stays silent for a little longer, it never blocks anything.
      ctx.resume().catch(() => {});
    }
  }

  if (ctx) {
    doc.addEventListener("visibilitychange", handleVisibilityChange);
  }

  async function playMusic(
    musicBytes: Uint8Array | null | undefined,
  ): Promise<void> {
    if (!ctx || stopped || !musicBytes || musicBytes.length === 0) return;

    let buffer: AudioBuffer;
    try {
      buffer = await decodeAudioData(ctx, toArrayBuffer(musicBytes));
    } catch {
      return; // Undecodable/corrupt music -- degrade to silence.
    }
    if (!ctx || stopped) return; // stop() may have run while decoding.

    stopMusic();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(ctx.destination);
    musicSource = source;
    try {
      source.start(0);
    } catch {
      musicSource = null;
    }
  }

  function playSound(sound: Sound): void {
    if (!ctx || stopped) return;
    if (activeVoices.size >= MAX_CONCURRENT_VOICES) return; // Drop the newest trigger silently rather than pile up voices.

    let buffer = bufferCache.get(sound);
    if (!buffer) {
      const built = buildAudioBuffer(ctx, sound);
      if (!built) return; // No PCM to play -- degrade to silence.
      buffer = built;
      bufferCache.set(sound, buffer);
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    activeVoices.add(source);
    source.onended = () => activeVoices.delete(source);
    try {
      source.start(0);
    } catch {
      activeVoices.delete(source);
    }
  }

  function stopMusic(): void {
    if (!musicSource) return;
    try {
      musicSource.stop();
    } catch {
      // Already stopped/ended -- nothing left to do.
    }
    musicSource = null;
  }

  function stop(): void {
    if (stopped) return;
    stopped = true;
    if (ctx)
      doc.removeEventListener("visibilitychange", handleVisibilityChange);
    stopMusic();
    for (const source of activeVoices) {
      try {
        source.stop();
      } catch {
        // Already stopped/ended -- nothing left to do.
      }
    }
    activeVoices.clear();
    if (ctx) {
      ctx.close().catch(() => {});
    }
  }

  return { playMusic, playSound, stop };
}
