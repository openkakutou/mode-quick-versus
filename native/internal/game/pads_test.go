package game

import (
	"testing"

	"github.com/openkakutou/engine/input"
)

func navsOf(p *Pads, player int, s PadState) []Nav {
	return p.Navs(player, s, nil)
}

func TestPads_FirstTwoControllersGoToP1ThenP2(t *testing.T) {
	var p Pads
	if slot, ok := p.Connect(7); !ok || slot != 0 {
		t.Errorf("first pad: slot %d ok %v, want 0 true", slot, ok)
	}
	if slot, ok := p.Connect(3); !ok || slot != 1 {
		t.Errorf("second pad: slot %d ok %v, want 1 true", slot, ok)
	}
	if id, ok := p.ID(0); !ok || id != 7 {
		t.Errorf("P1 pad = %d %v, want 7", id, ok)
	}
	if id, ok := p.ID(1); !ok || id != 3 {
		t.Errorf("P2 pad = %d %v, want 3", id, ok)
	}
}

func TestPads_ThirdControllerIsIgnored(t *testing.T) {
	var p Pads
	p.Connect(1)
	p.Connect(2)
	if _, ok := p.Connect(3); ok {
		t.Error("third pad was assigned")
	}
	if id, _ := p.ID(0); id != 1 {
		t.Errorf("P1 pad changed to %d", id)
	}
	if id, _ := p.ID(1); id != 2 {
		t.Errorf("P2 pad changed to %d", id)
	}
}

func TestPads_SamePadNeverGoesToTwoPlayers(t *testing.T) {
	var p Pads
	p.Connect(5)
	slot, ok := p.Connect(5)
	if !ok || slot != 0 {
		t.Errorf("reconnect of the same id: slot %d ok %v, want 0 true", slot, ok)
	}
	if p.Has(1) {
		t.Error("P2 got the pad already used by P1")
	}
}

func TestPads_UnpluggedPadFallsBackToKeyboard(t *testing.T) {
	var p Pads
	p.Connect(1)
	p.Connect(2)
	p.Disconnect(1)
	if p.Has(0) {
		t.Error("P1 still has a pad after it was unplugged")
	}
	if !p.Has(1) {
		t.Error("P2 lost its pad when P1's was unplugged")
	}
}

func TestPads_ReplugTakesTheFreedPlayer(t *testing.T) {
	var p Pads
	p.Connect(1)
	p.Connect(2)
	p.Disconnect(1)
	if slot, ok := p.Connect(9); !ok || slot != 0 {
		t.Errorf("replug: slot %d ok %v, want 0 true", slot, ok)
	}
}

func TestPads_DisconnectOfUnknownPadIsHarmless(t *testing.T) {
	var p Pads
	p.Disconnect(42)
	p.Connect(1)
	p.Disconnect(42)
	if !p.Has(0) {
		t.Error("unknown disconnect removed P1's pad")
	}
}

func TestPads_NoPadsMeansNoPlayerHasOne(t *testing.T) {
	var p Pads
	if p.Has(0) || p.Has(1) {
		t.Error("empty Pads reports a pad")
	}
	if _, ok := p.ID(0); ok {
		t.Error("empty Pads returns an id")
	}
	if p.Has(-1) || p.Has(2) {
		t.Error("out of range player reports a pad")
	}
	if got := p.Navs(2, PadState{}, nil); len(got) != 0 {
		t.Errorf("out of range player navs = %v", got)
	}
}

func TestPadState_DpadAndButtonsDriveTickInput(t *testing.T) {
	var in input.TickInput
	s := PadState{Up: true, Right: true}
	s.Buttons = [PadButtons]bool{true, false, true, false, false, true} // A, X, RB
	s.Apply(&in)
	if !in.Up || !in.Right || in.Down || in.Left {
		t.Errorf("directions = %+v, want Up+Right", in)
	}
	want := map[string]bool{"a": true, "b": false, "c": true, "x": false, "y": false, "z": true}
	for k, v := range want {
		if in.Buttons[k] != v {
			t.Errorf("button %s = %v, want %v", k, in.Buttons[k], v)
		}
	}
}

func TestPadState_ApplyClearsWhatWasReleased(t *testing.T) {
	var in input.TickInput
	PadState{Left: true, Buttons: [PadButtons]bool{true}}.Apply(&in)
	PadState{}.Apply(&in)
	if in.Left || in.Buttons["a"] {
		t.Errorf("released inputs still held: %+v", in)
	}
}

func TestPadState_ApplyReusesTheButtonsMap(t *testing.T) {
	var in input.TickInput
	s := PadState{Buttons: [PadButtons]bool{true}}
	s.Apply(&in)
	if n := testing.AllocsPerRun(100, func() { s.Apply(&in) }); n != 0 {
		t.Errorf("Apply allocates %v times per call", n)
	}
}

func TestPadState_StickBeyondThresholdMovesButDeadZoneDoesNot(t *testing.T) {
	cases := []struct {
		name                  string
		x, y                  int16
		up, down, left, right bool
	}{
		{"centered", 0, 0, false, false, false, false},
		{"small drift", 8000, -8000, false, false, false, false},
		{"just below threshold", StickThreshold - 1, 0, false, false, false, false},
		{"at threshold", StickThreshold, 0, false, false, false, true},
		{"left", -StickThreshold, 0, false, false, true, false},
		{"up is negative y", 0, -32768, true, false, false, false},
		{"down is positive y", 0, 32767, false, true, false, false},
		{"diagonal", -30000, 30000, false, true, true, false},
	}
	for _, c := range cases {
		var in input.TickInput
		PadState{StickX: c.x, StickY: c.y}.Apply(&in)
		if in.Up != c.up || in.Down != c.down || in.Left != c.left || in.Right != c.right {
			t.Errorf("%s: got %+v", c.name, in)
		}
	}
}

