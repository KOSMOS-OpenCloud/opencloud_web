#!/usr/bin/env python3
"""Live test for nested subspace permissions on cloud.brandis.eu Test5 space.

Usage: python3 test_subspace_live.py <access_token>

Tests:
1. Create test-pfad/x3/x5/x6 + files m3.pdf, m5.pdf, x6.pdf
2. Mark x3, x5, x6 as subspaces
3. List subspaces
4. Test getItemSpaceContext for all items
"""
import sys, urllib.request, urllib.parse, json, xml.etree.ElementTree as ET, ssl

if len(sys.argv) < 2:
    print("Usage: python3 test_subspace_live.py <access_token>")
    sys.exit(1)

TOKEN = sys.argv[1]
HOST = "https://cloud.brandis.eu"
SPACEID = "f7e671d7-36e5-493f-b0c7-ffe5ee4319a5$6bd275c4-0a62-4634-b240-970d4710fbb2"
DAV = f"{HOST}/dav/spaces/{SPACEID}"
DRIVEID = SPACEID.replace("$", "%24")
GRAPH = f"{HOST}/graph/v1beta1"
CTX = ssl.create_default_context()

def req(method, url, data=None, content_type=None, extra_headers=None):
    headers = {"Authorization": f"Bearer {TOKEN}"}
    if content_type:
        headers["Content-Type"] = content_type
    if extra_headers:
        headers.update(extra_headers)
    if isinstance(data, str):
        data = data.encode()
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(r, context=CTX)
        return resp.status, resp.read().decode()
    except urllib.request.HTTPError as e:
        return e.code, e.read().decode()

def propfind(path):
    body = '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/><oc:fileid xmlns:oc="http://owncloud.org/ns"/></d:prop></d:propfind>'
    code, data = req("PROPFIND", f"{DAV}/{path}", body, "application/xml", {"Depth": "1"})
    if code != 207:
        return []
    root = ET.fromstring(data)
    ns = {'d': 'DAV:', 'oc': 'http://owncloud.org/ns'}
    results = []
    for r in root.findall('.//d:response', ns):
        href = r.find('d:href', ns).text
        rt = r.find('.//d:resourcetype/d:collection', ns)
        fid = r.find('.//oc:fileid', ns)
        name = href.rstrip('/').split('/')[-1]
        results.append((name, 'DIR' if rt is not None else 'FILE', fid.text if fid is not None else '?'))
    return results[1:]  # skip self


# --- STEP 1: Verify structure exists ---
print("=" * 60)
print("STEP 1: Verify/create test structure")
print("=" * 60)

# Check if test-pfad exists
code, _ = req("PROPFIND", f"{DAV}/test-pfad", '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/></d:prop></d:propfind>', "application/xml")
if code == 404:
    print("Creating test-pfad/x3/x5/x6...")
    for p in ["test-pfad", "test-pfad/x3", "test-pfad/x3/x5", "test-pfad/x3/x5/x6"]:
        c, _ = req("MKCOL", f"{DAV}/{p}")
        print(f"  MKCOL {p}: {c}")
    for name, path in [("m3.pdf", "test-pfad/x3/m3.pdf"), ("m5.pdf", "test-pfad/x3/x5/m5.pdf"), ("x6.pdf", "test-pfad/x3/x5/x6/x6.pdf")]:
        c, _ = req("PUT", f"{DAV}/{path}", f"{name} test content".encode())
        print(f"  PUT {path}: {c}")
else:
    print(f"test-pfad exists (HTTP {code})")

# Collect file IDs
print("\n--- File IDs ---")
ids = {}
for path in ["test-pfad", "test-pfad/x3", "test-pfad/x3/x5", "test-pfad/x3/x5/x6"]:
    for name, typ, fid in propfind(path):
        ids[name] = fid
        # Extract node ID (after !)
        nid = fid.split("!")[-1] if "!" in fid else fid
        depth = path.count('/') - 1
        print(f"  {'  ' * depth}{typ:4s} {name:20s} nodeId={nid}")

# --- STEP 2: Mark subspaces ---
print("\n" + "=" * 60)
print("STEP 2: Mark x3, x5, x6 as subspaces")
print("=" * 60)

for folder in ["x3", "x5", "x6"]:
    fid = ids.get(folder)
    if not fid:
        print(f"  {folder}: FILEID NOT FOUND!")
        continue
    encoded_fid = urllib.parse.quote(fid, safe='')
    url = f"{GRAPH}/drives/{DRIVEID}/items/{encoded_fid}/subspace"
    code, data = req("POST", url)
    status = "OK" if code == 200 else f"FAIL ({code})"
    detail = ""
    if code != 200:
        try:
            detail = json.loads(data).get("error", {}).get("code", data[:80])
        except:
            detail = data[:80]
    print(f"  {folder}: {status} {detail}")

# --- STEP 3: List subspaces ---
print("\n" + "=" * 60)
print("STEP 3: List subspaces")
print("=" * 60)

code, data = req("GET", f"{GRAPH}/drives/{DRIVEID}/subspaces")
if code == 200:
    entries = json.loads(data)
    if isinstance(entries, list):
        for ss in entries:
            print(f"  id={ss.get('id'):40s} path={ss.get('path')}")
    elif isinstance(entries, dict) and 'value' in entries:
        for ss in entries['value']:
            print(f"  id={ss.get('id'):40s} path={ss.get('path')}")
    else:
        print(f"  Unexpected format: {str(entries)[:200]}")
else:
    print(f"  HTTP {code}: {data[:200]}")

# --- STEP 4: Test getItemSpaceContext ---
print("\n" + "=" * 60)
print("STEP 4: getItemSpaceContext (isSpace check)")
print("=" * 60)

test_items = ["x3", "m3.pdf", "x5", "m5.pdf", "x6", "x6.pdf"]
for name in test_items:
    fid = ids.get(name)
    if not fid:
        print(f"  {name:12s} → FILEID NOT FOUND")
        continue
    encoded_fid = urllib.parse.quote(fid, safe='')
    url = f"{GRAPH}/drives/{DRIVEID}/items/{encoded_fid}/space"
    code, data = req("GET", url)
    if code == 200:
        r = json.loads(data)
        print(f"  {name:12s} → type={r.get('type'):10s} path={r.get('path')}")
    else:
        try:
            err = json.loads(data).get("error", {}).get("code", "?")
        except:
            err = data[:60]
        print(f"  {name:12s} → HTTP {code}: {err}")

# --- SUMMARY ---
print("\n" + "=" * 60)
print("Expected results:")
print("  x3       → type=subspace   path=/test-pfad/x3")
print("  m3.pdf   → type=subspace   path=/test-pfad/x3")
print("  x5       → type=subspace   path=/test-pfad/x3/x5")
print("  m5.pdf   → type=subspace   path=/test-pfad/x3/x5")
print("  x6       → type=subspace   path=/test-pfad/x3/x5/x6")
print("  x6.pdf   → type=subspace   path=/test-pfad/x3/x5/x6")
print("=" * 60)
