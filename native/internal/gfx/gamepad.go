package gfx

import (
	"github.com/openkakutou/mode-quick-versus/native/internal/game"
	"github.com/veandco/go-sdl2/sdl"
)

// Gamepads opens SDL game controllers as they are plugged in and reads their
// state; who drives which player is decided by game.Pads.
type Gamepads struct {
	pads  game.Pads
	open  [2]*sdl.GameController
	navs  []game.Nav
	ready bool
}

// NewGamepads starts SDL's controller subsystem. If that fails the result still
// works and simply never has a controller, so the keyboard stays in charge.
func NewGamepads() *Gamepads {
	g := &Gamepads{navs: make([]game.Nav, 0, 8)}
	g.ready = sdl.InitSubSystem(sdl.INIT_GAMECONTROLLER) == nil
	return g
}

// Close releases the open controllers.
func (g *Gamepads) Close() {
	if g == nil {
		return
	}
	for i, c := range g.open {
		if c != nil {
			c.Close()
			g.open[i] = nil
		}
	}
}

func (g *Gamepads) add(deviceIndex int) {
	if g == nil || !g.ready {
		return
	}
	c := sdl.GameControllerOpen(deviceIndex)
	if c == nil {
		return
	}
	id := int32(c.Joystick().InstanceID())
	player, ok := g.pads.Connect(id)
	if !ok || g.open[player] != nil {
		c.Close() // third pad, or this one is already open
		return
	}
	g.open[player] = c
}

func (g *Gamepads) remove(instance sdl.JoystickID) {
	if g == nil {
		return
	}
	for i, c := range g.open {
		if c != nil && int32(c.Joystick().InstanceID()) == int32(instance) {
			g.pads.Disconnect(int32(instance))
			c.Close()
			g.open[i] = nil
		}
	}
}

// state reads the player's controller; false means use the keyboard.
func (g *Gamepads) state(player int) (game.PadState, bool) {
	var s game.PadState
	if g == nil || !g.pads.Has(player) || g.open[player] == nil {
		return s, false
	}
	c := g.open[player]
	pressed := func(b sdl.GameControllerButton) bool { return c.Button(b) != 0 }
	s.Up, s.Down = pressed(sdl.CONTROLLER_BUTTON_DPAD_UP), pressed(sdl.CONTROLLER_BUTTON_DPAD_DOWN)
	s.Left, s.Right = pressed(sdl.CONTROLLER_BUTTON_DPAD_LEFT), pressed(sdl.CONTROLLER_BUTTON_DPAD_RIGHT)
	s.StickX, s.StickY = c.Axis(sdl.CONTROLLER_AXIS_LEFTX), c.Axis(sdl.CONTROLLER_AXIS_LEFTY)
	s.Buttons = [game.PadButtons]bool{
		pressed(sdl.CONTROLLER_BUTTON_A), pressed(sdl.CONTROLLER_BUTTON_B),
		pressed(sdl.CONTROLLER_BUTTON_X), pressed(sdl.CONTROLLER_BUTTON_Y),
		pressed(sdl.CONTROLLER_BUTTON_LEFTSHOULDER), pressed(sdl.CONTROLLER_BUTTON_RIGHTSHOULDER),
	}
	return s, true
}

// navigate feeds newly pressed controller buttons to the menus.
func (g *Gamepads) navigate(f *game.Flow) {
	for p := 0; p < 2; p++ {
		s, ok := g.state(p)
		if !ok {
			continue
		}
		g.navs = g.pads.Navs(p, s, g.navs[:0])
		for _, n := range g.navs {
			f.Navigate(n)
		}
	}
}
