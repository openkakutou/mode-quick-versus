# Ubiquitous Language

## Roster
The set of characters available for players to choose from on the selection screen. A roster entry can fail to load (a corrupt or incomplete character file set); it still appears in the roster, marked as unavailable, rather than being silently dropped.
_Sources: `src/roster/manifest.ts`, `src/roster/discovery.ts`_

## Mirror match
A match where both players have picked the same character. Explicitly supported on the selection screen — a character can be picked by Player 1 and Player 2 at the same time, without error.
_Sources: `src/selection/roster-screen.ts`_

## Stage list
The set of stages available for the two players to choose one shared stage from, once both have picked their characters. A stage entry can fail to load (a corrupt or incomplete `.def` file); it still appears in the list, marked as unavailable, rather than being silently dropped — same handling as the character roster.
_Sources: `src/stage/manifest.ts`, `src/stage/discovery.ts`_

## Round count
The number of rounds the match is played to, chosen by the players from a fixed set of positive odd values (e.g. 1, 3, 5) on the match setup screen. Round count is always odd so a match can never end in a tie at the round level.
_Sources: `src/setup/setup-screen.ts`_

## Time limit
The per-round countdown the players configure on the match setup screen, either a fixed number of seconds or "unlimited" (no timer for that round). Modeled as a distinct value from a plain duration so it can never be silently treated as a real number of seconds downstream.
_Sources: `src/setup/setup-screen.ts`_

## Input source
Which device is currently driving one player's actions during a match: their keyboard, or a gamepad assigned to them. Each player has exactly one active input source at a time — a connected, assigned gamepad takes over from keyboard automatically, and falls back to keyboard the moment it disconnects. Shown live during a match ("Player 1: Keyboard · Player 2: Gamepad") and, as default keyboard bindings, on the match setup screen's Controls section.
_Sources: `src/input/tick-input-source.ts`, `src/setup/setup-screen.ts`_

## Placeholder sprite
The fixed visual fallback drawn in place of a fighter's or a stage layer's sprite whenever its reference fails to resolve against the loaded sheet — one shared visual treatment, shown instead of a crash or a blank gap. Distinct from a sprite reference that legitimately draws nothing (a blank `.air` frame, or a stage `"anim"` element with no matching animation block), which is not an error and gets no placeholder at all.
_Sources: `src/rendering/scene-composition.ts`_

## In-match HUD
The heads-up display shown throughout a match: each player's lifebar and power/meter bar, plus the round display (current round number, each player's round wins, and the configured best-of). Driven live by `engine`'s per-tick match state; if that state is ever malformed or unexpected, the HUD shows one clear error message instead of a broken bar or a frozen/crashed match.
_Sources: `src/hud/hud-view-model.ts`, `src/hud/hud-renderer.ts`_

## Round result
Who won the round that just ended — one player, or a draw (a double KO, or a timeout with both fighters at exactly equal health). Shown automatically for a few seconds before the next round starts; not a decision, so no player action is needed to continue.
**Do not confuse with:** Match result — a round result never offers Rematch/Back to select, and a drawn round doesn't end the match on its own.
_Sources: `src/result/outcome.ts`, `src/result/result-screen.ts`_

## Match result
Who won the match overall — one player, or (only in an unexpected/ambiguous underlying state) a draw, since a real match's round count is always odd and can never draw on its own. Offers exactly two choices: Rematch (instantly replays the match with the same characters, stage, and settings) or Back to select (returns to character selection).
_Sources: `src/result/outcome.ts`, `src/result/result-screen.ts`, `src/rendering/match-renderer.ts`_

## CPU opponent
A computer-controlled stand-in for player 2, chosen on the match setup screen's Player 2 Control option (Human or CPU, defaulting to Human) — a minimal first pass, not a full AI: it moves toward its opponent and occasionally attacks, driven through the exact same input path a real player's keyboard or gamepad would use.
_Sources: `src/setup/setup-screen.ts`, `src/cpu/cpu-controller.ts`, `src/cpu/cpu-input-source.ts`_

## Power / meter
A fighter's super gauge value, gained and spent during a match, shown as its own bar in the in-match HUD alongside the lifebar. Reported live by `engine` as a raw number; this app renders it as a percentage of a fixed placeholder cap, since `engine` does not itself publish that cap as part of its match-state contract.
_Sources: `src/hud/hud-view-model.ts`, `src/rendering/match-config.ts`_
