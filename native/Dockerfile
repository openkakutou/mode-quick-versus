# Native (Go + go-gl + SDL2) build/test toolchain for mode-quick-versus.
# Everything native runs inside this image so a fresh checkout reproduces the
# build without installing SDL2 headers, a display server or a cross
# compiler on the host. macOS cannot be built from Linux: see
# .github/workflows/native.yml (macos job).
FROM golang:1.26-bookworm

ARG SDL2_MINGW_VERSION=2.30.9
ARG SDL2_MIXER_MINGW_VERSION=2.8.0
ARG SDL2_MIXER_MINGW_SHA256=4f426c9f0863707a1315333c7e41e0b56099fa412d26a27756ad8fa4ef0240ae

RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential pkg-config libsdl2-dev libsdl2-mixer-dev libgl1-mesa-dev libgl1-mesa-dri \
      xvfb xauth x11-utils imagemagick xdotool \
      gcc-mingw-w64-x86-64 wine64 ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

# SDL2 development files for the Windows (mingw-w64) cross-compile.
RUN curl -fsSL -o /tmp/sdl2-mingw.tgz \
      https://github.com/libsdl-org/SDL/releases/download/release-${SDL2_MINGW_VERSION}/SDL2-devel-${SDL2_MINGW_VERSION}-mingw.tar.gz \
    && mkdir -p /opt/sdl2-mingw && tar -xzf /tmp/sdl2-mingw.tgz -C /opt/sdl2-mingw --strip-components=1 \
    && rm /tmp/sdl2-mingw.tgz

# SDL2_mixer development files for the Windows cross-compile (audio). The 2.8
# release has its music/sound decoders built in: SDL2_mixer.dll is the only
# extra DLL to ship. The checksum makes a changed download fail the build.
RUN curl -fsSL -o /tmp/sdl2-mixer-mingw.tgz \
      https://github.com/libsdl-org/SDL_mixer/releases/download/release-${SDL2_MIXER_MINGW_VERSION}/SDL2_mixer-devel-${SDL2_MIXER_MINGW_VERSION}-mingw.tar.gz \
    && echo "${SDL2_MIXER_MINGW_SHA256}  /tmp/sdl2-mixer-mingw.tgz" | sha256sum -c - \
    && mkdir -p /opt/sdl2-mixer-mingw && tar -xzf /tmp/sdl2-mixer-mingw.tgz -C /opt/sdl2-mixer-mingw --strip-components=1 \
    && rm /tmp/sdl2-mixer-mingw.tgz

ENV GOFLAGS=-buildvcs=false \
    GOTOOLCHAIN=auto \
    LIBGL_ALWAYS_SOFTWARE=1
WORKDIR /src/native
