package game

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/openkakutou/character"
	"github.com/openkakutou/character/cmd"
	"github.com/openkakutou/character/cns"
	"github.com/openkakutou/engine"
	"github.com/openkakutou/engine/input"
	"github.com/openkakutou/engine/match"
	"github.com/openkakutou/engine/round"
	"github.com/openkakutou/stage"
)

// Constants mirror the web build's match-config.ts placeholders so both
// targets simulate identically.
const (
	TickRateHz         = 60
	DefaultHealth      = 1000
	MaxPower           = 3000
	DefaultGravity     = 0.5
	DefaultComboWindow = 20
	FallbackHalfWidth  = 200
	StartingOffset     = 70
	UnlimitedTimer     = 999_999
)

// Fighter is a loaded character plus the on-disk data the renderer needs.
type Fighter struct {
	Char    *character.Character
	Cmd     cmd.CommandFile
	SffPath string
}

// LoadFighter loads a character from its .def, including its parsed .cmd
// (a missing or broken .cmd falls back to an empty command file so the match
// still starts, as on web).
func LoadFighter(defPath string) (*Fighter, error) {
	c, err := character.Load(defPath)
	if err != nil {
		return nil, err
	}
	dir := filepath.Dir(defPath)
	commands := cmd.CommandFile{Remap: map[string]string{}}
	if c.CommandFile != "" {
		if raw, err := os.ReadFile(filepath.Join(dir, c.CommandFile)); err == nil {
			if parsed, err := character.ParseCmd(raw); err == nil {
				commands = parsed
			}
		}
	}
	return &Fighter{Char: c, Cmd: commands, SffPath: filepath.Join(dir, c.SpriteFile)}, nil
}

// LoadStage parses a stage .def.
func LoadStage(defPath string) (*stage.Stage, error) {
	f, err := os.Open(defPath)
	if err != nil {
		return nil, fmt.Errorf("opening stage: %w", err)
	}
	defer f.Close()
	s, err := stage.Parse(f)
	if err != nil {
		return nil, fmt.Errorf("parsing stage %q: %w", defPath, err)
	}
	return &s, nil
}

// Setup is the match setup screen's result. TimeLimitSeconds 0 means no limit.
type Setup struct {
	Rounds           int
	TimeLimitSeconds int
}

// Validate rejects a setup the engine cannot play (rounds must be odd, >0).
func (s Setup) Validate() error {
	if s.Rounds < 1 || s.Rounds%2 == 0 {
		return fmt.Errorf("rounds must be a positive odd number, got %d", s.Rounds)
	}
	if s.TimeLimitSeconds < 0 {
		return fmt.Errorf("time limit must not be negative, got %d", s.TimeLimitSeconds)
	}
	return nil
}

// RoundTimerTicks converts the setup's time limit to simulation ticks.
func (s Setup) RoundTimerTicks() int {
	if s.TimeLimitSeconds == 0 {
		return UnlimitedTimer
	}
	return s.TimeLimitSeconds * TickRateHz
}

// ResolveBounds returns the stage's own boundaries when valid, else a
// symmetric fallback derived from its coordinate width.
func ResolveBounds(s *stage.Stage) stage.StageBoundaries {
	own := s.StageBoundaries
	if own.Left < own.Right {
		return own
	}
	half := FallbackHalfWidth
	if s.BGdef.LocalCoordWidth > 0 {
		half = s.BGdef.LocalCoordWidth / 2
	}
	own.Left, own.Right = -half, half
	return own
}

// StartingFighters places both fighters symmetrically facing each other,
// clamping the standard offset to narrow stages.
func StartingFighters(b stage.StageBoundaries) [2]match.FighterState {
	offset := float64(StartingOffset)
	if maxOff := float64(b.Right-b.Left) / 2; maxOff < offset {
		offset = maxOff
	}
	return [2]match.FighterState{
		match.SideP1: {Side: match.SideP1, Position: match.Position{X: -offset}, Facing: match.FacingRight, Health: DefaultHealth},
		match.SideP2: {Side: match.SideP2, Position: match.Position{X: offset}, Facing: match.FacingLeft, Health: DefaultHealth},
	}
}

