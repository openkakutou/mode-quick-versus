package gfx

import (
	"fmt"
	"os"

	"github.com/openkakutou/character/air"
	"github.com/openkakutou/engine/match"
	"github.com/openkakutou/engine/round"
	"github.com/openkakutou/mode-quick-versus/native/internal/game"
	"github.com/openkakutou/sff"
)

var (
	white  = Rgb(240, 240, 240)
	grey   = Rgb(140, 140, 150)
	gold   = Rgb(255, 210, 60)
	red    = Rgb(220, 60, 60)
	blue   = Rgb(70, 130, 230)
	green  = Rgb(80, 200, 110)
	darkBg = Rgb(18, 20, 32)
	panel  = Rgb(34, 38, 60)
	skyBg  = Rgb(50, 70, 110)
	floor  = Rgb(70, 60, 50)
)

// defaultGroundY is the screen row of the stage floor when a stage declares none.
const defaultGroundY = 220

type spriteKey struct{ fighter, group, image int }

// Renderer draws a game.Flow. It caches sprite textures per match so
// nothing is decoded or uploaded while the match runs.
type Renderer struct {
	win       *Window
	sprites   map[spriteKey]*Texture
	loadedFor *game.Match
}

// NewRenderer builds a renderer for win.
func NewRenderer(win *Window) *Renderer {
	return &Renderer{win: win, sprites: map[spriteKey]*Texture{}}
}

// Draw renders the current screen of f.
func (r *Renderer) Draw(f *game.Flow) {
	w := r.win
	w.Rect(0, 0, VW, VH, darkBg)
	switch f.Screen {
	case game.ScreenSelect:
		r.drawList(f, "Select your fighter", fmt.Sprintf("Player %d", f.Picking+1), names(f.Chars), f.Cursor)
	case game.ScreenStage:
		r.drawList(f, "Select a stage", "", names(f.Stages), f.Cursor)
	case game.ScreenSetup:
		r.drawSetup(f)
	case game.ScreenMatch:
		r.drawMatch(f)
	case game.ScreenResult:
		r.drawResult(f)
	case game.ScreenError:
		w.TextCentered(70, 2, red, "Something went wrong")
		r.wrapped(100, f.Message)
		w.TextCentered(200, 1, grey, "Press enter to quit")
	}
}

func names(es []game.Entry) []string {
	out := make([]string, len(es))
	for i, e := range es {
		out[i] = e.Name
	}
	return out
}

func (r *Renderer) wrapped(y float32, msg string) {
	const perLine = 50
	runes := []rune(msg)
	for len(runes) > 0 {
		n := min(perLine, len(runes))
		r.win.TextCentered(y, 1, white, string(runes[:n]))
		runes = runes[n:]
		y += 12
	}
}

func (r *Renderer) drawList(f *game.Flow, title, sub string, items []string, cursor int) {
	w := r.win
	w.TextCentered(16, 2, gold, title)
	if sub != "" {
		col := blue
		if f.Picking == 1 {
			col = red
		}
		w.TextCentered(40, 1.5, col, sub)
	}
	if f.Screen == game.ScreenSelect {
		w.Text(8, 60, 1, blue, "P1: "+f.Chars[f.Picks[0]].Name)
		if f.Picking == 1 {
			w.Text(8, 72, 1, red, "P2: choosing")
		}
	}
	const rows = 9
	first := max(0, min(cursor-rows/2, len(items)-rows))
	for i := first; i < min(len(items), first+rows); i++ {
		y := float32(90 + (i-first)*14)
		if i == cursor {
			w.Rect(70, y-3, 180, 13, panel)
			w.Text(76, y, 1, gold, ">")
			w.Text(90, y, 1, white, items[i])
		} else {
			w.Text(90, y, 1, grey, items[i])
		}
	}
	w.TextCentered(222, 1, grey, "Arrows move  Enter confirm  Esc back")
}

func (r *Renderer) drawSetup(f *game.Flow) {
	w := r.win
	w.TextCentered(16, 2, gold, "Match setup")
	s := f.Setup()
	time := "No limit"
	if s.TimeLimitSeconds > 0 {
		time = fmt.Sprintf("%d seconds", s.TimeLimitSeconds)
	}
	p2 := "Human"
	if s.Player2CPU {
		p2 = "CPU"
	}
	rows := []string{fmt.Sprintf("Rounds   < best of %d >", s.Rounds), "Time     < " + time + " >", "Player 2 < " + p2 + " >", "Start match"}
	for i, text := range rows {
		y := float32(80 + i*24)
		col := grey
		if i == f.SetupRow {
			w.Rect(50, y-5, 220, 18, panel)
			col = white
		}
		w.Text(60, y, 1.5, col, text)
	}
	w.TextCentered(222, 1, grey, "Up/down row  Left/right change  Enter")
}

func (r *Renderer) drawResult(f *game.Flow) {
	w := r.win
	col := blue
	if f.ResultWinner == match.SideP2 {
		col = red
	}
	w.TextCentered(70, 3, col, fmt.Sprintf("Player %d wins", int(f.ResultWinner)+1))
	p := f.Match.Progress
	w.TextCentered(120, 2, white, fmt.Sprintf("%d - %d", p.Wins[0], p.Wins[1]))
	w.TextCentered(170, 1, grey, "Enter: rematch   Esc: back to selection")
}

