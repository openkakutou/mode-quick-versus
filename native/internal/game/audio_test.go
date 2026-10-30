package game

import (
	"errors"
	"github.com/openkakutou/stage"
	"path/filepath"
	"reflect"
	"testing"

	"github.com/openkakutou/character"
	"github.com/openkakutou/engine/evaluator"
	"github.com/openkakutou/engine/input"
	"github.com/openkakutou/engine/match"
)

func ev(g, s int) evaluator.SoundEvent { return evaluator.SoundEvent{Group: g, Sample: s} }

func TestDrainCues_ReturnsQueuedSoundsOnceInSideOrderAcrossTicks(t *testing.T) {
	a, b := loadPair(t)
	m, err := NewMatch(a, b, closeStage(), Setup{Rounds: 1})
	if err != nil {
		t.Fatal(err)
	}
	m.queueCues([2][]evaluator.SoundEvent{{ev(5, 0), ev(5, 1)}, {ev(20, 3)}})
	m.queueCues([2][]evaluator.SoundEvent{nil, {ev(0, 0)}})
	got := m.DrainCues(nil)
	want := []Cue{
		{match.SideP1, 5, 0}, {match.SideP1, 5, 1}, {match.SideP2, 20, 3},
		{match.SideP2, 0, 0},
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("cues = %v, want %v", got, want)
	}
	if again := m.DrainCues(nil); len(again) != 0 {
		t.Fatalf("second drain = %v, want empty", again)
	}
}

func TestDrainCues_TruncatesDstAndReusesItsCapacity(t *testing.T) {
	m := &Match{}
	m.queueCues([2][]evaluator.SoundEvent{{ev(1, 2)}, nil})
	dst := make([]Cue, 3, 8)
	for i := range dst {
		dst[i] = Cue{Group: 99}
	}
	got := m.DrainCues(dst)
	if len(got) != 1 || got[0] != (Cue{match.SideP1, 1, 2}) {
		t.Fatalf("got %v, want only the pending cue", got)
	}
	if &got[0] != &dst[0] {
		t.Error("DrainCues must reuse dst's backing array")
	}
}

func TestDrainCues_EmptyQueueDoesNotAllocate(t *testing.T) {
	m := &Match{}
	dst := make([]Cue, 0, 4)
	if n := testing.AllocsPerRun(50, func() { dst = m.DrainCues(dst) }); n != 0 {
		t.Errorf("allocs = %v, want 0", n)
	}
	if len(dst) != 0 {
		t.Errorf("dst = %v, want empty", dst)
	}
}

func TestStep_WithoutPlaySndQueuesNoCues(t *testing.T) {
	a, b := loadPair(t)
	m, _ := NewMatch(a, b, closeStage(), Setup{Rounds: 1})
	for i := 0; i < 10; i++ {
		if err := m.Step([2]input.TickInput{}); err != nil {
			t.Fatal(err)
		}
	}
	if got := m.DrainCues(nil); len(got) != 0 {
		t.Errorf("cues = %v, want none", got)
	}
}

func TestNextRound_ClearsPendingCues(t *testing.T) {
	a, b := loadPair(t)
	m, _ := NewMatch(a, b, closeStage(), Setup{Rounds: 3})
	m.queueCues([2][]evaluator.SoundEvent{{ev(1, 1)}, {ev(2, 2)}})
	if err := m.NextRound(); err != nil {
		t.Fatal(err)
	}
	if got := m.DrainCues(nil); len(got) != 0 {
		t.Errorf("cues after NextRound = %v, want none", got)
	}
}

func snd(g, s, rate, ch int, pcm []int16, errMsg string) character.Sound {
	return character.Sound{Group: g, Sample: s, SampleRate: rate, Channels: ch, BitsPerSample: 16, PCM: pcm, Error: errMsg}
}

