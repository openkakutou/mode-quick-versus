#!/usr/bin/env bash
# Vet + unit tests for the native program, inside the container.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$here/docker.sh" bash -c 'test -z "$(gofmt -l cmd internal)" || { gofmt -l cmd internal; echo "gofmt: files need formatting"; exit 1; }; go vet ./... && go test ./...'
