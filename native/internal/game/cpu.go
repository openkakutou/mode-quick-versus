package game

import (
	"math"
	"math/rand"

	"github.com/openkakutou/engine/input"
	"github.com/openkakutou/engine/match"
)

// CPU opponent tuning, mirroring the web build's src/cpu/cpu-controller.ts.
const (
	// ApproachDistance: beyond this stage-unit distance the CPU walks toward its opponent.
	ApproachDistance = 60
	// AttackRange: within this distance the CPU may attack instead of walking.
	AttackRange = 50
	// AttackChance is the per-tick chance of pressing attack while in range.
	AttackChance = 0.1
)

// CPU is the minimal, stateless first-pass opponent for player 2: walk toward
// the opponent when far, occasionally press attack when close.
type CPU struct {
	random func() float64
}

// NewCPU builds a CPU controller; a nil random uses math/rand.
func NewCPU(random func() float64) *CPU {
	if random == nil {
		random = rand.Float64
	}
	return &CPU{random: random}
}

// Decide writes this tick's input into dst in place (reusing its button map,
// so a tick allocates nothing). Non-finite positions yield a neutral input.
func (c *CPU) Decide(self, opponent match.Position, dst *input.TickInput) {
	dst.Up, dst.Down, dst.Left, dst.Right = false, false, false, false
	if dst.Buttons == nil {
		dst.Buttons = make(map[string]bool, 6)
	}
	for name := range dst.Buttons {
		dst.Buttons[name] = false
	}
	if math.IsNaN(self.X) || math.IsInf(self.X, 0) || math.IsNaN(opponent.X) || math.IsInf(opponent.X, 0) {
		return
	}
	dx := opponent.X - self.X
	distance := math.Abs(dx)
	if distance > ApproachDistance {
		if dx > 0 {
			dst.Right = true
		} else {
			dst.Left = true
		}
		return
	}
	if distance <= AttackRange && c.random() < AttackChance {
		dst.Buttons["a"] = true
	}
}
