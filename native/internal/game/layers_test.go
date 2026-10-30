package game

import (
	"path/filepath"
	"reflect"
	"testing"

	"github.com/openkakutou/engine/input"
	"github.com/openkakutou/stage"
)

func el(name string, layer int) stage.BGElement {
	return stage.BGElement{Name: name, Type: stage.BGElementNormal, LayerNo: layer, DeltaX: 1, DeltaY: 1}
}

func TestSplitLayers_BehindBelowOneFrontFromOneKeepingFileOrderOnTies(t *testing.T) {
	elements := []stage.BGElement{el("a", 1), el("b", 0), el("c", 2), el("d", 0), el("e", -1), el("f", 1)}
	behind, front := SplitLayers(elements)
	// indexes into elements: behind sorted by layer then file order, front likewise.
	if want := []int{4, 1, 3}; !reflect.DeepEqual(behind, want) {
		t.Fatalf("behind = %v, want %v", behind, want)
	}
	if want := []int{0, 5, 2}; !reflect.DeepEqual(front, want) {
		t.Fatalf("front = %v, want %v", front, want)
	}
}

func TestSplitLayers_NoElementsGivesNothing(t *testing.T) {
	behind, front := SplitLayers(nil)
	if len(behind) != 0 || len(front) != 0 {
		t.Fatalf("got %v / %v, want both empty", behind, front)
	}
}

func TestSplitLayers_DoesNotReorderInput(t *testing.T) {
	elements := []stage.BGElement{el("a", 2), el("b", 0)}
	SplitLayers(elements)
	if elements[0].Name != "a" || elements[1].Name != "b" {
		t.Fatalf("input was reordered: %v", elements)
	}
}

func animStage() *stage.Stage {
	return &stage.Stage{Animations: map[int]stage.BGAnimation{
		200: {Frames: []stage.BGAnimFrame{
			{Sprite: stage.SpriteRef{Group: 0, Image: 0}, Time: 10},
			{Sprite: stage.SpriteRef{Group: 0, Image: 1}, Time: 5},
		}},
		300: {Frames: []stage.BGAnimFrame{{Sprite: stage.SpriteRef{Group: -1, Image: -1}, Time: 5}}},
	}}
}

func TestLayerSprite_StaticTypesUseTheirOwnSpriteIgnoringTime(t *testing.T) {
	for _, typ := range []stage.BGElementType{stage.BGElementNormal, stage.BGElementParallax} {
		e := stage.BGElement{Type: typ, Sprite: stage.SpriteRef{Group: 3, Image: 4}}
		ref, ok := LayerSprite(animStage(), e, 999)
		if !ok || ref != (stage.SpriteRef{Group: 3, Image: 4}) {
			t.Fatalf("%s: got %v ok=%v", typ, ref, ok)
		}
	}
}

func TestLayerSprite_AnimFollowsElapsedTicksAndLoops(t *testing.T) {
	e := stage.BGElement{Type: stage.BGElementAnim, ActionNumber: 200}
	cases := []struct{ ticks, image int }{{0, 0}, {9, 0}, {10, 1}, {14, 1}, {15, 0}, {25, 1}}
	for _, c := range cases {
		ref, ok := LayerSprite(animStage(), e, c.ticks)
		if !ok || ref.Image != c.image {
			t.Errorf("ticks %d: got %v ok=%v, want image %d", c.ticks, ref, ok, c.image)
		}
	}
}

func TestLayerSprite_NothingToDrawForMissingActionBlankFrameOrBlankSprite(t *testing.T) {
	missing := stage.BGElement{Type: stage.BGElementAnim, ActionNumber: 999}
	blankFrame := stage.BGElement{Type: stage.BGElementAnim, ActionNumber: 300}
	blankStatic := stage.BGElement{Type: stage.BGElementNormal, Sprite: stage.SpriteRef{Group: -1, Image: -1}}
	for name, e := range map[string]stage.BGElement{"missing action": missing, "blank frame": blankFrame, "blank static": blankStatic} {
		if ref, ok := LayerSprite(animStage(), e, 0); ok {
			t.Errorf("%s: drew %v, want nothing", name, ref)
		}
	}
}

