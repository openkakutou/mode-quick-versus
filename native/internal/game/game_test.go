package game

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/openkakutou/engine/input"
	"github.com/openkakutou/engine/match"
	"github.com/openkakutou/engine/round"
	"github.com/openkakutou/stage"
)

const content = "../../testdata/content"

func names(es []Entry) []string {
	var out []string
	for _, e := range es {
		out = append(out, e.Name)
	}
	return out
}

func TestDiscoverCharacters_FindsFolderConventionSorted(t *testing.T) {
	got, err := DiscoverCharacters(filepath.Join(content, "chars"))
	if err != nil {
		t.Fatal(err)
	}
	if n := names(got); len(n) != 2 || n[0] != "fighter" || n[1] != "rival" {
		t.Fatalf("got %v, want [fighter rival]", n)
	}
}

func TestDiscoverCharacters_IgnoresFoldersWithoutMatchingDefAndFiles(t *testing.T) {
	root := t.TempDir()
	os.MkdirAll(filepath.Join(root, "empty"), 0o755)
	os.MkdirAll(filepath.Join(root, "wrong"), 0o755)
	os.WriteFile(filepath.Join(root, "wrong", "other.def"), []byte("[Info]"), 0o644)
	os.WriteFile(filepath.Join(root, "loose.def"), []byte("[Info]"), 0o644)
	got, err := DiscoverCharacters(root)
	if err != nil || len(got) != 0 {
		t.Fatalf("got %v, %v; want empty list and no error", got, err)
	}
}

func TestDiscoverCharacters_MissingRootIsError(t *testing.T) {
	if _, err := DiscoverCharacters(filepath.Join(t.TempDir(), "nope")); err == nil {
		t.Fatal("want an error for a missing folder")
	}
}

func TestDiscoverStages_KeepsOnlyDefsWithBGdef(t *testing.T) {
	root := t.TempDir()
	os.WriteFile(filepath.Join(root, "a.def"), []byte("[BGDef]\nspr=a.sff\n"), 0o644)
	os.WriteFile(filepath.Join(root, "b.def"), []byte("[Info]\nname=x\n"), 0o644)
	os.WriteFile(filepath.Join(root, "c.txt"), []byte("[BGdef]"), 0o644)
	got, err := DiscoverStages(root)
	if err != nil {
		t.Fatal(err)
	}
	if n := names(got); len(n) != 1 || n[0] != "a" {
		t.Fatalf("got %v, want [a]", n)
	}
}

func TestSetupValidate(t *testing.T) {
	for _, tc := range []struct {
		s  Setup
		ok bool
	}{{Setup{3, 60}, true}, {Setup{1, 0}, true}, {Setup{2, 60}, false}, {Setup{0, 60}, false}, {Setup{3, -1}, false}} {
		if err := tc.s.Validate(); (err == nil) != tc.ok {
			t.Errorf("%+v: err=%v, want ok=%v", tc.s, err, tc.ok)
		}
	}
}

func TestRoundTimerTicks(t *testing.T) {
	if got := (Setup{3, 99}).RoundTimerTicks(); got != 5940 {
		t.Errorf("99s = %d ticks, want 5940", got)
	}
	if got := (Setup{3, 0}).RoundTimerTicks(); got != UnlimitedTimer {
		t.Errorf("unlimited = %d, want %d", got, UnlimitedTimer)
	}
}

func TestResolveBounds(t *testing.T) {
	own := &stage.Stage{StageBoundaries: stage.StageBoundaries{Left: -50, Right: 80}}
	if b := ResolveBounds(own); b.Left != -50 || b.Right != 80 {
		t.Errorf("valid bounds changed: %+v", b)
	}
	wide := &stage.Stage{BGdef: stage.BGdef{LocalCoordWidth: 640}}
	if b := ResolveBounds(wide); b.Left != -320 || b.Right != 320 {
		t.Errorf("coord fallback = %+v, want +-320", b)
	}
	if b := ResolveBounds(&stage.Stage{}); b.Left != -200 || b.Right != 200 {
		t.Errorf("fixed fallback = %+v, want +-200", b)
	}
}

func TestStartingFighters_SymmetricFacingAndClampedOnNarrowStage(t *testing.T) {
	f := StartingFighters(stage.StageBoundaries{Left: -160, Right: 160})
	if f[0].Position.X != -70 || f[1].Position.X != 70 || f[0].Facing != match.FacingRight || f[1].Facing != match.FacingLeft || f[0].Health != 1000 {
		t.Errorf("unexpected start: %+v", f)
	}
	n := StartingFighters(stage.StageBoundaries{Left: -6, Right: 6})
	if n[0].Position.X != -6 || n[1].Position.X != 6 {
		t.Errorf("narrow stage not clamped: %+v", n)
	}
}

