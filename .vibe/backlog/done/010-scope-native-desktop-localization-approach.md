---
status: done
---
# Scope Native (Go/SDL2) Desktop Localization Approach

## Description
The native desktop build (Go/go-gl/SDL2, for Windows/Mac/Linux/Android) is a distinct rendering stack with no DOM and no JSON-catalog loading of the kind chosen for the web UI in roadmap decision `023-localization-approach-for-web-ui.md`, so that decision explicitly excludes it. This item is a scoping/investigation task, not implementation: decide how the native build sources translated strings (e.g. a Go message-catalog library vs. hand-rolled maps), how it detects the OS/user language, and how SDL2 text rendering handles non-Latin scripts if any target locale needs them. Produces a decision (recorded as a backlog note here or promoted to this repo's own `.vibe/decisions/` if it's substantial enough) that a later implementation item can follow.

## Acceptance Criteria
- [x] A chosen approach for sourcing translated strings in the Go/SDL2 build is documented (library choice or hand-rolled, with reasoning)
- [x] A chosen approach for detecting the OS/user's language at startup is documented
- [x] Any SDL2 text-rendering constraints for the initially targeted locales (English, French) are identified and, if none block French, explicitly noted as such
- [x] The decision is recorded so a follow-up implementation backlog item can be created without re-investigating

## Notes
None.

## Resolution
2026-09-13: Decision recorded as `.vibe/decisions/007-native-desktop-localization-approach.md` (promoted from a backlog note, given its substance): `go-i18n` v2 with per-locale JSON catalogs embedded via `go:embed` for string sourcing; `github.com/jeandeaual/go-locale` + `golang.org/x/text/language` for OS/user language detection at startup; SDL2_ttf with a coverage-verified embedded Unicode font and a content-keyed glyph-texture cache for text rendering — no SDL2 constraint blocks French, only a font-coverage verification step. Scope explicitly excludes designing an in-app language-switcher UI and Android detection (no Android build exists yet, blocked on roadmap backlog `010`), left for the follow-up implementation item. No source code was written — this item's deliverable is the decision itself.
