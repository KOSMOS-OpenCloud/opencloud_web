#!/bin/bash
set -euo pipefail

# Build OpenCloud Web using nodejs-ci:24 container (Node 24, pnpm 10).
# Matches upstream build environment to produce compatible MF bundles.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_IMAGE="quay.io/opencloudeu/nodejs-ci:24"

if command -v podman &>/dev/null; then
    CTR=podman
elif command -v docker &>/dev/null; then
    CTR=docker
else
    echo "ERROR: no container runtime found" >&2; exit 1
fi

echo "=== Building web in ${BUILD_IMAGE} ==="
$CTR run --rm \
    --network=host \
    -v "$(realpath "$SCRIPT_DIR"):/web:rw" \
    -w /web \
    "$BUILD_IMAGE" \
    sh -c "pnpm install && pnpm build"

if [ -n "${DIST_DIR:-}" ]; then
    cp -r "$SCRIPT_DIR/dist/"* "$DIST_DIR/"
fi

echo "=== Web build complete ==="
