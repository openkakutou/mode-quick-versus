package audio

import (
	"errors"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/openkakutou/character"
	"github.com/openkakutou/engine/input"
	"github.com/openkakutou/mode-quick-versus/native/internal/game"
	"github.com/openkakutou/stage"
	"github.com/veandco/go-sdl2/mix"
)

const content = "../../testdata/content"

// newPlayer opens a Player on the dummy driver and records its warnings.
func newPlayer(t *testing.T) (*Player, *[]string) {
	t.Helper()
	t.Setenv("SDL_AUDIODRIVER", "dummy")
	p := New()
	var warns []string
	p.warnf = func(format string, a ...any) { warns = append(warns, fmt.Sprintf(format, a...)) }
	t.Cleanup(p.Close)
	if !p.open {
		t.Fatal("mixer did not open on the dummy driver")
	}
	return p, &warns
}

// sine is one second of 8 kHz mono PCM, long enough to still play when asserted.
func sine() character.Sound {
	pcm := make([]int16, 8000)
	for i := range pcm {
		pcm[i] = int16(8000 * math.Sin(2*math.Pi*440*float64(i)/8000))
	}
	return character.Sound{Group: 5, Sample: 0, SampleRate: 8000, Channels: 1, BitsPerSample: 16, PCM: pcm}
}

// matchFlow walks the real screen flow to a 3-round match on the arena stage,
// swapped for a close-quarters stage so holding "a" KOs quickly.
func matchFlow(t *testing.T) *game.Flow {
	t.Helper()
	chars, _ := game.DiscoverCharacters(filepath.Join(content, "chars"))
	stages, _ := game.DiscoverStages(filepath.Join(content, "stages"))
	f := game.NewFlow(chars, stages, game.DefaultLoader())
	f.Navigate(game.NavConfirm)
	f.Navigate(game.NavRight)
	f.Navigate(game.NavConfirm)
	f.Navigate(game.NavConfirm)
	f.SetupRow = game.SetupRowStart
	f.Navigate(game.NavConfirm)
	if f.Screen != game.ScreenMatch {
		t.Fatalf("screen = %v, msg %q", f.Screen, f.Message)
	}
	m, err := game.NewMatch(f.Fighters[0], f.Fighters[1], &stage.Stage{StageBoundaries: stage.StageBoundaries{Left: -6, Right: 6}}, f.Setup())
	if err != nil {
		t.Fatal(err)
	}
	f.Match = m
	return f
}

func hold() [2]input.TickInput {
	return [2]input.TickInput{{Buttons: map[string]bool{"a": true}}, {}}
}

func tickUntil(t *testing.T, f *game.Flow, done func() bool) {
	t.Helper()
	for i := 0; i < 6000 && !done(); i++ {
		f.Tick(hold())
	}
	if !done() {
		t.Fatalf("condition never reached, screen = %v", f.Screen)
	}
}

func TestNew_OpensMixerWithStereo44kAnd16Channels(t *testing.T) {
	p, warns := newPlayer(t)
	freq, _, ch, _, err := mix.QuerySpec()
	if err != nil || freq != 44100 || ch != 2 {
		t.Errorf("spec = %d Hz, %d ch, err %v; want 44100 Hz, 2 ch", freq, ch, err)
	}
	if n := mix.AllocateChannels(-1); n != 16 {
		t.Errorf("channels = %d, want 16", n)
	}
	if len(*warns) != 0 {
		t.Errorf("warnings on a healthy open: %v", *warns)
	}
	_ = p
}

func TestNew_WithoutUsableAudioDeviceReturnsSafeNoOpPlayer(t *testing.T) {
	real := openAudio
	openAudio = func(int, uint16, int, int) error { return errors.New("no audio device") }
	defer func() { openAudio = real }()
	p := New()
	if p == nil || p.open {
		t.Fatalf("want a non-nil closed Player, got %+v", p)
	}
	f := matchFlow(t)
	p.Update(f) // must not panic
	if mix.PlayingMusic() {
		t.Error("a failed Player must stay silent")
	}
	p.Close()
	p.Close()
}

