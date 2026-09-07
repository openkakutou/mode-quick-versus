---
date: 2026-09-07
status: accepted
---
# Input routing: one active source per player, frame-sampled, real command files

**Context:** Backlog item 006 wires live keyboard/gamepad input into `engine`'s per-tick `TickInput`, replacing the hardcoded `[{}, {}]` `match-renderer.ts` sends today, and closes the `emptyCommandFile()` placeholder `match-config.ts` has carried since match rendering (item 005) shipped — without a real `.cmd` command file per fighter, routed input can never resolve to a recognized command no matter how it's read.

**Decision:**
1. Each roster entry now also lists a `.cmd` file path; `startMatch` fetches and parses it via the `character` WASM bridge's existing `loadCmd`, and `buildFighterProgram` uses the parsed result instead of an empty command file (falling back to empty, not failing the match, if that one file can't be fetched/parsed).
2. Default bindings use the MUGEN/Ikemen-GO six-button convention (`a b c x y z`) as both the keyboard button set and the gamepad button order, since `.cmd` command strings in this ecosystem are authored against that convention and no per-character button metadata exists to read instead.
3. Each player has exactly one active input source per tick: their assigned gamepad if still connected, otherwise their keyboard bindings — never merged. A lost/disconnected gamepad falls the owning player back to keyboard on the very next read, with no latched button state surviving the switch.
4. Gamepad state is polled once per rendered frame (not once per simulation tick); the same `[TickInput, TickInput]` snapshot is reused for every tick in that frame's fixed-timestep catch-up burst (up to 5, see `.vibe/decisions/004`). Both `TickInput` objects are allocated once per match and mutated in place on every read, keeping the 60Hz tick hot path allocation-free on the input side.

**Reason:** Matches this project's existing frame-budget/no-per-frame-allocation discipline (`CLAUDE.md`), avoids inventing a per-character button-name mapping that doesn't exist anywhere in the data model yet, and gives players an unambiguous, visibly-indicated input source instead of two silently-blended ones.

**Rejected alternatives:** Merging keyboard and gamepad input per player (rejected: ambiguous ownership, and a still-connected keyboard would silently fight a connected gamepad); polling gamepads once per tick (rejected: wasted work — browsers refresh `Gamepad` snapshots per animation frame, not per call — and it reintroduces the exact allocation churn the frame-budget rule exists to prevent); leaving the command file empty and only wiring raw directions (rejected: acceptance criteria require input to actually drive the match, which state-machine `Command` triggers can never recognize without a real, parsed `.cmd` file).
