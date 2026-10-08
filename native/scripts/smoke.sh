#!/usr/bin/env bash
# Run the Linux binary for real under Xvfb with software OpenGL, drive it with
# synthetic key presses through selection -> setup -> match, and capture
# screenshots into native/dist/smoke/. Fails if the program crashes or a
# screenshot is blank.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$here/build.sh" linux
exec "$here/docker.sh" bash scripts/smoke-inner.sh
