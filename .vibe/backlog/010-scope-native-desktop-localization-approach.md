---
status: todo
---
# Scope Native (Go/SDL2) Desktop Localization Approach

## Description
The native desktop build (Go/go-gl/SDL2, for Windows/Mac/Linux/Android) is a distinct rendering stack with no DOM and no JSON-catalog loading of the kind chosen for the web UI in roadmap decision `023-localization-approach-for-web-ui.md`, so that decision explicitly excludes it. This item is a scoping/investigation task, not implementation: decide how the native build sources translated strings (e.g. a Go message-catalog library vs. hand-rolled maps), how it detects the OS/user language, and how SDL2 text rendering handles non-Latin scripts if any target locale needs them. Produces a decision (recorded as a backlog note here or promoted to this repo's own `.vibe/decisions/` if it's substantial enough) that a later implementation item can follow.

## Acceptance Criteria
- [ ] A chosen approach for sourcing translated strings in the Go/SDL2 build is documented (library choice or hand-rolled, with reasoning)
- [ ] A chosen approach for detecting the OS/user's language at startup is documented
- [ ] Any SDL2 text-rendering constraints for the initially targeted locales (English, French) are identified and, if none block French, explicitly noted as such
- [ ] The decision is recorded so a follow-up implementation backlog item can be created without re-investigating

## Notes
None.