func TestFindSound(t *testing.T) {
	good := snd(5, 2, 22050, 1, []int16{1, -1}, "")
	f := &Fighter{Char: &character.Character{Sounds: []character.SoundGroup{
		{Index: 5, Sounds: []character.Sound{snd(5, 0, 22050, 1, nil, ""), good, snd(5, 3, 22050, 1, nil, "bad")}},
		{Index: 6, Sounds: []character.Sound{snd(6, 0, 22050, 1, []int16{7}, "decode failed")}},
	}}}
	if s, ok := f.FindSound(5, 2); !ok || !reflect.DeepEqual(s, good) {
		t.Errorf("FindSound(5,2) = %v, %v; want the sample", s, ok)
	}
	for _, k := range [][2]int{{5, 0}, {5, 3}, {6, 0}, {5, 9}, {9, 2}, {2, 5}} {
		if _, ok := f.FindSound(k[0], k[1]); ok {
			t.Errorf("FindSound(%d,%d) found, want miss", k[0], k[1])
		}
	}
}

func TestFindSound_CharacterWithoutSoundsMisses(t *testing.T) {
	for _, f := range []*Fighter{{Char: &character.Character{}}, {}} {
		if _, ok := f.FindSound(0, 0); ok {
			t.Error("want miss")
		}
	}
}

func TestWAVBytes_BuildsCanonicalPCMHeaderAndLittleEndianPayload(t *testing.T) {
	got := WAVBytes(snd(0, 0, 22050, 2, []int16{1, -2, 0x1234}, ""))
	want := []byte{
		'R', 'I', 'F', 'F', 42, 0, 0, 0, // 36 + 6 data bytes
		'W', 'A', 'V', 'E', 'f', 'm', 't', ' ',
		16, 0, 0, 0, // fmt chunk size
		1, 0, // PCM
		2, 0, // channels
		0x22, 0x56, 0, 0, // 22050 Hz
		0x88, 0x58, 0x01, 0, // byte rate 88200
		4, 0, // block align
		16, 0, // bits
		'd', 'a', 't', 'a', 6, 0, 0, 0,
		1, 0, 0xFE, 0xFF, 0x34, 0x12,
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got  % x\nwant % x", got, want)
	}
}

func TestWAVBytes_RejectsUnplayableSounds(t *testing.T) {
	for name, s := range map[string]character.Sound{
		"empty pcm":     snd(0, 0, 22050, 1, nil, ""),
		"no channels":   snd(0, 0, 22050, 0, []int16{1}, ""),
		"no sampleRate": snd(0, 0, 0, 1, []int16{1}, ""),
	} {
		if got := WAVBytes(s); got != nil {
			t.Errorf("%s: got %d bytes, want nil", name, len(got))
		}
	}
}

// toMatch drives a flow from the select screen to a started match.
func toMatch(t *testing.T) *Flow { return toMatchWith(t, DefaultLoader()) }

func toMatchWith(t *testing.T, l Loader) *Flow {
	t.Helper()
	f := newTestFlow(t)
	f.Loader = l
	f.Navigate(NavConfirm)
	f.Navigate(NavConfirm)
	f.Navigate(NavConfirm)
	f.SetupRow = SetupRowStart
	f.Navigate(NavConfirm)
	if f.Screen != ScreenMatch {
		t.Fatalf("screen=%v msg=%q", f.Screen, f.Message)
	}
	return f
}

