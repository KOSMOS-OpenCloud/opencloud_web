import { ref, unref } from 'vue'
import { storeToRefs } from 'pinia'
import { v4 as uuidV4 } from 'uuid'
import { useClientService } from '../clientService'
import { useConfigStore, useSpacesStore } from '../piniaStores'
import {
  SmartFolder,
  isWildcardOnlyQuery,
  loadPersonalSmartFolders,
  loadSmartFolders,
  savePersonalSmartFolders
} from '../../helpers/smartFolders'

export function useSmartFolders() {
  const clientService = useClientService()
  const configStore = useConfigStore()
  const spacesStore = useSpacesStore()
  const { personalSpace } = storeToRefs(spacesStore)

  const smartFolders = ref<SmartFolder[]>([])

  async function refreshSmartFolders() {
    smartFolders.value = await loadSmartFolders({
      webdav: clientService.webdav,
      personalSpace: unref(personalSpace),
      presets: configStore.options.smartFolders
    })
    return unref(smartFolders)
  }

  async function addSmartFolder(name: string, query: string): Promise<SmartFolder> {
    if (isWildcardOnlyQuery(query)) {
      throw new Error('wildcard-only query')
    }
    // Re-read the file: another tab may have changed it meanwhile
    const personalFolders = await loadPersonalSmartFolders({
      webdav: clientService.webdav,
      personalSpace: unref(personalSpace)
    })
    const smartFolder: SmartFolder = { id: uuidV4(), name: name.trim(), query, preset: false }
    await savePersonalSmartFolders({
      webdav: clientService.webdav,
      personalSpace: unref(personalSpace),
      smartFolders: [...personalFolders, smartFolder]
    })
    await refreshSmartFolders()
    return smartFolder
  }

  async function removeSmartFolder(id: string) {
    const personalFolders = await loadPersonalSmartFolders({
      webdav: clientService.webdav,
      personalSpace: unref(personalSpace)
    })
    await savePersonalSmartFolders({
      webdav: clientService.webdav,
      personalSpace: unref(personalSpace),
      smartFolders: personalFolders.filter((smartFolder) => smartFolder.id !== id)
    })
    await refreshSmartFolders()
  }

  return { smartFolders, refreshSmartFolders, addSmartFolder, removeSmartFolder }
}
