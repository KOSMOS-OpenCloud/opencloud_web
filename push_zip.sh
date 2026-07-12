#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
. "$SCRIPT_DIR/DIST"

REGISTRY="codeberg.org"
OWNER="${PUSH_ORG:-kosmos-opencloud}"
PACKAGE="${PACKAGE_NAME:-opencloud-web}"
TAG="${TAG:-$(date +%Y%m%d-%H%M)}"

# Token
if [ -z "${CODEBERG_TOKEN:-}" ] && [ -f ~/.codeberg-token ]; then
    CODEBERG_TOKEN="$(cat ~/.codeberg-token)"
fi
: "${CODEBERG_TOKEN:?Set CODEBERG_TOKEN or create ~/.codeberg-token}"

# Build
if [ -z "${SKIP_BUILD:-}" ]; then
    bash "$SCRIPT_DIR/build_web.sh"
fi

# ZIP
TMPZIP="/tmp/${PACKAGE}-${TAG}.zip"
rm -f "$TMPZIP"
(cd "$SCRIPT_DIR/dist" && zip -qr "$TMPZIP" .)
echo "[zip] $(du -h "$TMPZIP" | cut -f1)"

# Push
UPLOAD_URL="https://${REGISTRY}/api/packages/${OWNER}/generic/${PACKAGE}/${TAG}/${PACKAGE}.zip"
echo "[push] $UPLOAD_URL"
curl -sf -X PUT "$UPLOAD_URL" \
    -H "Authorization: token ${CODEBERG_TOKEN}" \
    --upload-file "$TMPZIP"

echo "=== Pushed: ${PACKAGE}:${TAG} ==="
