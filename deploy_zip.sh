#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
. "$SCRIPT_DIR/DIST"

REGISTRY="codeberg.org"
OWNER="${PUSH_ORG:-kosmos-opencloud}"
PACKAGE="${PACKAGE_NAME:-opencloud-web}"
TAG="${1:-latest}"

# Resolve latest tag if not specified
if [ "$TAG" = "latest" ]; then
    TAG=$(curl -sf "https://${REGISTRY}/api/v1/packages/${OWNER}?type=generic" \
        -H "Authorization: token ${PUSH_TOKEN}" \
        | python3 -c "
import sys, json
pkgs = [p for p in json.load(sys.stdin) if p['name'] == '${PACKAGE}']
pkgs.sort(key=lambda p: p['version'], reverse=True)
print(pkgs[0]['version'] if pkgs else '')" 2>/dev/null)
    [ -n "$TAG" ] || { echo "ERROR: no packages found"; exit 1; }
fi

echo "=== Deploy ${PACKAGE}:${TAG} to ${HOST} ==="

ZIP_URL="https://${REGISTRY}/api/packages/${OWNER}/generic/${PACKAGE}/${TAG}/${PACKAGE}.zip"

ssh "root@${HOST}" "
    TMPDIR=\$(mktemp -d)
    curl -sfL -o \$TMPDIR/web.zip '${ZIP_URL}'
    podman exec ${INSTANCE} rm -rf /var/lib/opencloud/web/assets/core/*
    podman cp \$TMPDIR/web.zip ${INSTANCE}:/tmp/web.zip
    podman exec ${INSTANCE} sh -c 'cd /var/lib/opencloud/web/assets/core && unzip -qo /tmp/web.zip && rm /tmp/web.zip'
    rm -rf \$TMPDIR
    podman restart ${INSTANCE}
"

echo "=== Deployed ${PACKAGE}:${TAG} ==="