func TestMusic_FollowsTheFlowAcrossMatchResultSelectRematchAndError(t *testing.T) {
	f := newTestFlow(t)
	if p, o := f.Music(); o != nil || p != "" {
		t.Fatalf("select screen: %q, %v; want nothing", p, o)
	}
	_, path, changed := MusicChange(nil, f)
	if changed || path != "" {
		t.Fatalf("select screen with no prev: changed=%v path=%q", changed, path)
	}

	f = toMatch(t)
	f.Stage.MusicFile = "bgm/theme.ogg"
	m1 := f.Match
	prev, path, changed := MusicChange(nil, f)
	want := filepath.Join(content, "stages", "bgm", "theme.ogg")
	if prev != m1 || path != want || !changed {
		t.Fatalf("match start: next=%p path=%q changed=%v; want %p %q true", prev, path, changed, m1, want)
	}

	if err := f.Match.NextRound(); err != nil {
		t.Fatal(err)
	}
	if next, _, changed := MusicChange(prev, f); changed || next != m1 {
		t.Errorf("next round: changed=%v, want the same owner unchanged", changed)
	}

	f.Screen = ScreenResult
	if next, p, changed := MusicChange(prev, f); changed || next != m1 || p != want {
		t.Errorf("result screen: changed=%v path=%q, want music to keep playing", changed, p)
	}

	f.Navigate(NavCancel) // back to select
	next, path, changed := MusicChange(prev, f)
	if next != nil || path != "" || !changed {
		t.Errorf("back to select: next=%v path=%q changed=%v; want nil, empty, true", next, path, changed)
	}

	f = toMatch(t)
	load := f.Loader.Stage
	f.Loader.Stage = func(p string) (*stage.Stage, error) { // the rematch reloads the stage
		st, err := load(p)
		if st != nil {
			st.MusicFile = "bgm/theme.ogg"
		}
		return st, err
	}
	f.Navigate(NavCancel)
	f = toMatchWith(t, f.Loader)
	prev = f.Match
	f.Screen = ScreenResult
	f.Navigate(NavConfirm) // rematch
	next, path, changed = MusicChange(prev, f)
	if next == prev || next != f.Match || !changed || path != want {
		t.Errorf("rematch: changed=%v path=%q new owner=%v; want a restart", changed, path, next == f.Match)
	}

	f.fail("boom")
	next, path, changed = MusicChange(next, f)
	if next != nil || path != "" || !changed {
		t.Errorf("error screen: next=%v path=%q changed=%v; want music stopped", next, path, changed)
	}
}

func TestMusic_StageWithoutMusicHasOwnerAndEmptyPath(t *testing.T) {
	f := toMatch(t)
	f.Stage.MusicFile = ""
	if p, o := f.Music(); o != f.Match || p != "" {
		t.Errorf("got %q, %v; want empty path with owner set", p, o)
	}
}

func TestMusic_AbsolutePathStaysAsIs(t *testing.T) {
	f := toMatch(t)
	abs := filepath.Join(t.TempDir(), "x.mp3")
	f.Stage.MusicFile = abs
	if p, _ := f.Music(); p != abs {
		t.Errorf("path = %q, want %q", p, abs)
	}
}

func TestMusic_FailedMatchStartLeavesNoOwner(t *testing.T) {
	f := toMatch(t)
	f.Stage.MusicFile = "bgm/theme.ogg"
	f.Loader.Stage = func(string) (*stage.Stage, error) { return nil, errors.New("stage broken") }
	f.Screen = ScreenResult
	f.Navigate(NavConfirm) // rematch fails to load the stage
	if f.Screen != ScreenError {
		t.Fatalf("screen = %v, want error", f.Screen)
	}
	if p, o := f.Music(); o != nil || p != "" {
		t.Errorf("got %q, %v; want no music on the error screen", p, o)
	}
}

func TestMatch_AttackStatePlaySndQueuesCueForTheAttackingSideOnly(t *testing.T) {
	a, b := loadPair(t)
	m, err := NewMatch(a, b, closeStage(), Setup{Rounds: 1})
	if err != nil {
		t.Fatal(err)
	}
	var got []Cue
	for i := 0; i < 40; i++ {
		if err := m.Step([2]input.TickInput{holdA(), {}}); err != nil {
			t.Fatal(err)
		}
		got = m.DrainCues(got)
		if len(got) > 0 {
			break
		}
	}
	want := []Cue{{Side: match.SideP1, Group: 5, Sample: 0}}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("cues = %v, want %v", got, want)
	}
}
