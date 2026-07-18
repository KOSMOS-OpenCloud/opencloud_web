import { computed, ref, unref } from 'vue'
import { useClientService } from '../clientService'
import type { SubspaceEntry } from '@opencloud-eu/web-client/graph'
import type { SpaceResource } from '@opencloud-eu/web-client'

// Global reactive state — shared across all useSubspaces() instances
const allSubspaces = ref<Record<string, SubspaceEntry[]>>({})

// Extract the node ID from a resource ID (format: "storageId$spaceId!nodeId")
function extractNodeId(resourceId: string): string {
  const bangIdx = resourceId.indexOf('!')
  if (bangIdx >= 0) {
    return resourceId.substring(bangIdx + 1)
  }
  const dollarIdx = resourceId.indexOf('$')
  return dollarIdx >= 0 ? resourceId.substring(dollarIdx + 1) : resourceId
}

// Sync check — works in non-reactive contexts (e.g. getIndicators)
export function isSubspaceRootSync(resourceId: string): boolean {
  const nodeId = extractNodeId(resourceId)
  for (const entries of Object.values(allSubspaces.value)) {
    if (entries.some((s) => s.id === nodeId)) {
      return true
    }
  }
  return false
}

// Sync check — is a path inside any subspace?
export function isInsideSubspaceSync(resourcePath: string): boolean {
  if (!resourcePath) return false
  for (const entries of Object.values(allSubspaces.value)) {
    for (const ss of entries) {
      if (resourcePath === ss.path || resourcePath.startsWith(ss.path + '/')) {
        return true
      }
    }
  }
  return false
}

export function useSubspaces() {
  const clientService = useClientService()

  const subspaces = computed(() => {
    return Object.values(allSubspaces.value).flat()
  })

  function isSubspaceRoot(resourceId: string): boolean {
    const nodeId = extractNodeId(resourceId)
    return unref(subspaces).some((s) => s.id === nodeId)
  }

  async function loadSubspaces(space: SpaceResource): Promise<SubspaceEntry[]> {
    const driveId = space.id
    if (allSubspaces.value[driveId]) {
      return allSubspaces.value[driveId]
    }

    try {
      const entries = await clientService.graphAuthenticated.drives.listSubspaces(driveId)
      allSubspaces.value = { ...allSubspaces.value, [driveId]: entries }
    } catch {
      // ignore
    }
    return allSubspaces.value[driveId] || []
  }

  async function setSubspace(space: SpaceResource, itemId: string): Promise<SubspaceEntry> {
    const entry = await clientService.graphAuthenticated.drives.setSubspace(space.id, itemId)
    // Reload subspace list
    delete allSubspaces.value[space.id]
    allSubspaces.value = { ...allSubspaces.value }
    await loadSubspaces(space)
    return entry
  }

  async function removeSubspace(space: SpaceResource, itemId: string): Promise<void> {
    await clientService.graphAuthenticated.drives.deleteSubspace(space.id, itemId)
    delete allSubspaces.value[space.id]
    allSubspaces.value = { ...allSubspaces.value }
    await loadSubspaces(space)
  }

  return {
    subspaces,
    loadSubspaces,
    isSubspaceRoot,
    setSubspace,
    removeSubspace
  }
}
