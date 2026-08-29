# Module: selection
**Role:** One rendering module per screen. `roster-screen.ts` renders the character roster grid and lets each of the two local players independently pick a character — including a mirror match — gating a Continue action on both picks. `stage-screen.ts` renders the stage list as a single-choice `role="radiogroup"` grid (both players share one stage), gating Continue on exactly one stage being selected; picking a new stage deselects the previous one, and re-selecting the already-selected stage is a no-op rather than deselecting it.
**Files:** `src/selection/roster-screen.ts`, `src/selection/stage-screen.ts`
**Exports:** `renderRosterScreen(root, entries, options): void`, `RosterScreenOptions`, `renderStageScreen(root, entries, options): void`, `StageScreenOptions`
**Depends on:** `modules/roster.md` (consumes `DiscoveredCharacter`), `modules/stage.md` (consumes `DiscoveredStage`)
