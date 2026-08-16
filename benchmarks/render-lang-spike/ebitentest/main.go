// Ebiten sprite-draw benchmark -- same workload shape as ../sdltest/main.go
// (200 sprites/frame) for comparison.
package main

import (
	"fmt"
	"image"
	"image/color"
	"os"
	"strconv"
	"time"

	"github.com/hajimehoshi/ebiten/v2"
)

const numSprites = 200

type game struct {
	sprite    *ebiten.Image
	frame     int
	maxFrames int
	start     time.Time
	done      bool
}

func (g *game) Update() error {
	return nil
}

func (g *game) Draw(screen *ebiten.Image) {
	if g.frame == 0 {
		g.start = time.Now()
	}
	for i := 0; i < numSprites; i++ {
		op := &ebiten.DrawImageOptions{}
		x := float64((i*37+g.frame)%1200) - 600
		y := float64((i*53+g.frame)%600) - 300
		op.GeoM.Translate(x, y)
		screen.DrawImage(g.sprite, op)
	}
	g.frame++
	if g.frame >= g.maxFrames && !g.done {
		g.done = true
		elapsed := time.Since(g.start)
		totalDraws := int64(g.maxFrames) * int64(numSprites)
		fmt.Printf(
			`{"lang":"ebiten","frames":%d,"sprites_per_frame":%d,"elapsed_ms":%.3f,"total_draws":%d,"draws_per_sec":%.0f,"ms_per_frame":%.4f}`+"\n",
			g.maxFrames, numSprites, float64(elapsed.Microseconds())/1000.0, totalDraws,
			float64(totalDraws)/elapsed.Seconds(), float64(elapsed.Microseconds())/1000.0/float64(g.maxFrames),
		)
		os.Exit(0)
	}
}

func (g *game) Layout(outsideWidth, outsideHeight int) (int, int) {
	return 1280, 720
}

func main() {
	frames := 2000
	if len(os.Args) > 1 {
		if n, err := strconv.Atoi(os.Args[1]); err == nil {
			frames = n
		}
	}

	sprite := ebiten.NewImage(16, 16)
	for y := 0; y < 16; y++ {
		for x := 0; x < 16; x++ {
			sprite.Set(x, y, color.RGBA{128, uint8(128 + (x+y)%64), 200, 255})
		}
	}

	ebiten.SetWindowSize(1280, 720)
	ebiten.SetVsyncEnabled(false)
	ebiten.SetTPS(ebiten.SyncWithFPS) // let Draw run as fast as possible, uncapped by a fixed TPS
	ebiten.SetScreenClearedEveryFrame(false)

	g := &game{sprite: sprite, maxFrames: frames}
	_ = image.Rect // keep image import if unused elsewhere
	if err := ebiten.RunGame(g); err != nil && err.Error() != "" {
		// os.Exit(0) inside Draw is the normal exit path; anything reaching here is a real error.
		fmt.Fprintln(os.Stderr, "ebiten error:", err)
		os.Exit(1)
	}
}