func TestLayerSprite_UnknownTypeDrawsNothing(t *testing.T) {
	if _, ok := LayerSprite(animStage(), stage.BGElement{Type: "weird"}, 0); ok {
		t.Fatal("an unknown element type must draw nothing")
	}
}

func TestLayerOffset_StartPlusParallaxAgainstCameraScroll(t *testing.T) {
	e := stage.BGElement{StartX: 10, StartY: 20, DeltaX: 0.5, DeltaY: 0.8}
	x, y := LayerOffset(e, 0)
	if x != 10 || y != 20 {
		t.Fatalf("camera at origin: got (%v,%v), want (10,20)", x, y)
	}
	// Camera moves right 40: the world shifts left, scaled by delta.
	x, y = LayerOffset(e, 40)
	if x != -10 || y != 20 {
		t.Fatalf("camera at 40: got (%v,%v), want (-10,20)", x, y)
	}
}

func TestLayerOffset_ZeroDeltaStaysFixedAndUnitDeltaScrollsWithTheWorld(t *testing.T) {
	fixed := stage.BGElement{StartX: 5, DeltaX: 0}
	world := stage.BGElement{StartX: 5, DeltaX: 1}
	if x, _ := LayerOffset(fixed, 100); x != 5 {
		t.Fatalf("delta 0 moved to %v, want 5", x)
	}
	if x, _ := LayerOffset(world, 100); x != -95 {
		t.Fatalf("delta 1 at %v, want -95 (same shift as a fighter)", x)
	}
}

func TestStageSpritePath_ResolvesBesideTheStageDefOrEmptyWhenNone(t *testing.T) {
	st := &stage.Stage{BGdef: stage.BGdef{SpriteFile: "stage0.sff"}}
	if got, want := StageSpritePath(filepath.Join("a", "b", "arena.def"), st), filepath.Join("a", "b", "stage0.sff"); got != want {
		t.Fatalf("got %q, want %q", got, want)
	}
	if got := StageSpritePath("a/arena.def", &stage.Stage{}); got != "" {
		t.Fatalf("stage without sprite file: got %q, want empty", got)
	}
}

func TestMatch_TicksCountsSimulatedStepsAndRestartsEachRound(t *testing.T) {
	a, b := loadPair(t)
	m, err := NewMatch(a, b, closeStage(), Setup{Rounds: 3})
	if err != nil {
		t.Fatal(err)
	}
	if m.Ticks() != 0 {
		t.Fatalf("fresh match ticks = %d, want 0", m.Ticks())
	}
	for i := 0; i < 3; i++ {
		if err := m.Step([2]input.TickInput{}); err != nil {
			t.Fatal(err)
		}
	}
	if m.Ticks() != 3 {
		t.Fatalf("after 3 steps ticks = %d, want 3", m.Ticks())
	}
	if err := m.NextRound(); err != nil {
		t.Fatal(err)
	}
	if m.Ticks() != 0 {
		t.Fatalf("after NextRound ticks = %d, want 0", m.Ticks())
	}
}

func TestFlow_StartMatchRecordsStageDefPathForSpriteLoading(t *testing.T) {
	f := newTestFlow(t)
	f.Navigate(NavConfirm)
	f.Navigate(NavConfirm)
	f.Navigate(NavConfirm)
	f.SetupRow = SetupRowStart
	f.Navigate(NavConfirm)
	if f.Screen != ScreenMatch {
		t.Fatalf("screen=%v msg=%q", f.Screen, f.Message)
	}
	if filepath.Base(f.StageDefPath) != "arena.def" {
		t.Fatalf("StageDefPath = %q, want the chosen stage's .def", f.StageDefPath)
	}
}
