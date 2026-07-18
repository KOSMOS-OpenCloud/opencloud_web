# Subspace Security Analysis

> Audit date: 2026-07-18 | Scope: reva → opencloud → web (kosmos branches)

## Overview

Subspaces create **permission boundaries within a single space**. A folder marked as subspace root stops permission inheritance — grants from above do not apply below the boundary. Access is controlled exclusively via direct shares (invites) on the subspace folder.

### Core Mechanism

```
Space Root (grants: Alice=Manager, Bob=Editor)
  ├── /public/          ← Alice + Bob have access (inherited)
  └── /finance/         ← SUBSPACE ROOT
       └── report.xlsx  ← Only users with direct grant on /finance/
```

**Permission walk** (reva `assemblePermissions`): Leaf → Root, stops at first subspace node. Space root grants are never inherited into the subspace.

**Navigation grant**: Users with a grant in any subspace get minimal permissions (Stat, ListContainer, GetPath) on ancestor folders — enough to navigate, not to read or write.

**Bypass**: Space owners and service accounts always have full access (checked before subspace logic).

---

## Architecture per Layer

### reva (storage layer)

| File | Purpose |
|------|---------|
| `node/subspace.go` | SubspaceEntry struct, in-memory cache, Add/Remove/Get/Set |
| `node/permissions.go:184-244` | Permission walk with subspace boundary stop |
| `node/permissions.go:256-269` | `userHasSubspaceGrant` — navigation grant check |
| `share/share.go` | `SubspaceRootFilter`, `ContextWithSubspaceRootIDs` |
| `share/manager/jsoncs3/jsoncs3.go` | `MatchesFiltersWithStateAndSubspaces` — share filtering |
| `grpc/services/usershareprovider` | Extracts `subspace_root_ids` from Opaque, sets context |
| `decomposedfs/spaces.go` | `UpdateStorageSpace` — subspace add/remove (manager-only) |
| `metadata/prefixes/prefixes.go` | `SubspacesAttr = "user.oc.subspaces"` |

**Storage**: JSON array in xattr `user.oc.subspaces` on space root node.

**Authorization**: Only space managers can add/remove subspaces (enforced in `spaces.go`).

### opencloud (API layer)

| File | Purpose |
|------|---------|
| `api_drives_subspace.go` | HTTP handlers: ListSubspaces, SetSubspace, DeleteSubspace, GetItemSpaceContext |
| `service.go` | Route registration |
| `sharedwithme.go:46-58` | Collects subspace IDs, passes to reva as Opaque filter |

**Endpoints**:
- `GET /v1beta1/drives/{id}/subspaces` — list subspace entries
- `POST /v1beta1/drives/{id}/items/{itemId}/subspace` — mark folder as subspace
- `DELETE /v1beta1/drives/{id}/items/{itemId}/subspace` — remove subspace marking
- `GET /v1beta1/drives/{id}/items/{itemId}/space` — detect if item is inside a subspace

### web (frontend)

| File | Purpose |
|------|---------|
| `web-client/src/graph/drives/drives.ts` | API client methods |
| `web-client/src/graph/drives/types.ts` | SubspaceEntry, SpaceContext types |
| `web-pkg/src/composables/spaces/useSubspaces.ts` | Global reactive cache, CRUD operations |
| `web-pkg/src/composables/resources/useResourceIndicators.ts` | Shield-keyhole badge on subspace folders |
| `web-pkg/src/composables/actions/files/useFileActionsSetSubspace.ts` | Context menu actions |
| `web-app-files/src/components/SideBar/Shares/SubspaceMembers.vue` | Member management panel |
| `web-app-files/src/components/SideBar/Shares/FileShares.vue` | "Inside subspace" info display |
| `web-pkg/src/components/SideBar/Spaces/Details/SpaceDetails.vue` | Subspace list in space sidebar |

---

## Verified Secure Behaviors

- **Permission boundary**: Walk stops at subspace node — grants above do not leak into subspace. Tested for nested subspaces.
- **Navigation grant is minimal**: Only Stat + ListContainer + GetPath. No read, write, delete, or download.
- **Owner bypass**: Space owner always has full access (checked before subspace logic).
- **Service account bypass**: Service accounts get fixed permissions regardless of subspaces.
- **Denial handling**: `userHasSubspaceGrant` correctly skips denied permissions (`denied=true` → skip).
- **Share filtering**: Subspace root shares are excluded from "Shared with me" via `SubspaceRootFilter`.
- **Manager-only mutations**: Only space managers can add/remove subspaces (reva enforces).
- **URL encoding**: Web API client uses `encodeURIComponent()` on all path parameters.

---

## Known Issues

### CRITICAL

#### W1: Unit test imports non-existent export

**File**: `web-pkg/tests/unit/composables/spaces/useSubspaces.spec.ts:2`

The test imports `subspaceCache` (a `Map`), but the implementation was refactored to use `allSubspaces` (a Vue `ref`). The export `subspaceCache` does not exist. All tests in this file fail at import time.

```typescript
// BROKEN — subspaceCache is not exported
import { subspaceCache, isSubspaceRootSync } from '../../../../src/composables/spaces/useSubspaces'
```

**Impact**: No test coverage for subspace cache logic. CI may pass if test file is not included in test runs.

#### R3: JSON parse error causes silent permission escalation

**File**: `opencloud_reva/pkg/storage/pkg/decomposedfs/node/subspace.go:41-43`

If the xattr `user.oc.subspaces` contains malformed JSON (disk corruption, race condition), `json.Unmarshal` fails and `GetSubspaceList` returns `nil` — **all subspace boundaries disappear silently**. No error is logged.

```go
if err := json.Unmarshal([]byte(raw), &entries); err != nil {
    return nil // ← All boundaries gone, no log
}
```