func TestNilPlayerMethodsAreNoOps(t *testing.T) {
	var p *Player
	p.Update(matchFlow(t))
	p.Close()
}

func TestUpdate_StartsStageMusicOnMatchAndLoopsItAcrossRoundsAndResult(t *testing.T) {
	p, warns := newPlayer(t)
	f := matchFlow(t)
	p.Update(f)
	if !mix.PlayingMusic() {
		t.Fatalf("music not playing at match start; warnings %v", *warns)
	}
	owner := p.owner
	tickUntil(t, f, func() bool { return f.RoundOverTicks > 0 })
	p.Update(f)
	tickUntil(t, f, func() bool { return f.Match.Progress.RoundsPlayed == 1 && f.RoundOverTicks == 0 })
	p.Update(f)
	if !mix.PlayingMusic() || p.owner != owner {
		t.Error("music must keep playing, unchanged, into the next round")
	}
	tickUntil(t, f, func() bool { return f.Screen == game.ScreenResult })
	p.Update(f)
	if !mix.PlayingMusic() || p.owner != owner {
		t.Error("music must keep playing on the result screen")
	}
}

func TestUpdate_HaltsMusicOnBackToSelectAndRestartsItOnRematch(t *testing.T) {
	p, _ := newPlayer(t)
	f := matchFlow(t)
	p.Update(f)
	tickUntil(t, f, func() bool { return f.Screen == game.ScreenResult })
	f.Navigate(game.NavConfirm) // rematch: new Match
	p.Update(f)
	if !mix.PlayingMusic() || p.owner != f.Match {
		t.Fatal("rematch must restart the music under the new match")
	}
	f.Navigate(game.NavCancel)
	p.Update(f)
	if mix.PlayingMusic() || p.owner != nil {
		t.Error("back to select must leave silence and no owner")
	}
}

func TestUpdate_RematchRestartsMusicThatHadStopped(t *testing.T) {
	p, _ := newPlayer(t)
	f := matchFlow(t)
	p.Update(f)
	tickUntil(t, f, func() bool { return f.Screen == game.ScreenResult })
	mix.HaltMusic()
	f.Navigate(game.NavConfirm)
	p.Update(f)
	if !mix.PlayingMusic() {
		t.Error("rematch must start the music again")
	}
}

func TestUpdate_MissingMusicFileLeavesSilenceAndWarnsOnceNamingThePath(t *testing.T) {
	p, warns := newPlayer(t)
	f := matchFlow(t)
	f.Stage.MusicFile = "nope.ogg"
	for i := 0; i < 3; i++ {
		p.Update(f)
	}
	if mix.PlayingMusic() {
		t.Error("missing music must stay silent")
	}
	if len(*warns) != 1 || !strings.Contains((*warns)[0], "nope.ogg") {
		t.Errorf("warnings = %v, want exactly one naming nope.ogg", *warns)
	}
}

func TestUpdate_GarbageMusicFileLeavesSilence(t *testing.T) {
	p, warns := newPlayer(t)
	f := matchFlow(t)
	garbage := filepath.Join(t.TempDir(), "bad.mp3")
	writeFile(t, garbage, []byte("this is not audio at all"))
	f.Stage.MusicFile = garbage
	p.Update(f)
	if mix.PlayingMusic() || len(*warns) != 1 {
		t.Errorf("playing=%v warnings=%v, want silence and one warning", mix.PlayingMusic(), *warns)
	}
}

func TestUpdate_StageWithoutMusicStaysSilentWithoutWarning(t *testing.T) {
	p, warns := newPlayer(t)
	f := matchFlow(t)
	f.Stage.MusicFile = ""
	p.Update(f)
	if mix.PlayingMusic() || len(*warns) != 0 {
		t.Errorf("playing=%v warnings=%v", mix.PlayingMusic(), *warns)
	}
}

func withSample(f *game.Flow, side int) {
	f.Fighters[side].Char.Sounds = []character.SoundGroup{{Index: 5, Sounds: []character.Sound{sine()}}}
}

