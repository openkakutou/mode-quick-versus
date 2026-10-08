# Native (Go + go-gl + SDL2) build/test toolchain for mode-quick-versus.
# Everything native runs inside this image so a fresh checkout reproduces the
# build without installing SDL2 headers, a display server or a cross
# compiler on the host. macOS cannot be built from Linux: see
# .github/workflows/native.yml (macos job).
FROM golang:1.26-bookworm

ARG SDL2_MINGW_VERSION=2.30.9

RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential pkg-config libsdl2-dev libgl1-mesa-dev libgl1-mesa-dri \
      xvfb xauth x11-utils imagemagick xdotool \
      gcc-mingw-w64-x86-64 wine64 ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

# SDL2 development files for the Windows (mingw-w64) cross-compile.
RUN curl -fsSL -o /tmp/sdl2-mingw.tgz \
      https://github.com/libsdl-org/SDL/releases/download/release-${SDL2_MINGW_VERSION}/SDL2-devel-${SDL2_MINGW_VERSION}-mingw.tar.gz \
    && mkdir -p /opt/sdl2-mingw && tar -xzf /tmp/sdl2-mingw.tgz -C /opt/sdl2-mingw --strip-components=1 \
    && rm /tmp/sdl2-mingw.tgz

ENV GOFLAGS=-buildvcs=false \
    GOTOOLCHAIN=auto \
    LIBGL_ALWAYS_SOFTWARE=1
WORKDIR /src/native
