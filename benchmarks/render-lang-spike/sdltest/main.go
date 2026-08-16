// Raw OpenGL (go-gl) + SDL2 sprite-draw benchmark -- mirrors Ikemen GO's own
// stack (go-gl/gl + veandco/go-sdl2, no game-engine abstraction on top).
package main

import (
	"fmt"
	"os"
	"strconv"
	"time"
	"unsafe"

	"github.com/go-gl/gl/v2.1/gl"
	"github.com/veandco/go-sdl2/sdl"
)

const numSprites = 200 // representative of a busy fighting-game frame: 2 fighters' layered sprites, hitbox overlays, HUD icons

func main() {
	frames := 2000
	if len(os.Args) > 1 {
		if n, err := strconv.Atoi(os.Args[1]); err == nil {
			frames = n
		}
	}

	if err := sdl.Init(sdl.INIT_VIDEO); err != nil {
		panic(err)
	}
	defer sdl.Quit()

	win, err := sdl.CreateWindow("spike", sdl.WINDOWPOS_UNDEFINED, sdl.WINDOWPOS_UNDEFINED,
		1280, 720, sdl.WINDOW_OPENGL|sdl.WINDOW_HIDDEN)
	if err != nil {
		panic(err)
	}
	defer win.Destroy()

	glCtx, err := win.GLCreateContext()
	if err != nil {
		panic(err)
	}
	defer sdl.GLDeleteContext(glCtx)

	if err := gl.Init(); err != nil {
		panic(err)
	}
	sdl.GLSetSwapInterval(0) // vsync off, same as Ebiten's SetVsyncEnabled(false) in the comparison run
	renderer := gl.GoStr(gl.GetString(gl.RENDERER))

	// One shared 16x16 texture, like a sprite atlas cell.
	texData := make([]byte, 16*16*4)
	for i := range texData {
		texData[i] = byte(128 + i%64)
	}
	var tex uint32
	gl.GenTextures(1, &tex)
	gl.BindTexture(gl.TEXTURE_2D, tex)
	gl.TexImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 16, 16, 0, gl.RGBA, gl.UNSIGNED_BYTE, unsafe.Pointer(&texData[0]))
	gl.TexParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
	gl.TexParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)

	// One shared quad (position.xy, texcoord.xy) as a VBO, translated per sprite via the matrix stack.
	quad := []float32{
		0, 0, 0, 0,
		32, 0, 1, 0,
		32, 32, 1, 1,
		0, 0, 0, 0,
		32, 32, 1, 1,
		0, 32, 0, 1,
	}
	var vbo uint32
	gl.GenBuffers(1, &vbo)
	gl.BindBuffer(gl.ARRAY_BUFFER, vbo)
	gl.BufferData(gl.ARRAY_BUFFER, len(quad)*4, unsafe.Pointer(&quad[0]), gl.STATIC_DRAW)

	gl.Enable(gl.TEXTURE_2D)
	gl.EnableClientState(gl.VERTEX_ARRAY)
	gl.EnableClientState(gl.TEXTURE_COORD_ARRAY)
	gl.VertexPointer(2, gl.FLOAT, 16, gl.PtrOffset(0))
	gl.TexCoordPointer(2, gl.FLOAT, 16, gl.PtrOffset(8))
	gl.MatrixMode(gl.MODELVIEW)
	gl.Viewport(0, 0, 1280, 720)

	start := time.Now()
	for f := 0; f < frames; f++ {
		gl.Clear(gl.COLOR_BUFFER_BIT)
		for i := 0; i < numSprites; i++ {
			gl.LoadIdentity()
			x := float32((i*37+f)%1200) - 600
			y := float32((i*53+f)%600) - 300
			gl.Translatef(x, y, 0)
			gl.DrawArrays(gl.TRIANGLES, 0, 6)
		}
		win.GLSwap() // present, same pipeline stage Ebiten's benchmark goes through -- fair comparison
	}
	gl.Finish()
	elapsed := time.Since(start)

	totalDraws := int64(frames) * int64(numSprites)
	fmt.Printf(
		`{"lang":"go-gl+sdl2","renderer":%q,"frames":%d,"sprites_per_frame":%d,"elapsed_ms":%.3f,"total_draws":%d,"draws_per_sec":%.0f,"ms_per_frame":%.4f}`+"\n",
		renderer, frames, numSprites, float64(elapsed.Microseconds())/1000.0, totalDraws,
		float64(totalDraws)/elapsed.Seconds(), float64(elapsed.Microseconds())/1000.0/float64(frames),
	)
}