// attackFrames ticks the match holding the attack, calling Update each frame,
// for n frames.
func attackFrames(p *Player, f *game.Flow, n int) {
	for i := 0; i < n; i++ {
		f.Tick(hold())
		p.Update(f)
	}
}

func TestUpdate_CueWithKnownSamplePlaysOnAChannel(t *testing.T) {
	p, warns := newPlayer(t)
	f := matchFlow(t)
	withSample(f, 0)
	for i := 0; i < 30 && mix.Playing(-1) == 0; i++ {
		attackFrames(p, f, 1)
	}
	if n := mix.Playing(-1); n != 1 {
		t.Errorf("playing channels = %d, want 1; warnings %v", n, *warns)
	}
	if c := p.chunks[chunkKey{0, 5, 0}]; c == nil {
		t.Error("the decoded sample must be cached")
	}
}

// playUntilCached drives attacks until a sample is audible and cached.
func playUntilCached(t *testing.T, p *Player, f *game.Flow) {
	t.Helper()
	for i := 0; i < 60 && (mix.Playing(-1) == 0 || p.chunks[chunkKey{0, 5, 0}] == nil); i++ {
		attackFrames(p, f, 1)
	}
	if mix.Playing(-1) == 0 || p.chunks[chunkKey{0, 5, 0}] == nil {
		t.Fatal("test setup: a sample should be playing and cached")
	}
}

func TestUpdate_OwnerChangeSilencesEffectsAndEmptiesTheChunkCache(t *testing.T) {
	p, _ := newPlayer(t)
	f := matchFlow(t)
	withSample(f, 0)
	playUntilCached(t, p, f)
	f.Navigate(game.NavCancel) // back to select: the owner becomes nil
	p.Update(f)
	if n := mix.Playing(-1); n != 0 {
		t.Errorf("playing channels = %d, want 0 after the owner changed", n)
	}
	if len(p.chunks) != 0 {
		t.Errorf("cached chunks = %d, want 0 after the owner changed", len(p.chunks))
	}
	if p.owner != nil {
		t.Error("owner must be nil on the select screen")
	}
}

func TestUpdate_RematchWithAnotherSampleBankPlaysTheNewSampleNotTheCachedOne(t *testing.T) {
	p, _ := newPlayer(t)
	f := matchFlow(t)
	withSample(f, 0) // 1 s sample
	playUntilCached(t, p, f)
	if ms := p.chunks[chunkKey{0, 5, 0}].LengthInMs(); ms < 990 || ms > 1010 {
		t.Fatalf("test setup: first chunk = %d ms, want about 1000", ms)
	}
	oldOwner := p.owner
	loadFighter := f.Loader.Fighter
	f.Loader.Fighter = func(def string) (*game.Fighter, error) {
		fighter, err := loadFighter(def)
		if err == nil {
			short := sine()
			short.PCM = short.PCM[:4000] // 0.5 s
			fighter.Char.Sounds = []character.SoundGroup{{Index: 5, Sounds: []character.Sound{short}}}
		}
		return fighter, err
	}
	tickUntil(t, f, func() bool { return f.Screen == game.ScreenResult })
	f.Navigate(game.NavConfirm) // rematch: a new Match with freshly loaded fighters
	p.Update(f)
	if p.owner == oldOwner || p.owner != f.Match {
		t.Fatal("test setup: the rematch must hand the player a new owner")
	}
	if n := mix.Playing(-1); n != 0 {
		t.Fatalf("playing channels = %d right after the rematch, want 0", n)
	}
	playUntilCached(t, p, f)
	if ms := p.chunks[chunkKey{0, 5, 0}].LengthInMs(); ms < 490 || ms > 510 {
		t.Errorf("cached chunk = %d ms, want about 500 (the new bank), not the previous match's 1000", ms)
	}
	if n := mix.Playing(-1); n != 1 {
		t.Errorf("playing channels = %d, want exactly 1", n)
	}
}

