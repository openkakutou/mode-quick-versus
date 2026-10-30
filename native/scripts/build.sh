#!/usr/bin/env bash
# Build native binaries into native/dist/.  Usage: build.sh [linux] [windows]   (default: both)
# macOS is NOT built here: it cannot be built from Linux. See .github/workflows/native.yml.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
targets=("$@"); [ ${#targets[@]} -gt 0 ] || targets=(linux windows)
mkdir -p "$here/../dist"
for t in "${targets[@]}"; do
  case "$t" in
    linux)
      "$here/docker.sh" go build -o dist/quickversus-linux-amd64 ./cmd/quickversus ;;
    windows)
      # SDL2 and SDL2_mixer mingw dev files live in /opt/sdl2-mingw and /opt/sdl2-mixer-mingw
      # (see Dockerfile); both DLLs are copied next to the exe.
      "$here/docker.sh" bash -c '
        S=/opt/sdl2-mingw/x86_64-w64-mingw32
        M=/opt/sdl2-mixer-mingw/x86_64-w64-mingw32
        CGO_ENABLED=1 GOOS=windows GOARCH=amd64 CC=x86_64-w64-mingw32-gcc \
        CGO_CFLAGS="-I$S/include -I$S/include/SDL2 -I$M/include -I$M/include/SDL2" CGO_LDFLAGS="-L$S/lib -L$M/lib" \
        go build -o dist/quickversus-windows-amd64.exe ./cmd/quickversus && cp $S/bin/SDL2.dll $M/bin/SDL2_mixer.dll dist/' ;;
    *) echo "unknown target $t (linux|windows)" >&2; exit 2 ;;
  esac
done
