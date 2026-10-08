// Command quickversus is the native (Windows/Mac/Linux) Quick Versus game:
// raw go-gl + SDL2, importing character/stage/sff/engine as Go packages.
package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/openkakutou/engine/input"
	"github.com/openkakutou/mode-quick-versus/native/internal/game"
	"github.com/openkakutou/mode-quick-versus/native/internal/gfx"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "quickversus:", err)
		os.Exit(1)
	}
}

func run() error {
	content := flag.String("content", "content", "folder with chars/ (one folder per character) and stages/ (stage .def files)")
	frames := flag.Int("frames", 0, "exit after this many frames (0 = run until closed); for smoke tests")
	capture := flag.String("capture", "", "write the last frame to this .png before exiting (needs -frames)")
	width := flag.Int("width", 960, "window width")
	height := flag.Int("height", 720, "window height")
	flag.Parse()

	chars, charErr := game.DiscoverCharacters(filepath.Join(*content, "chars"))
	stages, stageErr := game.DiscoverStages(filepath.Join(*content, "stages"))
	flow := game.NewFlow(chars, stages, game.DefaultLoader())
	if charErr != nil || stageErr != nil {
		flow.Screen = game.ScreenError
		flow.Message = fmt.Sprintf("Cannot read the content folder %q. Use -content to point at it.", *content)
	}

	win, err := gfx.NewWindow("Quick Versus", int32(*width), int32(*height))
	if err != nil {
		return err
	}
	defer win.Close()
	fmt.Println("renderer:", win.Renderer())
	renderer := gfx.NewRenderer(win)

	var held [2]input.TickInput
	var acc float64
	last := time.Now()
	for n := 0; !flow.Quit && gfx.PollEvents(flow); n++ {
		now := time.Now()
		ticks := gfx.Ticks(&acc, float64(now.Sub(last).Microseconds())/1000)
		last = now
		gfx.Held(&held)
		for i := 0; i < ticks; i++ {
			flow.Tick(held)
		}
		win.BeginFrame()
		renderer.Draw(flow)
		lastFrame := *frames > 0 && n+1 >= *frames
		if lastFrame && *capture != "" {
			if err := win.SavePNG(*capture); err != nil { // before the swap: the back buffer is still defined
				return err
			}
		}
		win.EndFrame()
		if lastFrame {
			break
		}
	}
	return nil
}