func TestUpdate_EffectsBeyondSixteenChannelsAreDroppedSilently(t *testing.T) {
	p, warns := newPlayer(t)
	f := matchFlow(t)
	withSample(f, 0)
	attackFrames(p, f, 150) // one cue per attack, the 1 s sample outlives them all
	if n := mix.Playing(-1); n != 16 {
		t.Errorf("playing channels = %d, want 16", n)
	}
	if p.dropped < 1 {
		t.Errorf("dropped = %d, want at least one cue refused for lack of a channel", p.dropped)
	}
	if len(*warns) != 0 {
		t.Errorf("dropping an effect must be silent, got %v", *warns)
	}
}

func TestUpdate_CharacterWithoutThatSampleIsSkippedAndWarnedOnce(t *testing.T) {
	p, warns := newPlayer(t) // fixture characters carry no sound bank
	f := matchFlow(t)
	attackFrames(p, f, 60) // several attacks, each cues 5,0
	if mix.Playing(-1) != 0 {
		t.Error("an unknown sample must not play")
	}
	if len(*warns) != 1 || !strings.Contains((*warns)[0], "5") {
		t.Errorf("warnings = %v, want exactly one", *warns)
	}
}

func TestUpdate_UndecodableSampleIsSkippedAndCachedAsFailure(t *testing.T) {
	p, warns := newPlayer(t)
	f := matchFlow(t)
	bad := sine()
	bad.Channels = 0 // present in the bank but cannot be wrapped as a WAV
	f.Fighters[0].Char.Sounds = []character.SoundGroup{{Index: 5, Sounds: []character.Sound{bad}}}
	attackFrames(p, f, 60)
	if mix.Playing(-1) != 0 || len(*warns) != 1 {
		t.Errorf("playing=%d warnings=%v, want silence and one warning", mix.Playing(-1), *warns)
	}
	if c, ok := p.chunks[chunkKey{0, 5, 0}]; !ok || c != nil {
		t.Errorf("failure must be cached as a nil chunk, got %v ok=%v", c, ok)
	}
}

func TestUpdate_LeavesCuesUnplayedWhenNoMatchIsShown(t *testing.T) {
	p, _ := newPlayer(t)
	f := matchFlow(t)
	withSample(f, 0)
	p.Update(f)
	m := f.Match
	for f.Match.State.Fighters[0].StateNo != 200 {
		f.Tick(hold())
	}
	f.Tick(hold())
	f.Screen = game.ScreenSelect
	p.Update(f)
	if mix.Playing(-1) != 0 {
		t.Error("nothing may play once the match is gone")
	}
	if len(m.DrainCues(nil)) == 0 {
		t.Error("test setup: an attack cue should have been pending")
	}
}

func TestClose_IsIdempotentAndReleasesTheMixer(t *testing.T) {
	p, _ := newPlayer(t)
	f := matchFlow(t)
	withSample(f, 0)
	p.Update(f)
	attackFrames(p, f, 30)
	if mix.Playing(-1) == 0 {
		t.Fatal("test setup: a sample should be playing")
	}
	p.Close()
	p.Close()
	if _, _, _, open, _ := mix.QuerySpec(); open != 0 {
		t.Errorf("mixer still open after Close (open=%d)", open)
	}
	p.Update(f) // after Close: no-op, no panic
}

func TestUpdate_WithNoStateChangeDoesNotAllocate(t *testing.T) {
	p, _ := newPlayer(t)
	f := matchFlow(t)
	p.Update(f)
	if n := testing.AllocsPerRun(50, func() { p.Update(f) }); n != 0 {
		t.Errorf("idle Update allocs = %v, want 0", n)
	}
}

func writeFile(t *testing.T, path string, b []byte) {
	t.Helper()
	if err := os.WriteFile(path, b, 0o644); err != nil {
		t.Fatal(err)
	}
}

func TestDriver_ReportsTheDummyDriverWhenOpenAndOffWhenNot(t *testing.T) {
	p, _ := newPlayer(t)
	if got := p.Driver(); got != "dummy" {
		t.Errorf("open player driver = %q, want dummy", got)
	}
	var none *Player
	if got := none.Driver(); got != "off" {
		t.Errorf("nil player driver = %q, want off", got)
	}
}
