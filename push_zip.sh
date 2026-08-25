#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
[ -f "$SCRIPT_DIR/DIST" ] && . "$SCRIPT_DIR/DIST"

PACKAGE="${PACKAGE_NAME:-opencloud-web}"
TAG="${TAG:-$(date +%Y%m%d-%H%M)}"

# Build
if [ -z "${SKIP_BUILD:-}" ]; then
    bash "$SCRIPT_DIR/build_web.sh"
fi

# ZIP
TMPZIP="/tmp/${PACKAGE}-${TAG}.zip"
rm -f "$TMPZIP"
(cd "$SCRIPT_DIR/dist" && zip -qr "$TMPZIP" .)
echo "[zip] $(du -h "$TMPZIP" | cut -f1)"

# Push to GitHub Release
GITHUB_TOKEN="${PACKAGES_TOKEN:-${PUSH_TOKEN:-${CODEBERG_TOKEN:-}}}"
GITHUB_REPO="${PUSH_ORG:-${GIT_BASE##*/}}/${REPO:-opencloud_web}"
GITHUB_API="https://api.github.com/repos/${GITHUB_REPO}"

echo "[github] Creating release pkg-${TAG}..."
RELEASE_ID=$(curl -sf -X POST "${GITHUB_API}/releases" \
    -H "Authorization: token ${GITHUB_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"tag_name\":\"pkg-${TAG}\",\"name\":\"${PACKAGE} ${TAG}\",\"draft\":false}" \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)

if [ -n "$RELEASE_ID" ]; then
    echo "[github] Uploading ${PACKAGE}.zip to release ${RELEASE_ID}..."
    curl -sf -X POST "https://uploads.github.com/repos/${GITHUB_REPO}/releases/${RELEASE_ID}/assets?name=${PACKAGE}.zip" \
        -H "Authorization: token ${GITHUB_TOKEN}" \
        -H "Content-Type: application/zip" \
        --data-binary "@${TMPZIP}"
    echo ""
    echo "=== Pushed to GitHub: ${GITHUB_REPO} release ${TAG} ==="
else
    echo "[github] Release creation failed, trying Codeberg fallback..."
    REGISTRY="codeberg.org"
    OWNER="${PUSH_ORG:-kosmos-opencloud}"
    CODEBERG_TOKEN="${PUSH_TOKEN:-${CODEBERG_TOKEN:-}}"
    UPLOAD_URL="https://${REGISTRY}/api/packages/${OWNER}/generic/${PACKAGE}/${TAG}/${PACKAGE}.zip"
    curl -sf -X PUT "$UPLOAD_URL" -H "Authorization: token ${CODEBERG_TOKEN}" --upload-file "$TMPZIP"
    LATEST_URL="https://${REGISTRY}/api/packages/${OWNER}/generic/${PACKAGE}/latest/${PACKAGE}.zip"
    curl -sf -X DELETE "$LATEST_URL" -H "Authorization: token ${CODEBERG_TOKEN}" -o /dev/null 2>/dev/null || true
    curl -sf -X PUT "$LATEST_URL" -H "Authorization: token ${CODEBERG_TOKEN}" --upload-file "$TMPZIP"
    echo "=== Pushed to Codeberg: ${PACKAGE}:${TAG} ==="
fi