func loadPair(t *testing.T) (*Fighter, *Fighter) {
	t.Helper()
	a, err := LoadFighter(filepath.Join(content, "chars", "fighter", "fighter.def"))
	if err != nil {
		t.Fatal(err)
	}
	b, err := LoadFighter(filepath.Join(content, "chars", "rival", "rival.def"))
	if err != nil {
		t.Fatal(err)
	}
	return a, b
}

func closeStage() *stage.Stage {
	return &stage.Stage{StageBoundaries: stage.StageBoundaries{Left: -6, Right: 6}}
}

func holdA() input.TickInput { return input.TickInput{Buttons: map[string]bool{"a": true}} }

func TestLoadFighter_ReadsCharacterCommandsAndSpritePath(t *testing.T) {
	a, _ := loadPair(t)
	if a.Char.Name != "fighter" || len(a.Cmd.Commands) == 0 || filepath.Base(a.SffPath) != "fighter.sff" {
		t.Errorf("unexpected fighter: name=%q cmds=%d sff=%q", a.Char.Name, len(a.Cmd.Commands), a.SffPath)
	}
}

func TestLoadFighter_MissingDefIsError(t *testing.T) {
	if _, err := LoadFighter(filepath.Join(t.TempDir(), "x.def")); err == nil {
		t.Fatal("want an error")
	}
}

func TestMatch_HoldingAttackKOsOpponentAndEndsBestOfOne(t *testing.T) {
	a, b := loadPair(t)
	m, err := NewMatch(a, b, closeStage(), Setup{Rounds: 1, TimeLimitSeconds: 0})
	if err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 2000 && !m.RoundEnded(); i++ {
		if err := m.Step([2]input.TickInput{holdA(), {}}); err != nil {
			t.Fatal(err)
		}
	}
	if m.LastRound.Outcome != round.OutcomeKO || m.LastRound.Winner != match.SideP1 {
		t.Fatalf("round = %+v, want P1 KO", m.LastRound)
	}
	if got := m.State.Fighters[match.SideP2].Health; got > 0 {
		t.Errorf("loser health = %d, want <= 0", got)
	}
	if !m.Over || m.Winner != match.SideP1 || m.Progress.Wins[0] != 1 {
		t.Errorf("over=%v winner=%v progress=%+v", m.Over, m.Winner, m.Progress)
	}
	if err := m.Step([2]input.TickInput{}); err == nil {
		t.Error("stepping a finished match must fail")
	}
	if err := m.NextRound(); err == nil {
		t.Error("NextRound on a finished match must fail")
	}
}

func TestMatch_NextRoundResetsHealthAndPositions(t *testing.T) {
	a, b := loadPair(t)
	m, _ := NewMatch(a, b, closeStage(), Setup{Rounds: 3, TimeLimitSeconds: 0})
	for i := 0; i < 2000 && !m.RoundEnded(); i++ {
		m.Step([2]input.TickInput{holdA(), {}})
	}
	if m.Over {
		t.Fatal("best of 3 must not be over after one round")
	}
	if err := m.NextRound(); err != nil {
		t.Fatal(err)
	}
	if m.State.Round != 2 || m.State.Fighters[1].Health != DefaultHealth || m.RoundEnded() {
		t.Errorf("round not reset: %+v ended=%v", m.State, m.RoundEnded())
	}
	if m.Progress.Wins[0] != 1 {
		t.Errorf("round win lost on reset: %+v", m.Progress)
	}
}

func TestMatch_TimeoutWithEqualHealthIsDraw(t *testing.T) {
	a, b := loadPair(t)
	m, _ := NewMatch(a, b, closeStage(), Setup{Rounds: 1, TimeLimitSeconds: 1})
	for i := 0; i < 200 && !m.RoundEnded(); i++ {
		m.Step([2]input.TickInput{})
	}
	if m.LastRound.Outcome != round.OutcomeTimeoutDraw || m.Over {
		t.Errorf("round=%+v over=%v, want draw and not over", m.LastRound, m.Over)
	}
}

func TestNewMatch_RejectsBadInput(t *testing.T) {
	a, b := loadPair(t)
	if _, err := NewMatch(a, b, closeStage(), Setup{Rounds: 2}); err == nil {
		t.Error("even rounds must be rejected")
	}
	if _, err := NewMatch(nil, b, closeStage(), Setup{Rounds: 1}); err == nil {
		t.Error("missing fighter must be rejected")
	}
}

func newTestFlow(t *testing.T) *Flow {
	t.Helper()
	chars, _ := DiscoverCharacters(filepath.Join(content, "chars"))
	stages, _ := DiscoverStages(filepath.Join(content, "stages"))
	return NewFlow(chars, stages, DefaultLoader())
}

