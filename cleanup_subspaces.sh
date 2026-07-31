#!/bin/bash
# Usage: ./cleanup_subspaces.sh <bearer_token>
# Deletes ALL subspaces from the Test5 space on cloud.brandis.eu

TOKEN="$1"
if [ -z "$TOKEN" ]; then echo "Usage: $0 <bearer_token>"; exit 1; fi

HOST="https://cloud.brandis.eu"
DRIVEID="f7e671d7-36e5-493f-b0c7-ffe5ee4319a5%246bd275c4-0a62-4634-b240-970d4710fbb2"
RAW_DRIVEID="f7e671d7-36e5-493f-b0c7-ffe5ee4319a5\$6bd275c4-0a62-4634-b240-970d4710fbb2"

echo "=== Listing subspaces ==="
RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" "$HOST/graph/v1beta1/drives/$DRIVEID/subspaces")
echo "$RESPONSE" | python3 -c "
import json,sys
d=json.load(sys.stdin)
ss=d.get('value',d) if isinstance(d,dict) else d
for s in ss:
    print(s['id'],s['path'])
" 2>/dev/null

echo ""
echo "=== Deleting all ==="
echo "$RESPONSE" | python3 -c "
import json,sys,urllib.parse
d=json.load(sys.stdin)
ss=d.get('value',d) if isinstance(d,dict) else d
for s in ss:
    fid=urllib.parse.quote('$RAW_DRIVEID!'+s['id'],safe='')
    print(fid)
" 2>/dev/null | while read FID; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE -H "Authorization: Bearer $TOKEN" "$HOST/graph/v1beta1/drives/$DRIVEID/items/$FID/subspace")
  echo "  DELETE $FID → $CODE"
done

echo ""
echo "=== Verify ==="
curl -s -H "Authorization: Bearer $TOKEN" "$HOST/graph/v1beta1/drives/$DRIVEID/subspaces"
echo ""
