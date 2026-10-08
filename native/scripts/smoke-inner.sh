#!/usr/bin/env bash
# Runs inside the container (see smoke.sh).
set -euo pipefail
out=dist/smoke; rm -rf "$out"; mkdir -p "$out"
Xvfb :99 -screen 0 1280x800x24 >/dev/null 2>&1 &
xvfb=$!; trap 'kill $xvfb 2>/dev/null || true' EXIT
export DISPLAY=:99 LIBGL_ALWAYS_SOFTWARE=1
sleep 1

# 1. Whole flow, driven by real key events.
./dist/quickversus-linux-amd64 -content testdata/content -width 960 -height 720 &
pid=$!
sleep 2
shot() { import -window root "$out/$1.png"; }
key() { xdotool key --clearmodifiers "$@"; sleep 0.4; }
shot 1-select-p1
key Return; shot 2-select-p2
key Right Return; shot 3-stage
key Return; shot 4-setup
key Return                       # start match (cursor is on "Start")
sleep 2; shot 5-match
xdotool keydown f; sleep 1; xdotool keyup f; shot 6-match-attack
kill -0 $pid                     # still running = no crash
kill $pid; wait $pid 2>/dev/null || true

# 2. Deterministic in-program capture and error screen.
./dist/quickversus-linux-amd64 -content testdata/content -frames 5 -capture "$out/7-capture.png"
./dist/quickversus-linux-amd64 -content /nonexistent -frames 5 -capture "$out/8-error.png"

for f in "$out"/*.png; do
  colors=$(identify -format %k "$f")
  echo "$(basename "$f"): $colors colors"
  [ "$colors" -gt 3 ] || { echo "blank screenshot: $f"; exit 1; }
done
echo "smoke OK"