func TestPadState_DpadAndStickCombine(t *testing.T) {
	var in input.TickInput
	PadState{Left: true, StickY: 30000}.Apply(&in)
	if !in.Left || !in.Down {
		t.Errorf("got %+v, want Left+Down", in)
	}
}

func TestPads_ButtonAConfirmsAndBCancelsOncePerPress(t *testing.T) {
	var p Pads
	p.Connect(1)
	a := PadState{Buttons: [PadButtons]bool{true}}
	if got := navsOf(&p, 0, a); len(got) != 1 || got[0] != NavConfirm {
		t.Errorf("press A: %v, want [Confirm]", got)
	}
	if got := navsOf(&p, 0, a); len(got) != 0 {
		t.Errorf("holding A repeated: %v", got)
	}
	navsOf(&p, 0, PadState{})
	b := PadState{Buttons: [PadButtons]bool{false, true}}
	if got := navsOf(&p, 0, b); len(got) != 1 || got[0] != NavCancel {
		t.Errorf("press B: %v, want [Cancel]", got)
	}
	if got := navsOf(&p, 0, a); len(got) != 1 || got[0] != NavConfirm {
		t.Errorf("A after B released and re-pressed: %v", got)
	}
}

func TestPads_OtherButtonsDoNotNavigate(t *testing.T) {
	var p Pads
	p.Connect(1)
	s := PadState{Buttons: [PadButtons]bool{false, false, true, true, true, true}}
	if got := navsOf(&p, 0, s); len(got) != 0 {
		t.Errorf("X/Y/shoulders navigated: %v", got)
	}
}

func TestPads_DpadAndStickNavigateOnEdgeOnly(t *testing.T) {
	var p Pads
	p.Connect(1)
	if got := navsOf(&p, 0, PadState{Down: true}); len(got) != 1 || got[0] != NavDown {
		t.Errorf("d-pad down: %v", got)
	}
	if got := navsOf(&p, 0, PadState{Down: true}); len(got) != 0 {
		t.Errorf("held d-pad repeated: %v", got)
	}
	navsOf(&p, 0, PadState{})
	if got := navsOf(&p, 0, PadState{StickX: StickThreshold - 1}); len(got) != 0 {
		t.Errorf("stick below threshold navigated: %v", got)
	}
	if got := navsOf(&p, 0, PadState{StickX: StickThreshold}); len(got) != 1 || got[0] != NavRight {
		t.Errorf("stick crossing threshold: %v", got)
	}
	if got := navsOf(&p, 0, PadState{StickX: 32767}); len(got) != 0 {
		t.Errorf("stick pushed further repeated: %v", got)
	}
	if got := navsOf(&p, 0, PadState{StickX: -32768}); len(got) != 1 || got[0] != NavLeft {
		t.Errorf("stick swung to left: %v", got)
	}
	navsOf(&p, 0, PadState{})
	if got := navsOf(&p, 0, PadState{StickY: -32768}); len(got) != 1 || got[0] != NavUp {
		t.Errorf("stick up: %v", got)
	}
}

func TestPads_EachPlayersPadHasItsOwnEdgeState(t *testing.T) {
	var p Pads
	p.Connect(1)
	p.Connect(2)
	a := PadState{Buttons: [PadButtons]bool{true}}
	navsOf(&p, 0, a)
	if got := navsOf(&p, 1, a); len(got) != 1 || got[0] != NavConfirm {
		t.Errorf("P2 pad press after P1's: %v, want [Confirm]", got)
	}
}

func TestPads_NavsAreSilentWithoutAnAssignedPad(t *testing.T) {
	var p Pads
	if got := navsOf(&p, 0, PadState{Up: true, Buttons: [PadButtons]bool{true}}); len(got) != 0 {
		t.Errorf("unassigned player navigated: %v", got)
	}
}

func TestPads_ReplugForgetsHeldButtonSoItFiresAgain(t *testing.T) {
	var p Pads
	p.Connect(1)
	a := PadState{Buttons: [PadButtons]bool{true}}
	navsOf(&p, 0, a)
	p.Disconnect(1)
	p.Connect(1)
	if got := navsOf(&p, 0, PadState{}); len(got) != 0 {
		t.Errorf("neutral state after replug navigated: %v", got)
	}
	if got := navsOf(&p, 0, a); len(got) != 1 {
		t.Errorf("A after replug: %v, want one Confirm", got)
	}
}

func TestPads_NavsReusesTheCallersSlice(t *testing.T) {
	var p Pads
	p.Connect(1)
	buf := make([]Nav, 0, 8)
	s := PadState{}
	toggle := PadState{Down: true}
	if n := testing.AllocsPerRun(100, func() {
		buf = p.Navs(0, toggle, buf[:0])
		buf = p.Navs(0, s, buf[:0])
	}); n != 0 {
		t.Errorf("Navs allocates %v times", n)
	}
}
