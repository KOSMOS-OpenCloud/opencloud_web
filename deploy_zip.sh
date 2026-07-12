#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
. "$SCRIPT_DIR/DIST"

REGISTRY="codeberg.org"
OWNER="${PUSH_ORG:-kosmos-opencloud}"
PACKAGE="${PACKAGE_NAME:-opencloud-web}"
TAG="${1:-latest}"
WEB_CORE_DIR="/data/opencloud_podman/web-core/assets/core"

# Resolve latest tag if not specified
if [ "$TAG" = "latest" ]; then
    TAG=$(curl -sf "https://${REGISTRY}/api/v1/packages/${OWNER}?type=generic" \
        -H "Authorization: token ${PUSH_TOKEN}" \
        | python3 -c "
import sys, json
pkgs = [p for p in json.load(sys.stdin) if p['name'] == '${PACKAGE}' and p['version'] != 'latest']
pkgs.sort(key=lambda p: p['version'], reverse=True)
print(pkgs[0]['version'] if pkgs else '')" 2>/dev/null)
    [ -n "$TAG" ] || { echo "ERROR: no packages found"; exit 1; }
fi

echo "=== Deploy ${PACKAGE}:${TAG} to ${HOST} ==="

ZIP_URL="https://${REGISTRY}/api/packages/${OWNER}/generic/${PACKAGE}/${TAG}/${PACKAGE}.zip"

ssh "root@${HOST}" "
    TMPDIR=\$(mktemp -d)
    curl -sfL -o \$TMPDIR/web.zip '${ZIP_URL}'
    rm -rf ${WEB_CORE_DIR}/*
    cd ${WEB_CORE_DIR} && unzip -qo \$TMPDIR/web.zip
    rm -rf \$TMPDIR
    podman restart ${INSTANCE}
"

# Wait for cloud to come back
echo -n "Waiting for https://${HOST} ..."
for i in $(seq 1 30); do
    sleep 2
    STATUS=$(curl -sf -o /dev/null -w "%{http_code}" "https://${HOST}" 2>/dev/null || echo "000")
    if [ "$STATUS" = "200" ]; then
        echo " OK"
        echo "=== Deployed ${PACKAGE}:${TAG} ==="
        exit 0
    fi
    echo -n "."
done
echo " TIMEOUT"
echo "WARNING: https://${HOST} not responding with 200 after 60s"
exit 1
