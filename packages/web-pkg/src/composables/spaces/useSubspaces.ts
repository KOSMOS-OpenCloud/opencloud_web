import { ref, unref, type Ref } from 'vue'
import { useClientService } from '../clientService'
import type { SubspaceEntry } from '@opencloud-eu/web-client/graph'
import type { SpaceResource } from '@opencloud-eu/web-client'

// Module-level cache, also used by getIndicators for sync access
export const subspaceCache = new Map<string, SubspaceEntry[]>()

// Sync check if a node ID is a subspace root in any cached space
export function isSubspaceRootSync(resourceId: string): boolean {
  for (const entries of subspaceCache.values()) {
    if (entries.some((s) => s.id === resourceId)) {
      return true
    }
  }
  return false
}

export function useSubspaces() {
  const clientService = useClientService()
  const subspaces: Ref<SubspaceEntry[]> = ref([])

  async function loadSubspaces(space: SpaceResource): Promise<SubspaceEntry[]> {
    const driveId = space.id
    if (subspaceCache.has(driveId)) {
      subspaces.value = subspaceCache.get(driveId)
      return unref(subspaces)
    }

    try {
      const entries = await clientService.graphAuthenticated.drives.listSubspaces(driveId)
      subspaceCache.set(driveId, entries)
      subspaces.value = entries
    } catch {
      subspaces.value = []
    }
    return unref(subspaces)
  }

  function isSubspaceRoot(resourceId: string): boolean {
    return unref(subspaces).some((s) => s.id === resourceId)
  }

  function invalidateCache(driveId: string) {
    subspaceCache.delete(driveId)
  }

  async function setSubspace(space: SpaceResource, itemId: string): Promise<SubspaceEntry> {
    const entry = await clientService.graphAuthenticated.drives.setSubspace(space.id, itemId)
    invalidateCache(space.id)
    await loadSubspaces(space)
    return entry
  }

  async function removeSubspace(space: SpaceResource, itemId: string): Promise<void> {
    await clientService.graphAuthenticated.drives.deleteSubspace(space.id, itemId)
    invalidateCache(space.id)
    await loadSubspaces(space)
  }

  return {
    subspaces,
    loadSubspaces,
    isSubspaceRoot,
    invalidateCache,
    setSubspace,
    removeSubspace
  }
}
