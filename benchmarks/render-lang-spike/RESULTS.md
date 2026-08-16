# Results — 2026-08-16

Headless Xvfb (`:99`, 1280×720×24) + Mesa llvmpipe (software, `LIBGL_ALWAYS_SOFTWARE=1` — no GPU access in this environment). Go 1.26.1, `go-gl/gl` v2.1, `veandco/go-sdl2` v0.4.40, `hajimehoshi/ebiten/v2` v2.9.10. 3 runs each, 200 sprites/frame, both with vsync disabled and an explicit swap/present call every frame.

| | go-gl + SDL2 | Ebiten |
|---|---|---|
| ms/frame (avg of 3) | 1.51 ms | 11.76 ms |
| draws/sec (avg of 3) | ~132,700 | ~17,000 |
| Ratio | **~7.8× faster** | baseline |

Raw per-run numbers:

```
go-gl+sdl2: 1.5044ms, 1.5643ms, 1.4601ms  (132947, 127851, 136981 draws/sec)
ebiten:     12.0356ms, 11.5212ms, 11.7194ms (16617, 17359, 17066 draws/sec)
```

## What this supports

- **Raw bindings clearly outperform Ebiten on this workload.** Consistent across repeated runs, with a methodologically fair comparison (both disable vsync, both go through an actual buffer-swap/present call — an earlier draft of this spike measured `go-gl` without presenting, which understated Ebiten's relative cost; fixed before recording these numbers).
- **Validates the Ikemen GO precedent directly**: raw `go-gl`+SDL2, the exact stack Ikemen GO itself uses, is the faster and more controllable choice for a real-time 2D fighting game's rendering, over a general-purpose game framework.

## What this does NOT support

- **Absolute performance on real hardware.** This ran entirely in software rendering (Mesa llvmpipe) — no GPU was accessible in the spike's environment. Both frameworks would run substantially faster with hardware acceleration; whether the *relative* 7.8× gap holds, shrinks, or grows under real GPU rendering is not established here.
- **The same gap on Windows/Mac.** Ebiten's Linux backend uses a pure-Go X11 client (`XGB`); its Windows/Mac backends use different underlying APIs with different overhead characteristics. This spike is Linux/X11-specific.
- **Anything about Android.** SDL2 supports it (unlike GLFW), but this spike didn't test it, and desktop OpenGL vs. Android's OpenGL ES remains a real, separate gap — Ikemen GO itself only closes it via a translation layer (gl4es) that isn't fully mainlined even there. Tracked as roadmap backlog `010`.

## Recommendation

Supports adopting `go-gl`+SDL2 for `mode-quick-versus`'s rendering (roadmap `.vibe/decisions/022`), consistent with both the Product Owner's stated priority (control over optimizations, no game-engine dependency) and the Ikemen GO precedent. Android's desktop-GL-vs-GLES gap is not resolved by this spike and needs its own investigation before that target is confirmed.
