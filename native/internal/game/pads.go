package game

import "github.com/openkakutou/engine/input"

// PadButtons is how many face/shoulder buttons are read, in the web build's
// standard order: A, B, X, Y, left shoulder, right shoulder.
const PadButtons = 6

// StickThreshold is the left-stick deflection (of 32767) from which an axis
// counts as a direction; below it is the dead zone.
const StickThreshold = 16384

var padButtonNames = [PadButtons]string{"a", "b", "c", "x", "y", "z"}

// PadState is one controller's raw state for a frame, decoded from SDL by the
// gfx package. StickY follows SDL: negative is up.
type PadState struct {
	Up, Down, Left, Right bool
	StickX, StickY        int16
	Buttons               [PadButtons]bool
}

func (s PadState) dirs() (up, down, left, right bool) {
	return s.Up || s.StickY <= -StickThreshold,
		s.Down || s.StickY >= StickThreshold,
		s.Left || s.StickX <= -StickThreshold,
		s.Right || s.StickX >= StickThreshold
}

// Apply writes the state into in, reusing in.Buttons.
func (s PadState) Apply(in *input.TickInput) {
	in.Up, in.Down, in.Left, in.Right = s.dirs()
	if in.Buttons == nil {
		in.Buttons = make(map[string]bool, PadButtons)
	}
	for i, name := range padButtonNames {
		in.Buttons[name] = s.Buttons[i]
	}
}

// Pads assigns connected controllers to players by connection order (first
// free player) and detects menu presses. A player with a pad uses it instead
// of the keyboard.
type Pads struct {
	ids  [2]int32
	used [2]bool
	prev [2]padEdges
}

// padEdges is what was pressed on the previous frame: up, down, left, right, confirm, cancel.
type padEdges [6]bool

// Connect assigns a newly seen controller to the first player without one and
// returns that player. A controller that is already assigned keeps its player;
// a third one is ignored (shortcut: it is not queued for when a pad leaves,
// replug it then).
func (p *Pads) Connect(id int32) (player int, ok bool) {
	for i := range p.ids {
		if p.used[i] && p.ids[i] == id {
			return i, true
		}
	}
	for i := range p.ids {
		if !p.used[i] {
			p.ids[i], p.used[i], p.prev[i] = id, true, padEdges{}
			return i, true
		}
	}
	return 0, false
}

// Disconnect frees the player holding the controller; unknown ids are ignored.
func (p *Pads) Disconnect(id int32) {
	for i := range p.ids {
		if p.used[i] && p.ids[i] == id {
			p.used[i], p.prev[i] = false, padEdges{}
		}
	}
}

// Has reports whether the player has a controller (and so no keyboard).
func (p *Pads) Has(player int) bool {
	return player >= 0 && player < len(p.used) && p.used[player]
}

// ID returns the controller id assigned to the player.
func (p *Pads) ID(player int) (int32, bool) {
	if !p.Has(player) {
		return 0, false
	}
	return p.ids[player], true
}

// Navs appends to dst the menu inputs newly pressed on the player's pad since
// the previous call: directions from d-pad or stick, A confirm, B cancel.
func (p *Pads) Navs(player int, s PadState, dst []Nav) []Nav {
	if !p.Has(player) {
		return dst
	}
	var cur padEdges
	cur[0], cur[1], cur[2], cur[3] = s.dirs()
	cur[4], cur[5] = s.Buttons[0], s.Buttons[1]
	navs := [6]Nav{NavUp, NavDown, NavLeft, NavRight, NavConfirm, NavCancel}
	for i, n := range navs {
		if cur[i] && !p.prev[player][i] {
			dst = append(dst, n)
		}
	}
	p.prev[player] = cur
	return dst
}
