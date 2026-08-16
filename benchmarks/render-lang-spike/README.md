# render-lang-spike

Raw OpenGL bindings (`go-gl` + SDL2, mirroring [Ikemen GO](https://github.com/ikemen-engine/Ikemen-GO)'s own stack) vs. [Ebiten](https://ebitengine.org/) sprite-draw benchmark. Run per roadmap `.vibe/decisions/022`. See [`RESULTS.md`](RESULTS.md) for findings.

## What this is

Both programs draw `200` textured quads/frame (representative of a busy fighting-game frame: layered fighter sprites, hitbox overlays, HUD icons), same vsync-off setting, same swap-buffer/present step, for a fixed frame count, and report elapsed time / draws-per-second.

- `sdltest/` — `go-gl/gl` (OpenGL 2.1, fixed-function) + `veandco/go-sdl2` for windowing/context.
- `ebitentest/` — the same workload issued via `ebiten.Image.DrawImage`, inside a real `ebiten.RunGame` loop (vsync disabled, TPS uncapped).

## Reproducing

Requires SDL2 + OpenGL dev headers (`libsdl2-dev`, `libgl-dev`, `libglx-dev`, X11 dev libs) and, for headless runs, an X server (real or `Xvfb`).

```sh
cd sdltest && go build -o sdltest . && cd ..
cd ebitentest && go build -o ebitentest . && cd ..

# headless (e.g. CI): start Xvfb first
Xvfb :99 -screen 0 1280x720x24 &
DISPLAY=:99 LIBGL_ALWAYS_SOFTWARE=1 ./sdltest/sdltest 2000
DISPLAY=:99 LIBGL_ALWAYS_SOFTWARE=1 EGL_PLATFORM=x11 ./ebitentest/ebitentest 200
```

Each prints one JSON line with `elapsed_ms`, `total_draws`, `draws_per_sec`, `ms_per_frame`.

## What this does NOT cover

- **Software rendering only** (Mesa llvmpipe) — the environment this spike ran in has no accessible GPU (`/dev/dri` present but not permission-accessible). Absolute numbers don't reflect real hardware; the relative comparison (same Mesa backend under both) is the meaningful signal.
- **Linux/X11 only** — Ebiten's overhead here is partly attributable to its pure-Go X11 client (`XGB`) vs. SDL2's native C X11/GLX bindings, a platform-specific factor. Not re-run on Windows/Mac.
- **Android** — not covered at all; SDL2 supports it but desktop OpenGL vs. GLES is a separate, unresolved gap (see roadmap backlog `010`).
