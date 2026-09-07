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

## Placeholder sprite
The fixed visual fallback drawn in place of a fighter's or a stage layer's sprite whenever its reference fails to resolve against the loaded sheet — one shared visual treatment, shown instead of a crash or a blank gap. Distinct from a sprite reference that legitimately draws nothing (a blank `.air` frame, or a stage `"anim"` element with no matching animation block), which is not an error and gets no placeholder at all.
_Sources: `src/rendering/scene-composition.ts`_
