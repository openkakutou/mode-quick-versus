package game

import (
	"fmt"

	"github.com/openkakutou/engine/input"
	"github.com/openkakutou/engine/match"
	"github.com/openkakutou/stage"
)

// Screen identifies which screen the game is showing.
type Screen int

// The game's screens, in flow order. ScreenError is shown when content cannot be loaded.
const (
	ScreenSelect Screen = iota // each player picks a character
	ScreenStage                // pick a stage
	ScreenSetup                // rounds and time limit
	ScreenMatch
	ScreenResult
	ScreenError
)

// Nav is a menu input, already decoded from keyboard or gamepad.
type Nav int

// Menu inputs.
const (
	NavUp Nav = iota
	NavDown
	NavLeft
	NavRight
	NavConfirm
	NavCancel
)

// Options offered on the setup screen.
var (
	RoundOptions = []int{1, 3, 5}
	TimeOptions  = []int{0, 30, 60, 99} // seconds; 0 = no limit
)

// RoundEndTicks is how long a finished round stays on screen before the next
// round starts (or the result screen appears): 2 seconds.
const RoundEndTicks = 2 * TickRateHz

// Rows of the setup screen.
const (
	SetupRowRounds = iota
	SetupRowTime
	SetupRowPlayer2
	SetupRowStart
	setupRowCount
)

// Loader loads content from disk; replaceable so flow logic is testable.
type Loader struct {
	Fighter func(defPath string) (*Fighter, error)
	Stage   func(defPath string) (*stage.Stage, error)
}

// DefaultLoader reads real content with the character and stage libraries.
func DefaultLoader() Loader { return Loader{Fighter: LoadFighter, Stage: LoadStage} }

// Flow is the screen state machine: select -> stage -> setup -> match -> result.
type Flow struct {
	Chars, Stages []Entry
	Loader        Loader

	Screen Screen
	// Picking is which player is choosing a character (0 or 1).
	Picking int
	Cursor  int
	Picks   [2]int // chosen roster indexes
	StageNo int

	RoundIdx, TimeIdx int
	SetupRow          int // a SetupRow* constant
	Player2CPU        bool

	Fighters [2]*Fighter
	Stage    *stage.Stage
	Match    *Match
	cpu      *CPU // drives player 2 during a match when Player2CPU is set
	cpuIn    input.TickInput
	// RoundOverTicks counts down while a finished round is shown.
	RoundOverTicks int
	// ResultWinner is the match winner shown on the result screen.
	ResultWinner match.Side
	// Message is the error text shown on ScreenError.
	Message string
	// Quit is set when the player asks to leave the game.
	Quit bool
}

// NewFlow starts at character selection. An empty roster or stage list goes
// straight to an error screen instead of an unusable menu.
func NewFlow(chars, stages []Entry, l Loader) *Flow {
	f := &Flow{Chars: chars, Stages: stages, Loader: l, RoundIdx: 1, TimeIdx: 2}
	switch {
	case len(chars) == 0:
		f.fail("No characters found. Put character folders in the characters folder.")
	case len(stages) == 0:
		f.fail("No stages found. Put stage .def files in the stages folder.")
	}
	return f
}

func (f *Flow) fail(msg string) {
	f.Screen, f.Message = ScreenError, msg
}

// Setup returns the currently chosen match setup.
func (f *Flow) Setup() Setup {
	return Setup{Rounds: RoundOptions[f.RoundIdx], TimeLimitSeconds: TimeOptions[f.TimeIdx], Player2CPU: f.Player2CPU}
}

func wrap(i, delta, n int) int { return ((i+delta)%n + n) % n }

// Navigate applies a menu input to the current screen.
func (f *Flow) Navigate(n Nav) {
	switch f.Screen {
	case ScreenSelect:
		f.navSelect(n)
	case ScreenStage:
		f.navStage(n)
	case ScreenSetup:
		f.navSetup(n)
	case ScreenResult:
		f.navResult(n)
	case ScreenError:
		if n == NavCancel || n == NavConfirm {
			f.Quit = true
		}
	case ScreenMatch:
		if n == NavCancel {
			f.toSelect()
		}
	}
}

func (f *Flow) navSelect(n Nav) {
	switch n {
	case NavUp, NavLeft:
		f.Cursor = wrap(f.Cursor, -1, len(f.Chars))
	case NavDown, NavRight:
		f.Cursor = wrap(f.Cursor, 1, len(f.Chars))
	case NavConfirm:
		f.Picks[f.Picking] = f.Cursor
		if f.Picking == 0 {
			f.Picking = 1
			return
		}
		f.Screen, f.Cursor = ScreenStage, f.StageNo
	case NavCancel:
		if f.Picking == 1 {
			f.Picking = 0
			f.Cursor = f.Picks[0]
			return
		}
		f.Quit = true
	}
}

