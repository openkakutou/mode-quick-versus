---
status: todo
depends_on: [008]
---
# Native game: CPU opponent

## Description
The web build has a basic CPU opponent (item 007); the native Linux/Windows/macOS program does not. Port the same behavior, driven by `engine`, in the native program.

## Acceptance Criteria
- [ ] A native match can be played against the CPU opponent, with behavior equivalent to the web build
- [ ] Unit-tested; run under the Docker/Xvfb toolchain in `native/`