func TestFlow_FullPathSelectionToResultAndRematch(t *testing.T) {
	f := newTestFlow(t)
	if f.Screen != ScreenSelect {
		t.Fatalf("start screen = %v", f.Screen)
	}
	f.Navigate(NavConfirm) // P1 picks fighter
	f.Navigate(NavRight)
	f.Navigate(NavConfirm) // P2 picks rival
	if f.Screen != ScreenStage || f.Picks != [2]int{0, 1} {
		t.Fatalf("screen=%v picks=%v", f.Screen, f.Picks)
	}
	f.Navigate(NavConfirm)
	if f.Screen != ScreenSetup {
		t.Fatalf("screen = %v, want setup", f.Screen)
	}
	f.Navigate(NavUp) // time row
	f.Navigate(NavUp) // rounds row
	f.Navigate(NavLeft)
	if got := f.Setup(); got.Rounds != 1 {
		t.Fatalf("setup = %+v, want 1 round", got)
	}
	f.SetupRow = 2
	f.Navigate(NavConfirm)
	if f.Screen != ScreenMatch || f.Match == nil {
		t.Fatalf("screen=%v msg=%q", f.Screen, f.Message)
	}
	// Shrink the stage so the fixture fighters can reach each other.
	f.Match, _ = NewMatch(f.Fighters[0], f.Fighters[1], closeStage(), f.Setup())
	for i := 0; i < 5000 && f.Screen == ScreenMatch; i++ {
		f.Tick([2]input.TickInput{holdA(), {}})
	}
	if f.Screen != ScreenResult || f.ResultWinner != match.SideP1 {
		t.Fatalf("screen=%v winner=%v", f.Screen, f.ResultWinner)
	}
	f.Navigate(NavConfirm) // rematch
	if f.Screen != ScreenMatch || f.Match.State.Round != 1 || f.Match.Progress.RoundsPlayed != 0 {
		t.Errorf("rematch did not start fresh: screen=%v", f.Screen)
	}
	f.Navigate(NavCancel) // leave match
	if f.Screen != ScreenSelect || f.Picking != 0 {
		t.Errorf("cancel should return to selection, got %v", f.Screen)
	}
}

func TestFlow_CursorWrapsAndCancelBacksOut(t *testing.T) {
	f := newTestFlow(t)
	f.Navigate(NavUp)
	if f.Cursor != 1 {
		t.Errorf("cursor = %d, want wrap to 1", f.Cursor)
	}
	f.Navigate(NavConfirm)
	f.Navigate(NavCancel)
	if f.Picking != 0 || f.Cursor != 1 {
		t.Errorf("cancel in P2 pick: picking=%d cursor=%d", f.Picking, f.Cursor)
	}
	f.Navigate(NavCancel)
	if !f.Quit {
		t.Error("cancel on the first screen should quit")
	}
}

func TestFlow_MirrorMatchAllowed(t *testing.T) {
	f := newTestFlow(t)
	f.Navigate(NavConfirm)
	f.Navigate(NavConfirm)
	if f.Picks != [2]int{0, 0} || f.Screen != ScreenStage {
		t.Errorf("picks=%v screen=%v", f.Picks, f.Screen)
	}
}

func TestFlow_EmptyRosterOrStagesShowsError(t *testing.T) {
	f := NewFlow(nil, []Entry{{"s", "s.def"}}, DefaultLoader())
	if f.Screen != ScreenError || f.Message == "" {
		t.Errorf("no characters: screen=%v", f.Screen)
	}
	f = NewFlow([]Entry{{"c", "c.def"}}, nil, DefaultLoader())
	if f.Screen != ScreenError {
		t.Errorf("no stages: screen=%v", f.Screen)
	}
	f.Navigate(NavConfirm)
	if !f.Quit {
		t.Error("confirming the error screen should quit")
	}
}

func TestFlow_UnloadableCharacterShowsErrorNamingIt(t *testing.T) {
	f := NewFlow([]Entry{{"ghost", filepath.Join(t.TempDir(), "ghost.def")}}, []Entry{{"s", "s.def"}}, DefaultLoader())
	f.Navigate(NavConfirm)
	f.Navigate(NavConfirm)
	f.Navigate(NavConfirm)
	f.SetupRow = 2
	f.Navigate(NavConfirm)
	if f.Screen != ScreenError || !contains(f.Message, "ghost") {
		t.Errorf("screen=%v message=%q", f.Screen, f.Message)
	}
}

func TestFlow_TickOutsideMatchIsNoop(t *testing.T) {
	f := newTestFlow(t)
	f.Tick([2]input.TickInput{holdA(), {}})
	if f.Screen != ScreenSelect {
		t.Errorf("screen changed to %v", f.Screen)
	}
}

func contains(s, sub string) bool {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}