**Impact**: Corrupted xattr → users outside a subspace gain full access to subspace contents. The most severe security issue in the current implementation.

**Fix**: Log at WARN/ERROR level. Consider returning an error to callers so they can deny access by default.

### HIGH

#### W3: Race condition on auto-mark in SubspaceMembers panel

**File**: `web-app-files/src/components/SideBar/Shares/SubspaceMembers.vue:76-79`

The panel calls `setSubspace()` without `await` on mount. If the user adds a member before this completes, the `watch` on `directShares` (line 123) fires another `setSubspace()`. Two concurrent API calls race on the same subspace entry.

```typescript
// Line 76-79: fire-and-forget
setSubspace(unref(space), unref(resource).id).catch(...)

// Line 123-126: watch fires concurrently
if (hasNow && !hadMembers && !isSubspaceRoot(r.id)) {
  await setSubspace(s, r.id)  // duplicate call
}
```

**Impact**: Double API calls, potential cache inconsistency. Server-side AddSubspace is idempotent (returns early if exists), so no data corruption — but the client cache may end up stale.

### MEDIUM

#### R2: TOCTOU in Add/RemoveSubspace

**File**: `opencloud_reva/pkg/storage/pkg/decomposedfs/node/subspace.go:70-91`

`AddSubspace` reads the list, checks for duplicates, appends, and writes back. `RemoveSubspace` does the same with filtering. Neither operation is atomic. Concurrent calls can lose updates.

```
T1: AddSubspace("A") reads [X, Y]
T2: AddSubspace("B") reads [X, Y]
T1: writes [X, Y, A]
T2: writes [X, Y, B]  ← A is lost
```

**Impact**: Lost subspace entries. Low probability in practice (only managers can call this), but possible.

**Fix**: Use compare-and-swap on xattr or file-level locking.

#### R1: In-memory cache without TTL or cluster invalidation

**File**: `opencloud_reva/pkg/storage/pkg/decomposedfs/node/subspace.go:19-23`

The `subspaceCache` map has no TTL. `InvalidateSubspaceCache` is process-local only. In multi-instance deployments, one instance updates the xattr while others serve stale cached data indefinitely.

**Impact**: Permission boundary changes not visible on other instances until process restart. Currently mitigated by single-instance deployment.

#### O1: Silent fallback in collectSubspaceRootIDs

**File**: `opencloud/services/graph/pkg/service/v0/api_drives_subspace.go:259-261`

If `ListStorageSpaces` fails, the function returns `nil` without logging. The caller in `sharedwithme.go` skips the `SubspaceRootFilter` entirely, causing subspace shares to appear in "Shared with me".

```go
if err != nil || listRes.GetStatus().GetCode() != rpc.Code_CODE_OK {
    return nil // ← No filter applied, no log
}
```

**Impact**: During service degradation, subspace shares leak into "Shared with me" view.

#### W4: Silent cache failure after successful mutation

**File**: `web-pkg/src/composables/spaces/useSubspaces.ts:68-74`

After `setSubspace()` succeeds on the server, the cache is cleared and reloaded via `loadSubspaces()`. If the reload fails (network error), the catch block silently swallows the error. The cache stays empty — UI shows no subspace badge despite the subspace existing on the server.

```typescript
try {
  const entries = await clientService.graphAuthenticated.drives.listSubspaces(driveId)
  allSubspaces.value = { ...allSubspaces.value, [driveId]: entries }
} catch {
  // ignore ← cache stays empty
}
```

### LOW

#### R6: No cleanup on folder deletion

When a subspace folder is deleted, the entry remains in the xattr list. Orphaned entries are harmless (reva skips non-existent nodes), but accumulate over time and slow down permission checks.

#### W2: Dead exports after migration to server-side detection

**File**: `web-pkg/src/composables/spaces/useSubspaces.ts:31-48`

`getContainingSubspacePath()` and `isInsideSubspaceSync()` are exported but no longer imported anywhere. They were replaced by the server-side `/space` endpoint (commit `baaa111638`).

#### R4: IsSubspaceID uses linear scan

**File**: `opencloud_reva/pkg/storage/pkg/decomposedfs/node/subspace.go:114-121`

`IsSubspaceID` iterates the full subspace list on every call. Called once per node in the permission walk. Should use a map for O(1) lookup when the list grows.

#### W5: No client-side cache TTL

The `allSubspaces` ref is never automatically invalidated. If another admin removes a subspace, the current user's UI continues showing the badge until page reload.

---

## Recommendations (Priority Order)

1. **Fix test file** (W1) — update imports to match current implementation
2. **Log JSON parse errors** (R3) — prevent silent permission escalation
3. **Await auto-mark** (W3) — prevent race condition in SubspaceMembers panel
4. **Add error logging** (O1, W4) — make failures visible
5. **Atomic xattr updates** (R2) — prevent lost updates on concurrent mutations
6. **Remove dead exports** (W2) — reduce API surface confusion
7. **Add cache TTL** (R1, W5) — defense-in-depth for stale state
8. **Cleanup on delete** (R6) — prevent orphaned entries

---

## Test Coverage

### Covered

- Nested subspaces: user with grant on outer cannot access inner (reva `subspace_permissions_test.go`)
- Share filter: `SubspaceRootFilter` correctly excludes subspace shares (reva `share_test.go`)
- Permission boundary: grants above subspace do not apply below (reva `subspace_permissions_test.go`)

### Missing

- Denial shares combined with subspace grants
- Concurrent Add/RemoveSubspace operations
- Folder deletion with active subspace marking
- JSON corruption in xattr
- Web: `isSubspaceRootSync` with various ID formats (test file broken)
- Web: `loadSpaceContext` error handling
- Web: cache invalidation after `setSubspace`/`removeSubspace`
