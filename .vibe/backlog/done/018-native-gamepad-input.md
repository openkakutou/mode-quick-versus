---
status: done
depends_on: [008]
---
# Native game: gamepad input

## Description
Native program only reads the keyboard. Add SDL2 game-controller input, mapped like the keyboard bindings (web build parity, item 006).

## Acceptance Criteria
- [x] A gamepad can drive selection, setup and match in the native program
- [x] Mapping unit-tested; hot-plug does not crash (assignment/unplug logic unit-tested; no SDL virtual controller in Docker: go-sdl2 has no JoystickAttachVirtual binding, zero-pad startup covered by the smoke test)