// Match is one in-progress best-of-N match.
type Match struct {
	Setup    Setup
	Bounds   stage.StageBoundaries
	State    match.MatchState
	Progress round.Progress
	// AnimNo/AnimTime are each fighter's current animation, indexed by side.
	AnimNo   [2]int
	AnimTime [2]int
	// LastRound is the outcome of the round that just ended (OutcomeNone while fighting).
	LastRound round.RoundResult
	// Over/Winner report that the match is decided.
	Over   bool
	Winner match.Side

	starting [2]match.FighterState
	programs [2]engine.FighterProgram
	runtimes [2]engine.FighterRuntime
	tick     int
}

// NewMatch assembles round 1 of a match.
func NewMatch(p1, p2 *Fighter, st *stage.Stage, setup Setup) (*Match, error) {
	if p1 == nil || p2 == nil || st == nil {
		return nil, fmt.Errorf("a match needs two fighters and a stage")
	}
	if err := setup.Validate(); err != nil {
		return nil, err
	}
	progress, err := round.NewProgress(setup.Rounds)
	if err != nil {
		return nil, err
	}
	bounds := ResolveBounds(st)
	m := &Match{Setup: setup, Bounds: bounds, Progress: progress, starting: StartingFighters(bounds)}
	for i, f := range []*Fighter{p1, p2} {
		states := map[int]cns.StateDef{}
		for _, sd := range f.Char.StateDefs {
			states[sd.Number] = sd
		}
		m.programs[i] = engine.NewFighterProgram(states, f.Char.Animations, f.Cmd)
	}
	if err := m.reset(1); err != nil {
		return nil, err
	}
	return m, nil
}

func (m *Match) reset(roundNo int) error {
	state, err := round.ResetRound(roundNo, m.Setup.RoundTimerTicks(), m.starting[match.SideP1], m.starting[match.SideP2])
	if err != nil {
		return err
	}
	for i := range m.runtimes {
		rt, err := engine.NewFighterRuntime(m.starting[i], m.programs[i].States)
		if err != nil {
			return fmt.Errorf("side %d: %w", i, err)
		}
		m.runtimes[i] = rt
	}
	m.State = *state
	m.tick = 0
	m.LastRound = round.RoundResult{}
	m.syncAnim()
	return nil
}

func (m *Match) syncAnim() {
	for i := range m.runtimes {
		m.AnimNo[i] = m.runtimes[i].Context.Anim
		m.AnimTime[i] = m.runtimes[i].Context.AnimTime
	}
}

// Step advances the simulation by one tick. After a round-ending tick,
// LastRound is set and the caller decides when to call NextRound.
func (m *Match) Step(in [2]input.TickInput) error {
	if m.Over {
		return fmt.Errorf("match is already over")
	}
	m.tick++
	cfg := engine.TickConfig{Bounds: &m.Bounds, Gravity: DefaultGravity, Tick: m.tick, ComboWindow: DefaultComboWindow}
	res, err := engine.Tick(m.State, m.programs, m.runtimes, in, cfg)
	if err != nil {
		return err
	}
	m.State, m.runtimes = res.State, res.Fighters
	m.syncAnim()
	if res.Round.Outcome != round.OutcomeNone {
		m.LastRound = res.Round
		m.Progress = m.Progress.RecordRoundResult(res.Round)
		m.Over, m.Winner = m.Progress.MatchOutcome()
	}
	return nil
}

// RoundEnded reports that the current round has an outcome.
func (m *Match) RoundEnded() bool { return m.LastRound.Outcome != round.OutcomeNone }

// NextRound resets both fighters for the following round.
func (m *Match) NextRound() error {
	if m.Over {
		return fmt.Errorf("match is already over")
	}
	return m.reset(m.State.Round + 1)
}
