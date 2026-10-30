#!/usr/bin/env bash
# Run a command inside the native toolchain container (SDL2 headers,
# pkg-config, Xvfb, mingw-w64). Builds the image on first use.
#   native/scripts/docker.sh go test ./...
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# The default tag carries a hash of the Dockerfile, so editing it rebuilds the
# image instead of reusing a stale one (QV_NATIVE_IMAGE overrides the tag).
image="${QV_NATIVE_IMAGE:-quickversus-native:$(sha256sum "$here/Dockerfile" | cut -c1-12)}"
if ! docker image inspect "$image" >/dev/null 2>&1; then
  docker build -t "$image" -f "$here/Dockerfile" "$here"
fi
mkdir -p "$here/.cache/go-mod" "$here/.cache/go-build"
exec docker run --rm \
  -e SDL_AUDIODRIVER=dummy \
  --user "$(id -u):$(id -g)" \
  -e HOME=/tmp -e GOMODCACHE=/src/native/.cache/go-mod -e GOCACHE=/src/native/.cache/go-build \
  -v "$here":/src/native -w /src/native \
  "$image" "$@"
