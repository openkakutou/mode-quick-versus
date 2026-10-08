---
status: todo
depends_on: [008]
---
# Native game: gamepad input

## Description
Native program only reads the keyboard. Add SDL2 game-controller input, mapped like the keyboard bindings (web build parity, item 006).

## Acceptance Criteria
- [ ] A gamepad can drive selection, setup and match in the native program
- [ ] Mapping unit-tested; hot-plug does not crash (SDL dummy/virtual controller in Docker)
