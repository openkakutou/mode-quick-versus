package gfx

import (
	"github.com/openkakutou/engine/input"
	"github.com/openkakutou/mode-quick-versus/native/internal/game"
	"github.com/veandco/go-sdl2/sdl"
)

// playerKeys mirrors the web build's default bindings: P1 on WASD + FGH/RTY,
// P2 on the arrows + JKL/IOP.
var playerKeys = [2]struct {
	up, down, left, right sdl.Scancode
	buttons               map[string]sdl.Scancode
}{
	{sdl.SCANCODE_W, sdl.SCANCODE_S, sdl.SCANCODE_A, sdl.SCANCODE_D, map[string]sdl.Scancode{
		"a": sdl.SCANCODE_F, "b": sdl.SCANCODE_G, "c": sdl.SCANCODE_H,
		"x": sdl.SCANCODE_R, "y": sdl.SCANCODE_T, "z": sdl.SCANCODE_Y}},
	{sdl.SCANCODE_UP, sdl.SCANCODE_DOWN, sdl.SCANCODE_LEFT, sdl.SCANCODE_RIGHT, map[string]sdl.Scancode{
		"a": sdl.SCANCODE_J, "b": sdl.SCANCODE_K, "c": sdl.SCANCODE_L,
		"x": sdl.SCANCODE_I, "y": sdl.SCANCODE_O, "z": sdl.SCANCODE_P}},
}

// Held reads both players' held inputs into dst, reusing the button maps
// already in dst so a tick allocates nothing. A player with a controller uses
// it instead of the keyboard.
func Held(dst *[2]input.TickInput, pads *Gamepads) {
	keys := sdl.GetKeyboardState()
	for i := range dst {
		if s, ok := pads.state(i); ok {
			s.Apply(&dst[i])
			continue
		}
		p, in := playerKeys[i], &dst[i]
		in.Up, in.Down = keys[p.up] != 0, keys[p.down] != 0
		in.Left, in.Right = keys[p.left] != 0, keys[p.right] != 0
		if in.Buttons == nil {
			in.Buttons = make(map[string]bool, len(p.buttons))
		}
		for name, sc := range p.buttons {
			in.Buttons[name] = keys[sc] != 0
		}
	}
}

// PollEvents drains SDL events, turning key presses and controller changes
// into menu inputs for f. It reports false when the window was closed.
func PollEvents(f *game.Flow, pads *Gamepads) bool {
	for ev := sdl.PollEvent(); ev != nil; ev = sdl.PollEvent() {
		switch e := ev.(type) {
		case *sdl.QuitEvent:
			return false
		case *sdl.KeyboardEvent:
			if e.Type != sdl.KEYDOWN {
				continue
			}
			if n, ok := navFor(e.Keysym.Scancode); ok {
				f.Navigate(n)
			}
		case *sdl.ControllerDeviceEvent:
			switch e.Type {
			case sdl.CONTROLLERDEVICEADDED:
				pads.add(int(e.Which))
			case sdl.CONTROLLERDEVICEREMOVED:
				pads.remove(e.Which)
			}
		}
	}
	pads.navigate(f)
	return true
}

func navFor(sc sdl.Scancode) (game.Nav, bool) {
	switch sc {
	case sdl.SCANCODE_UP, sdl.SCANCODE_W:
		return game.NavUp, true
	case sdl.SCANCODE_DOWN, sdl.SCANCODE_S:
		return game.NavDown, true
	case sdl.SCANCODE_LEFT, sdl.SCANCODE_A:
		return game.NavLeft, true
	case sdl.SCANCODE_RIGHT, sdl.SCANCODE_D:
		return game.NavRight, true
	case sdl.SCANCODE_RETURN, sdl.SCANCODE_SPACE, sdl.SCANCODE_KP_ENTER:
		return game.NavConfirm, true
	case sdl.SCANCODE_ESCAPE, sdl.SCANCODE_BACKSPACE:
		return game.NavCancel, true
	}
	return 0, false
}

// Ticks returns how many simulation ticks to run for elapsedMs of real time,
// carrying the remainder in *acc (a fixed 60Hz timestep, capped so a stall
// cannot trigger a long catch-up burst).
func Ticks(acc *float64, elapsedMs float64) int {
	const step = 1000.0 / game.TickRateHz
	*acc += elapsedMs
	if *acc > 5*step {
		*acc = 5 * step
	}
	n := 0
	for *acc >= step {
		*acc -= step
		n++
	}
	return n
}
