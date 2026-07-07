import { createFileRouteOptions, isSameResource } from '../../../helpers'
import {
  createLocationPublic,
  createLocationSpaces,
  createLocationTrash,
  isLocationPublicActive,
  isLocationTrashActive
} from '../../../router'
import merge from 'lodash-es/merge'
import { useRouter } from '../../router'
import { computed, unref } from 'vue'
import { useGettext } from 'vue3-gettext'
import { FileAction } from '../types'
import { useCapabilityStore, useResourcesStore } from '../../piniaStores'
import { storeToRefs } from 'pinia'
import { isProjectSpaceResource, isTrashResource, Resource } from '@opencloud-eu/web-client'

// Fallback when server doesn't provide browsable_archives capability
const FALLBACK_ARCHIVE_TYPES = [
  'application/zip',
  'application/x-zip-compressed',
  'application/x-iso9660-image',
  'application/x-raw-disk-image',
  'application/octet-stream'
]

const FALLBACK_ARCHIVE_EXTENSIONS = [
  '.zip', '.iso', '.img', '.raw', '.squashfs', '.fat', '.ext4'
]

export const useFileActionsNavigate = () => {
  const router = useRouter()
  const { $gettext } = useGettext()

  const resourcesStore = useResourcesStore()
  const { currentFolder } = storeToRefs(resourcesStore)
  const capabilityStore = useCapabilityStore()

  function isBrowsableArchive(resource: Resource): boolean {
    if (resource.isFolder) return false

    const serverFormats = unref(capabilityStore.filesBrowsableArchives)
    if (serverFormats && serverFormats.length > 0) {
      const mime = resource.mimeType?.toLowerCase() || ''
      const name = resource.name?.toLowerCase() || ''
      return serverFormats.some(
        (f) =>
          name.endsWith(f.extension) ||
          f.mimeTypes.some((m) => m === mime)
      )
    }

    // Fallback for servers without browsable_archives capability
    if (FALLBACK_ARCHIVE_TYPES.includes(resource.mimeType?.toLowerCase() || '')) {
      return true
    }
    const name = resource.name?.toLowerCase() || ''
    return FALLBACK_ARCHIVE_EXTENSIONS.some((ext) => name.endsWith(ext))
  }

  const routeName = computed(() => {
    if (isLocationPublicActive(router, 'files-public-link')) {
      return createLocationPublic('files-public-link')
    }
    if (isLocationTrashActive(router, 'files-trash-overview')) {
      return createLocationTrash('files-trash-generic')
    }

    return createLocationSpaces('files-spaces-generic')
  })

  const actions = computed((): FileAction[] => [
    {
      name: 'navigate',
      icon: 'folder-open',
      label: () => $gettext('Navigate'),
      isVisible: ({ resources }) => {
        if (resources.length !== 1) {
          return false
        }
        if (unref(currentFolder) !== null && isSameResource(resources[0], unref(currentFolder))) {
          // edge case: current folder breadcrumb menu is not supposed to show the navigate action for itself
          return false
        }
        if (isTrashResource(resources[0])) {
          return false
        }

        if (isProjectSpaceResource(resources[0]) && resources[0].disabled) {
          return false
        }

        return resources[0].isFolder || resources[0].type === 'space' || isBrowsableArchive(resources[0])
      },
      route: ({ space, resources }) => {
        return merge(
          {},
          unref(routeName),
          createFileRouteOptions(space, {
            path: resources[0].path,
            fileId: resources[0].fileId
          })
        )
      },
      class: 'oc-files-actions-navigate-trigger'
    }
  ])

  return {
    actions
  }
}
