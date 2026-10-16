package game

import (
	"math"
	"testing"

	"github.com/openkakutou/engine/input"
	"github.com/openkakutou/engine/match"
)

func decide(c *CPU, selfX, oppX float64) input.TickInput {
	var in input.TickInput
	c.Decide(match.Position{X: selfX}, match.Position{X: oppX}, &in)
	return in
}

func TestCPU_WalksTowardFarOpponent(t *testing.T) {
	c := NewCPU(func() float64 { return 0 })
	if in := decide(c, 0, 200); !in.Right || in.Left || in.Buttons["a"] {
		t.Errorf("opponent far right: %+v, want only Right", in)
	}
	if in := decide(c, 200, 0); !in.Left || in.Right || in.Buttons["a"] {
		t.Errorf("opponent far left: %+v, want only Left", in)
	}
}

func TestCPU_AttacksInRangeOnlyWhenRollFavors(t *testing.T) {
	always := NewCPU(func() float64 { return 0 })
	if in := decide(always, 0, 10); !in.Buttons["a"] || in.Left || in.Right {
		t.Errorf("favorable roll: %+v, want only button a", in)
	}
	never := NewCPU(func() float64 { return 0.99 })
	if in := decide(never, 0, 10); in.Buttons["a"] || in.Left || in.Right {
		t.Errorf("unfavorable roll: %+v, want neutral", in)
	}
}

func TestCPU_BoundaryDistances(t *testing.T) {
	c := NewCPU(func() float64 { return 0 })
	if in := decide(c, 0, AttackRange); !in.Buttons["a"] {
		t.Errorf("at exactly attack range: %+v, want attack", in)
	}
	if in := decide(c, 0, ApproachDistance); in.Right || in.Left {
		t.Errorf("at exactly approach distance: %+v, want no walking", in)
	}
	if in := decide(c, 0, (AttackRange+ApproachDistance)/2); in.Right || in.Left || in.Buttons["a"] {
		t.Errorf("between ranges: %+v, want neutral", in)
	}
	never := NewCPU(func() float64 { return 0.99 })
	if in := decide(never, 5, 5); in.Left || in.Right || in.Buttons["a"] {
		t.Errorf("same position: %+v, want neutral", in)
	}
}

func TestCPU_InvalidPositionsDegradeToNeutral(t *testing.T) {
	c := NewCPU(func() float64 { return 0 })
	nan := math.NaN()
	in := input.TickInput{Right: true, Buttons: map[string]bool{"a": true, "b": true}}
	c.Decide(match.Position{X: nan}, match.Position{X: 0}, &in)
	if in.Right || in.Buttons["a"] || in.Buttons["b"] {
		t.Errorf("NaN self: %+v, want everything released", in)
	}
}

func TestCPU_ClearsPreviousDecisionAndKeepsMap(t *testing.T) {
	c := NewCPU(func() float64 { return 0.99 })
	in := input.TickInput{Up: true, Down: true, Buttons: map[string]bool{"x": true}}
	c.Decide(match.Position{X: 0}, match.Position{X: 30}, &in)
	if in.Up || in.Down || in.Buttons["x"] {
		t.Errorf("stale input kept: %+v", in)
	}
}
