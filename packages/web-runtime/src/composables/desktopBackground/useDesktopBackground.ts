import { unref } from 'vue'
import { Resource, SpaceResource } from '@opencloud-eu/web-client'
import { useClientService, useSpacesStore, useThemeStore } from '@opencloud-eu/web-pkg'

// The desktop background lives hidden in the personal space of the user, so it follows the account.
export const desktopBackgroundFolder = '.Desktop'
export const desktopBackgroundBaseName = 'background'
export const desktopBackgroundMaxBytes = 10 * 1024 * 1024

const backgroundExtensionByMimeType: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif'
}

export const desktopBackgroundFileTypes = Object.keys(backgroundExtensionByMimeType).join(', ')

export const useDesktopBackground = () => {
  const clientService = useClientService()
  const spacesStore = useSpacesStore()
  const themeStore = useThemeStore()

  async function listBackgroundFiles(personalSpace: SpaceResource): Promise<Resource[]> {
    try {
      const { children } = await clientService.webdav.listFiles(personalSpace, {
        path: desktopBackgroundFolder
      })
      return (children || []).filter(
        (child) => !child.isFolder && child.name.startsWith(`${desktopBackgroundBaseName}.`)
      )
    } catch {
      // folder does not exist: no background chosen
      return []
    }
  }

  async function loadDesktopBackground(): Promise<void> {
    const personalSpace = unref(spacesStore.personalSpace)
    if (!personalSpace) {
      return
    }
    const [backgroundFile] = await listBackgroundFiles(personalSpace)
    if (!backgroundFile) {
      themeStore.setBackgroundImage(null)
      return
    }
    const { body: backgroundBlob } = await clientService.webdav.getFileContents(
      personalSpace,
      { path: backgroundFile.path },
      { responseType: 'blob' }
    )
    themeStore.setBackgroundImage(URL.createObjectURL(backgroundBlob))
  }

  async function saveDesktopBackground(imageFile: File): Promise<void> {
    const personalSpace = unref(spacesStore.personalSpace)
    const fileExtension = backgroundExtensionByMimeType[imageFile.type]
    if (!personalSpace || !fileExtension) {
      throw new Error('unsupported background image')
    }
    const previousBackgroundFiles = await listBackgroundFiles(personalSpace)
    try {
      await clientService.webdav.createFolder(personalSpace, {
        path: desktopBackgroundFolder,
        fetchFolder: false
      })
    } catch {
      // folder exists already
    }
    const targetPath = `${desktopBackgroundFolder}/${desktopBackgroundBaseName}.${fileExtension}`
    await clientService.webdav.putFileContents(personalSpace, {
      path: targetPath,
      content: await imageFile.arrayBuffer(),
      overwrite: true
    })
    // a background with another file type would win on the next load
    for (const previousFile of previousBackgroundFiles) {
      if (previousFile.name !== `${desktopBackgroundBaseName}.${fileExtension}`) {
        await clientService.webdav.deleteFile(personalSpace, { path: previousFile.path })
      }
    }
    themeStore.setBackgroundImage(URL.createObjectURL(imageFile))
  }

  async function removeDesktopBackground(): Promise<void> {
    const personalSpace = unref(spacesStore.personalSpace)
    if (!personalSpace) {
      return
    }
    for (const backgroundFile of await listBackgroundFiles(personalSpace)) {
      await clientService.webdav.deleteFile(personalSpace, { path: backgroundFile.path })
    }
    themeStore.setBackgroundImage(null)
  }

  return { loadDesktopBackground, saveDesktopBackground, removeDesktopBackground }
}
