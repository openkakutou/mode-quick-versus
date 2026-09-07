---
status: done
depends_on: [005]
---
# Input Handling

## Description
Read keyboard input for both local players (and gamepad input where available) and route it into `engine`'s command/input system each simulation tick, so player actions actually drive the match `engine` is simulating and rendering (item 005) reflects.

## Acceptance Criteria
- [x] Keyboard input for both players (distinct key sets per player) is read and routed into `engine` each tick
- [x] Gamepad input is detected and routed into `engine` when a gamepad is connected, without requiring one to be present
- [x] Rebinding or default key/button mapping is discoverable by the player (e.g. shown on a setup or pause screen)
- [x] Losing/disconnecting a gamepad mid-match degrades that player's input gracefully (e.g. falls back to keyboard or pauses) instead of crashing or freezing the match
- [x] Input latency does not visibly desync from rendered/simulated state under normal conditions

## Notes
Cross-repo blocker: needs `engine` item 008 (input reading and command matching) to exist so routed input actually resolves to character commands/moves.

## Resolution
2026-09-07: `engine`'s own `input` package (command parsing/matching against per-tick `TickInput`) already exists and is exposed through the `engine` WASM bridge's `tick()` call — the cross-repo blocker noted above had already been resolved by the time this item was implemented. Delivered: `src/input/` (default keyboard/gamepad bindings, live trackers, one active source per player per tick — gamepad if connected, else keyboard, never merged), each character's `.cmd` file is now fetched and parsed (`wasm/bridge.ts`'s new `loadCmd`) and threaded into the `engine` match request instead of an empty command file, a read-only Controls section on the match setup screen, and a live in-match status line naming each player's current input source. Rebinding UI itself is out of scope — only the current default mapping is shown, which satisfies the acceptance criterion as written ("Rebinding **or** default key/button mapping is discoverable").