// loadSprites decodes and uploads every sprite the match's animations
// reference, once, so the match loop never decodes.
func (r *Renderer) loadSprites(f *game.Flow) {
	for _, t := range r.sprites {
		t.Delete()
	}
	clear(r.sprites)
	r.loadedFor = f.Match
	for i, fighter := range f.Fighters {
		file, err := os.Open(fighter.SffPath)
		if err != nil {
			continue
		}
		for _, a := range fighter.Char.Animations {
			for _, fr := range a.Frames {
				k := spriteKey{i, fr.Group, fr.Image}
				if fr.IsBlank() || r.sprites[k] != nil {
					continue
				}
				px, wd, ht, err := sff.ResolveSpritePixels(file, fr.Group, fr.Image, nil)
				if err != nil || wd == 0 || ht == 0 {
					continue
				}
				r.sprites[k] = NewTexture(px, wd, ht)
			}
		}
		file.Close()
	}
}

// currentFrame resolves which frame of the fighter's animation is showing.
func currentFrame(anims []air.Animation, animNo, animTime int) (air.Frame, bool) {
	for _, a := range anims {
		if a.Number != animNo || len(a.Frames) == 0 {
			continue
		}
		total := 0
		for i, fr := range a.Frames {
			if fr.Time < 0 {
				return fr, true
			}
			total += fr.Time
			_ = i
		}
		t := animTime
		if t >= total {
			loopLen := 0
			for _, fr := range a.Frames[a.LoopStart:] {
				loopLen += fr.Time
			}
			if loopLen <= 0 {
				return a.Frames[len(a.Frames)-1], true
			}
			start := total - loopLen
			t = start + (t-start)%loopLen
		}
		acc := 0
		for _, fr := range a.Frames {
			acc += fr.Time
			if t < acc {
				return fr, true
			}
		}
		return a.Frames[len(a.Frames)-1], true
	}
	return air.Frame{}, false
}

func (r *Renderer) drawMatch(f *game.Flow) {
	w := r.win
	m := f.Match
	if r.loadedFor != m {
		r.loadSprites(f)
	}
	groundY := float32(defaultGroundY)
	if z := f.Stage.BGdef.ZOffset; z > 0 {
		groundY = float32(z)
	}
	w.Rect(0, 0, VW, groundY, skyBg)
	w.Rect(0, groundY, VW, VH-groundY, floor)

	p1 := m.State.Fighters[match.SideP1]
	p2 := m.State.Fighters[match.SideP2]
	camX := float32(p1.Position.X+p2.Position.X) / 2
	for i, fs := range []match.FighterState{p1, p2} {
		sx := VW/2 + float32(fs.Position.X) - camX
		sy := groundY + float32(fs.Position.Y)
		flip := fs.Facing == match.FacingLeft
		drawn := false
		if fr, ok := currentFrame(f.Fighters[i].Char.Animations, m.AnimNo[i], m.AnimTime[i]); ok && !fr.IsBlank() {
			if t := r.sprites[spriteKey{i, fr.Group, fr.Image}]; t != nil {
				if sp, ok := spriteMeta(f.Fighters[i], fr); ok {
					ox := float32(fr.X - sp.AxisX)
					if flip {
						ox = -float32(fr.X) - float32(sp.Width-sp.AxisX)
					}
					w.Sprite(t, sx+ox, sy+float32(fr.Y-sp.AxisY), flip)
					drawn = true
				}
			}
		}
		if !drawn { // no sprite available: a placeholder body keeps the fighter visible
			col := blue
			if i == 1 {
				col = red
			}
			w.Rect(sx-8, sy-60, 16, 60, col)
		}
	}
	r.drawHUD(f)
}

func spriteMeta(fighter *game.Fighter, fr air.Frame) (sff.Sprite, bool) {
	sp, err := fighter.Char.ResolveSprite(fr)
	return sp, err == nil
}

func (r *Renderer) drawHUD(f *game.Flow) {
	w := r.win
	m := f.Match
	for i := 0; i < 2; i++ {
		fs := m.State.Fighters[i]
		frac := float32(max(0, fs.Health)) / game.DefaultHealth
		pow := float32(fs.Power) / game.MaxPower
		col := blue
		if i == 1 {
			col = red
		}
		const bw = 125
		x := float32(10)
		if i == 1 {
			x = VW - 10 - bw
		}
		w.Rect(x-1, 9, bw+2, 12, Rgb(0, 0, 0))
		bx, fw := x, bw*frac
		if i == 1 {
			bx = x + bw - fw // P2's bar drains toward the center
		}
		w.Rect(bx, 10, fw, 10, green)
		w.Rect(x, 24, bw*min(pow, 1), 4, gold)
		name := f.Fighters[i].Char.Name
		if i == 0 {
			w.Text(x, 31, 1, col, name)
		} else {
			w.Text(x+bw-float32(TextWidth(name)), 31, 1, col, name)
		}
		for k := 0; k < m.Progress.RoundsToWin(); k++ {
			c := panel
			if k < m.Progress.Wins[i] {
				c = gold
			}
			px := x + float32(k)*10
			if i == 1 {
				px = x + bw - 8 - float32(k)*10
			}
			w.Rect(px, 40, 8, 8, c)
		}
	}
	timer := "--"
	if f.Setup().TimeLimitSeconds > 0 {
		timer = fmt.Sprintf("%02d", (m.State.RoundTimer+game.TickRateHz-1)/game.TickRateHz)
	}
	w.Text(VW/2-12, 10, 2, white, timer)

	switch {
	case m.RoundEnded():
		w.TextCentered(90, 3, gold, roundBanner(m))
	case m.State.RoundTimer > m.Setup.RoundTimerTicks()-game.TickRateHz && m.Setup.RoundTimerTicks() > 0:
		w.TextCentered(90, 3, gold, fmt.Sprintf("Round %d", m.State.Round))
	}
}

func roundBanner(m *game.Match) string {
	switch m.LastRound.Outcome {
	case round.OutcomeKO:
		return "KO"
	case round.OutcomeDoubleKO:
		return "Double KO"
	case round.OutcomeTimeout:
		return "Time over"
	default:
		return "Draw"
	}
}
