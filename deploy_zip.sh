#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
. "$SCRIPT_DIR/DIST"

PACKAGE="${PACKAGE_NAME:-opencloud-web}"
TAG="${1:-latest}"
TARGET="${TARGET:-cloud_brandis}"
HOST_IP="${HOST_IP:-10.30.100.179}"

# Resolve latest tag from Codeberg Generic Packages
if [ "$TAG" = "latest" ]; then
    REGISTRY="codeberg.org"
    OWNER="${PUSH_ORG:-kosmos-opencloud}"
    TAG=$(curl -sf "https://${REGISTRY}/api/v1/packages/${OWNER}?type=generic" \
        -H "Authorization: token ${PUSH_TOKEN}" \
        | python3 -c "
import sys, json
pkgs = [p for p in json.load(sys.stdin) if p['name'] == '${PACKAGE}' and p['version'] != 'latest']
pkgs.sort(key=lambda p: p['version'], reverse=True)
print(pkgs[0]['version'] if pkgs else '')" 2>/dev/null)
    [ -n "$TAG" ] || { echo "ERROR: no packages found"; exit 1; }
fi

echo "=== Deploy ${PACKAGE}:${TAG} to ${TARGET} (${HOST_IP}) ==="

# Update nu.packages tag and pull
ssh "root@${HOST_IP}" "
    sed -i 's|${PACKAGE}:[0-9]*-[0-9]*|${PACKAGE}:${TAG}|' \
        /nu/container/${TARGET}/compose/nu.packages \
        /nu/container/${TARGET}/nu.packages 2>/dev/null
    nu packages pull ${TARGET}
    systemctl restart ${TARGET}-opencloud.service
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
echo " TIMEOUT (container may still be starting)"
exit 0
