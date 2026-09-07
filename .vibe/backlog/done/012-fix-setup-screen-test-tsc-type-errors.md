---
status: done
depends_on: []
---
# Fix setup-screen.test.ts tsc type errors

## Description
`npm run build` (`tsc && vite build`) fails at the `tsc` step: every `onContinue: vi.fn()` callback passed to `renderSetupScreen` in `src/setup/setup-screen.test.ts` fails to type-check against `SetupScreenOptions["onContinue"]` (`(config: MatchSetupConfig) => void`), because `vi.fn()` called with no type argument infers `Mock<Procedure | Constructable>`, which TypeScript won't structurally match against that specific function signature. `npm test` (Vitest, which transpiles without type-checking) and `npm run lint` (Biome) are both unaffected and pass — only the `tsc` pass of the build script fails. Confirmed pre-existing (present before backlog item 005's changes, via `git stash`), not introduced by this item.

## Acceptance Criteria
- [x] `npm run build` completes without a `tsc` error
- [x] Every affected `vi.fn()` call in `src/setup/setup-screen.test.ts` gets an explicit type argument (e.g. `vi.fn<(config: MatchSetupConfig) => void>()`) or an equivalently-typed helper, rather than a broad cast
- [x] `npm test` and `npm run lint` stay green

## Notes
Found while working backlog item 005 ("Match Rendering"); out of that item's own scope (a pre-existing, unrelated test-typing gap in a different screen's test file).
