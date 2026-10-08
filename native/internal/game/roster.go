// Package game holds the native Quick Versus game logic that needs no
// window, GL context or SDL: roster discovery, match assembly, the match
// session wrapping the engine, and the screen-flow state machine. Keeping it
// cgo-free means it is unit-testable anywhere; the gfx package only draws
// what this package describes.
package game

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// Entry is one selectable character or stage found on disk.
type Entry struct {
	Name    string
	DefPath string
}

// DiscoverCharacters lists the characters under root: every sub-directory
// "<name>" that contains "<name>/<name>.def" (the MUGEN folder convention).
// A missing root is an error; a root with no characters returns an empty
// list. Entries are sorted by name so the roster order is stable.
func DiscoverCharacters(root string) ([]Entry, error) {
	dirs, err := os.ReadDir(root)
	if err != nil {
		return nil, fmt.Errorf("reading characters folder: %w", err)
	}
	var out []Entry
	for _, d := range dirs {
		if !d.IsDir() {
			continue
		}
		def := filepath.Join(root, d.Name(), d.Name()+".def")
		if st, err := os.Stat(def); err == nil && !st.IsDir() {
			out = append(out, Entry{Name: d.Name(), DefPath: def})
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out, nil
}

// DiscoverStages lists the stages under root: every "*.def" file directly in
// root that declares a [BGdef] section (this tells a stage apart from any
// other .def). Sorted by name.
func DiscoverStages(root string) ([]Entry, error) {
	files, err := os.ReadDir(root)
	if err != nil {
		return nil, fmt.Errorf("reading stages folder: %w", err)
	}
	var out []Entry
	for _, f := range files {
		if f.IsDir() || !strings.EqualFold(filepath.Ext(f.Name()), ".def") {
			continue
		}
		path := filepath.Join(root, f.Name())
		data, err := os.ReadFile(path)
		if err != nil || !strings.Contains(strings.ToLower(string(data)), "[bgdef]") {
			continue
		}
		out = append(out, Entry{Name: strings.TrimSuffix(f.Name(), filepath.Ext(f.Name())), DefPath: path})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out, nil
}
