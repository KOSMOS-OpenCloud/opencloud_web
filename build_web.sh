#!/bin/bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

cd "$SCRIPT_DIR"
pnpm install
pnpm build

if [ -n "${DIST_DIR:-}" ]; then
    cp -r dist/* "$DIST_DIR/"
fi
