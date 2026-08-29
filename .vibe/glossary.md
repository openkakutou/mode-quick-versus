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