func (f *Flow) navStage(n Nav) {
	switch n {
	case NavUp, NavLeft:
		f.Cursor = wrap(f.Cursor, -1, len(f.Stages))
	case NavDown, NavRight:
		f.Cursor = wrap(f.Cursor, 1, len(f.Stages))
	case NavConfirm:
		f.StageNo, f.Screen, f.SetupRow = f.Cursor, ScreenSetup, SetupRowStart
	case NavCancel:
		f.Screen, f.Picking, f.Cursor = ScreenSelect, 1, f.Picks[1]
	}
}

func (f *Flow) navSetup(n Nav) {
	switch n {
	case NavUp:
		f.SetupRow = wrap(f.SetupRow, -1, setupRowCount)
	case NavDown:
		f.SetupRow = wrap(f.SetupRow, 1, setupRowCount)
	case NavLeft, NavRight:
		d := 1
		if n == NavLeft {
			d = -1
		}
		switch f.SetupRow {
		case SetupRowRounds:
			f.RoundIdx = wrap(f.RoundIdx, d, len(RoundOptions))
		case SetupRowTime:
			f.TimeIdx = wrap(f.TimeIdx, d, len(TimeOptions))
		case SetupRowPlayer2:
			f.Player2CPU = !f.Player2CPU
		}
	case NavConfirm:
		if f.SetupRow == SetupRowStart {
			f.startMatch()
		} else {
			f.SetupRow = wrap(f.SetupRow, 1, setupRowCount)
		}
	case NavCancel:
		f.Screen, f.Cursor = ScreenStage, f.StageNo
	}
}

func (f *Flow) navResult(n Nav) {
	switch n {
	case NavConfirm: // rematch, same characters and stage
		f.startMatch()
	case NavCancel:
		f.toSelect()
	}
}

func (f *Flow) toSelect() {
	f.Match, f.Screen, f.Picking, f.Cursor = nil, ScreenSelect, 0, f.Picks[0]
}

// startMatch loads both characters and the stage; any failure lands on the
// error screen with a message naming what could not be loaded.
func (f *Flow) startMatch() {
	for i := range f.Fighters {
		e := f.Chars[f.Picks[i]]
		fighter, err := f.Loader.Fighter(e.DefPath)
		if err != nil {
			f.fail(fmt.Sprintf("Could not load character %q: %v", e.Name, err))
			return
		}
		f.Fighters[i] = fighter
	}
	se := f.Stages[f.StageNo]
	st, err := f.Loader.Stage(se.DefPath)
	if err != nil {
		f.fail(fmt.Sprintf("Could not load stage %q: %v", se.Name, err))
		return
	}
	f.Stage = st
	m, err := NewMatch(f.Fighters[0], f.Fighters[1], st, f.Setup())
	if err != nil {
		f.fail(fmt.Sprintf("Could not start the match: %v", err))
		return
	}
	f.Match, f.Screen, f.RoundOverTicks = m, ScreenMatch, 0
	f.cpu = nil
	if f.Player2CPU {
		f.cpu = NewCPU(nil)
	}
}

// Tick advances the match screen by one simulation tick (60 per second) with
// both players' held inputs. It does nothing on other screens.
func (f *Flow) Tick(in [2]input.TickInput) {
	if f.Screen != ScreenMatch || f.Match == nil {
		return
	}
	if f.Match.RoundEnded() {
		f.RoundOverTicks--
		if f.RoundOverTicks > 0 {
			return
		}
		if f.Match.Over {
			f.ResultWinner, f.Screen = f.Match.Winner, ScreenResult
			return
		}
		if err := f.Match.NextRound(); err != nil {
			f.fail(err.Error())
		}
		return
	}
	if f.cpu != nil {
		f.cpu.Decide(f.Match.State.Fighters[match.SideP2].Position, f.Match.State.Fighters[match.SideP1].Position, &f.cpuIn)
		in[match.SideP2] = f.cpuIn
	}
	if err := f.Match.Step(in); err != nil {
		f.fail(fmt.Sprintf("The match stopped: %v", err))
		return
	}
	if f.Match.RoundEnded() {
		f.RoundOverTicks = RoundEndTicks
	}
}
