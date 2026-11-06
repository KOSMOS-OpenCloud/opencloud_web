import { FolderLoader, FolderLoaderTask, TaskContext } from '../folderService'
import { Router } from 'vue-router'
import { useTask } from 'vue-concurrency'
import { isLocationCommonActive } from '../../../router'
import { unref } from 'vue'
import { Resource } from '@opencloud-eu/web-client'
import { getVaultClaim, markVaultStatus } from '../../../helpers/folderVault'
import { SmartFolder, isWildcardOnlyQuery, loadSmartFolders } from '../../../helpers/smartFolders'

/** Upper bound for one smart folder listing (favorites load without limit). */
export const smartFolderSearchLimit = 1000

export class FolderLoaderSmartFolder implements FolderLoader {
  public isEnabled(): boolean {
    return true
  }

  public isActive(router: Router): boolean {
    const currentRoute = unref(router.currentRoute)
    return (
      isLocationCommonActive(router, 'files-common-smart-folder') ||
      currentRoute?.query?.contextRouteName === 'files-common-smart-folder'
    )
  }

  public getTask(context: TaskContext): FolderLoaderTask {
    const { resourcesStore, clientService, spacesStore, configStore, router, extensionRegistry } =
      context

    const findSpaceById = (storageId: string) => spacesStore.spaces.find((s) => s.id === storageId)

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return useTask(function* (signal1, signal2) {
      resourcesStore.clearResourceList()
      resourcesStore.setAncestorMetaData({})

      const currentRoute = unref(router.currentRoute)
      const smartFolderId =
        (currentRoute?.params?.smartFolderId as string) ||
        (currentRoute?.query?.contextRouteParams as unknown as Record<string, string>)
          ?.smartFolderId

      const smartFolders: SmartFolder[] = yield loadSmartFolders({
        webdav: clientService.webdav,
        personalSpace: spacesStore.personalSpace,
        presets: configStore.options.smartFolders
      })
      const smartFolder = smartFolders.find(({ id }) => id === smartFolderId)
      if (!smartFolder || isWildcardOnlyQuery(smartFolder.query)) {
        resourcesStore.initResourceList({ currentFolder: null, resources: [] })
        return
      }

      const { resources } = yield clientService.webdav.search(smartFolder.query, {
        searchLimit: smartFolderSearchLimit,
        signal: signal1
      })

      // Same vault policy as the favorites loader: hide encrypted vault
      // content, keep the vault root and flag it.
      const visible = (resources as Resource[]).filter((resource) => {
        const space = findSpaceById(resource.storageId)
        const claim = space ? getVaultClaim(extensionRegistry, space, resource.path) : null
        return !claim?.encryptsNames || claim.vaultRoot === resource.path
      })
      for (const resource of visible) {
        const space = findSpaceById(resource.storageId)
        if (space) {
          markVaultStatus(extensionRegistry, space, [resource])
        }
      }

      resourcesStore.initResourceList({ currentFolder: null, resources: visible })
    })
  }
}
