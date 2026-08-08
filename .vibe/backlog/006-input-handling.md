---
status: todo
depends_on: [005]
---
# Input Handling

## Description
Read keyboard input for both local players (and gamepad input where available) and route it into `engine`'s command/input system each simulation tick, so player actions actually drive the match `engine` is simulating and rendering (item 005) reflects.

## Acceptance Criteria
- [ ] Keyboard input for both players (distinct key sets per player) is read and routed into `engine` each tick
- [ ] Gamepad input is detected and routed into `engine` when a gamepad is connected, without requiring one to be present
- [ ] Rebinding or default key/button mapping is discoverable by the player (e.g. shown on a setup or pause screen)
- [ ] Losing/disconnecting a gamepad mid-match degrades that player's input gracefully (e.g. falls back to keyboard or pauses) instead of crashing or freezing the match
- [ ] Input latency does not visibly desync from rendered/simulated state under normal conditions

## Notes
Cross-repo blocker: needs `engine` item 008 (input reading and command matching) to exist so routed input actually resolves to character commands/moves.
