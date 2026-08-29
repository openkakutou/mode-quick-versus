# Module: setup
**Role:** Renders the match setup screen once a stage is chosen: two independent `role="radiogroup"` sections — round count and time limit — each with its own heading, gating Continue on both having a selection. "Unlimited" is a first-class tagged time-limit value, never a numeric sentinel. A misconfigured option set (an even/non-positive round count, a non-positive time limit) renders a blocking, named error state instead of a default selection.
**Files:** `src/setup/setup-screen.ts`
**Exports:** `renderSetupScreen(root, options): void`, `SetupScreenOptions`, `MatchSetupConfig`, `TimeLimitOption`, `isValidRoundCount(value): boolean`, `isValidTimeLimitOption(value): boolean`
**Depends on:** none (pure rendering module, no upstream OpenKakutou dependency)
