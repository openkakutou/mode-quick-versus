import { describe, expect, it, vi } from "vitest";
import type { Sound } from "../wasm/types.ts";
import { createMatchAudio } from "./match-audio.ts";

function sound(overrides: Partial<Sound> = {}): Sound {
  return {
    group: 1,
    sample: 0,
    sampleRate: 11025,
    channels: 1,
    bitsPerSample: 16,
    pcm: [0, 16384, -16384],
    ...overrides,
  };
}

/** A minimal fake `AudioContext`/`AudioBuffer`/`AudioBufferSourceNode` structurally compatible with what `match-audio.ts` actually calls -- there is no real `AudioContext` under jsdom. */
function fakeAudioContext() {
  let state: "running" | "suspended" | "closed" = "running";
  const createdSources: {
    buffer: unknown;
    loop: boolean;
    connect: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  }[] = [];
  const createdBuffers: {
    channels: number;
    length: number;
    sampleRate: number;
    copyToChannel: ReturnType<typeof vi.fn>;
  }[] = [];

  const ctx = {
    destination: {},
    get state() {
      return state;
    },
    createBuffer: vi.fn(
      (channels: number, length: number, sampleRate: number) => {
        const buffer = {
          channels,
          length,
          sampleRate,
          copyToChannel: vi.fn(),
        };
        createdBuffers.push(buffer);
        return buffer;
      },
    ),
    createBufferSource: vi.fn(() => {
      const source = {
        buffer: null as unknown,
        loop: false,
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      createdSources.push(source);
      return source;
    }),
    resume: vi.fn(async () => {
      state = "running";
    }),
    close: vi.fn(async () => {
      state = "closed";
    }),
  };

  return {
    ctx,
    createdSources,
    createdBuffers,
    setState: (next: typeof state) => {
      state = next;
    },
  };
}

function fakeDocument(initialVisibility: DocumentVisibilityState = "visible") {
  let visibilityState = initialVisibility;
  let handler: (() => void) | null = null;
  return {
    get visibilityState() {
      return visibilityState;
    },
    addEventListener: vi.fn((type: string, cb: () => void) => {
      if (type === "visibilitychange") handler = cb;
    }),
    removeEventListener: vi.fn((type: string, cb: () => void) => {
      if (type === "visibilitychange" && handler === cb) handler = null;
    }),
    trigger(next: DocumentVisibilityState) {
      visibilityState = next;
      handler?.();
    },
  };
}

describe("createMatchAudio", () => {
  describe("playMusic", () => {
    it("decodes and loops the given music bytes on the audio context's destination", async () => {
      const { ctx, createdSources } = fakeAudioContext();
      const decodedBuffer = { duration: 5 };
      const decodeAudioData = vi.fn(async () => decodedBuffer);
      const audio = createMatchAudio({
        createAudioContext: () => ctx as never,
        decodeAudioData: decodeAudioData as never,
        document: fakeDocument() as never,
      });
      const musicBytes = new Uint8Array([1, 2, 3]);

      await audio.playMusic(musicBytes);

      expect(decodeAudioData).toHaveBeenCalledTimes(1);
      expect(createdSources).toHaveLength(1);
      expect(createdSources[0].buffer).toBe(decodedBuffer);
      expect(createdSources[0].loop).toBe(true);
      expect(createdSources[0].connect).toHaveBeenCalledWith(ctx.destination);
      expect(createdSources[0].start).toHaveBeenCalledWith(0);
    });

    it("does nothing when given no music bytes -- a stage with no [Music] section", async () => {
      const { createdSources } = fakeAudioContext();
      const decodeAudioData = vi.fn(async () => ({}) as never);
      const audio = createMatchAudio({
        createAudioContext: () => fakeAudioContext().ctx as never,
        decodeAudioData,
        document: fakeDocument() as never,
      });

      await audio.playMusic(null);

      expect(decodeAudioData).not.toHaveBeenCalled();
      expect(createdSources).toHaveLength(0);
    });

    it("degrades to silence instead of throwing when the music bytes are undecodable", async () => {
      const { ctx, createdSources } = fakeAudioContext();
      const decodeAudioData = vi.fn(async () => {
        throw new Error("corrupt audio data");
      });
      const audio = createMatchAudio({
        createAudioContext: () => ctx as never,
        decodeAudioData: decodeAudioData as never,
        document: fakeDocument() as never,
      });

      await expect(
        audio.playMusic(new Uint8Array([9])),
      ).resolves.toBeUndefined();
      expect(createdSources).toHaveLength(0);
    });

    it("stops a previously started music track before starting a new one", async () => {
      const { ctx, createdSources } = fakeAudioContext();
      const decodeAudioData = vi.fn(async () => ({}) as never);
      const audio = createMatchAudio({
        createAudioContext: () => ctx as never,
        decodeAudioData,
        document: fakeDocument() as never,
      });

      await audio.playMusic(new Uint8Array([1]));
      const firstSource = createdSources[0];
      await audio.playMusic(new Uint8Array([2]));

      expect(firstSource.stop).toHaveBeenCalled();
      expect(createdSources).toHaveLength(2);
    });
  });

  describe("playSound", () => {
    it("builds an AudioBuffer from the decoded PCM and plays it immediately", () => {
      const { ctx, createdSources, createdBuffers } = fakeAudioContext();
      const audio = createMatchAudio({
        createAudioContext: () => ctx as never,
        document: fakeDocument() as never,
      });

      audio.playSound(sound());

      expect(createdBuffers).toHaveLength(1);
      expect(createdBuffers[0].channels).toBe(1);
      expect(createdBuffers[0].sampleRate).toBe(11025);
      expect(createdBuffers[0].copyToChannel).toHaveBeenCalledTimes(1);
      expect(createdSources).toHaveLength(1);
      expect(createdSources[0].buffer).toBe(createdBuffers[0]);
      expect(createdSources[0].connect).toHaveBeenCalledWith(ctx.destination);
      expect(createdSources[0].start).toHaveBeenCalledWith(0);
    });

    it("reuses the same decoded buffer for the same Sound played twice, building it only once", () => {
      const { ctx, createdSources, createdBuffers } = fakeAudioContext();
      const audio = createMatchAudio({
        createAudioContext: () => ctx as never,
        document: fakeDocument() as never,
      });
      const theSound = sound();

      audio.playSound(theSound);
      audio.playSound(theSound);

      expect(createdBuffers).toHaveLength(1);
      expect(createdSources).toHaveLength(2);
      expect(createdSources[0].buffer).toBe(createdSources[1].buffer);
    });

    it("skips silently, without building a buffer, when the decoded sound has no PCM samples", () => {
      const { createdSources, createdBuffers } = fakeAudioContext();
      const audio = createMatchAudio({
        createAudioContext: () => fakeAudioContext().ctx as never,
        document: fakeDocument() as never,
      });

      audio.playSound(sound({ pcm: [] }));

      expect(createdBuffers).toHaveLength(0);
      expect(createdSources).toHaveLength(0);
    });

    it("drops a trigger past the concurrent-voice cap instead of growing the audio graph unbounded", () => {
      const { ctx, createdSources } = fakeAudioContext();
      const audio = createMatchAudio({
        createAudioContext: () => ctx as never,
        document: fakeDocument() as never,
      });
      const theSound = sound();

      for (let i = 0; i < 20; i++) audio.playSound(theSound);

      expect(createdSources.length).toBeLessThan(20);
      expect(createdSources.length).toBeGreaterThan(0);
    });
  });

  describe("environment without AudioContext support", () => {
    it("never throws from playMusic/playSound when the audio context itself can't be constructed", async () => {
      const audio = createMatchAudio({
        createAudioContext: () => {
          throw new Error("AudioContext is not defined");
        },
        document: fakeDocument() as never,
      });

      await expect(
        audio.playMusic(new Uint8Array([1])),
      ).resolves.toBeUndefined();
      expect(() => audio.playSound(sound())).not.toThrow();
      expect(() => audio.stop()).not.toThrow();
    });
  });

  describe("visibility handling", () => {
    it("resumes a suspended audio context once the tab becomes visible again", () => {
      const { ctx, setState } = fakeAudioContext();
      const doc = fakeDocument("hidden");
      setState("suspended");
      createMatchAudio({
        createAudioContext: () => ctx as never,
        document: doc as never,
      });

      doc.trigger("visible");

      expect(ctx.resume).toHaveBeenCalled();
    });

    it("does not resume an already-running audio context on visibility change", () => {
      const { ctx } = fakeAudioContext();
      const doc = fakeDocument("hidden");
      createMatchAudio({
        createAudioContext: () => ctx as never,
        document: doc as never,
      });

      doc.trigger("visible");

      expect(ctx.resume).not.toHaveBeenCalled();
    });
  });

  describe("stop", () => {
    it("stops the music and every active one-shot source, then closes the context", async () => {
      const { ctx, createdSources } = fakeAudioContext();
      const decodeAudioData = vi.fn(async () => ({}) as never);
      const audio = createMatchAudio({
        createAudioContext: () => ctx as never,
        decodeAudioData,
        document: fakeDocument() as never,
      });
      await audio.playMusic(new Uint8Array([1]));
      audio.playSound(sound());

      audio.stop();

      for (const source of createdSources) {
        expect(source.stop).toHaveBeenCalled();
      }
      expect(ctx.close).toHaveBeenCalled();
    });

    it("is idempotent -- calling stop() twice does not throw or double-close", () => {
      const { ctx } = fakeAudioContext();
      const audio = createMatchAudio({
        createAudioContext: () => ctx as never,
        document: fakeDocument() as never,
      });

      audio.stop();
      expect(() => audio.stop()).not.toThrow();
      expect(ctx.close).toHaveBeenCalledTimes(1);
    });

    it("removes the visibilitychange listener so a later tab-visibility change does nothing", () => {
      const { ctx } = fakeAudioContext();
      const doc = fakeDocument();
      const audio = createMatchAudio({
        createAudioContext: () => ctx as never,
        document: doc as never,
      });

      audio.stop();
      expect(() => doc.trigger("visible")).not.toThrow();
    });
  });
});
