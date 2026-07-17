import { computed } from 'vue'
import { useGettext } from 'vue3-gettext'
import { FileAction } from '../types'
import { useMessages } from '../../piniaStores'
import { useSubspaces } from '../../spaces/useSubspaces'
import { isSubspaceRootSync } from '../../spaces/useSubspaces'
import { isProjectSpaceResource } from '@opencloud-eu/web-client'

export function useFileActionsSetSubspace() {
  const { $gettext } = useGettext()
  const { showMessage, showErrorMessage } = useMessages()
  const { setSubspace, removeSubspace } = useSubspaces()

  const actions = computed((): FileAction[] => [
    {
      name: 'set-subspace',
      icon: 'shield-keyhole',
      label: () => $gettext('Mark as subspace'),
      handler: async ({ space, resources }) => {
        try {
          await setSubspace(space, resources[0].id)
          showMessage({ title: $gettext('Folder marked as subspace.') })
        } catch (e) {
          showErrorMessage({
            title: $gettext('Failed to mark as subspace'),
            errors: [e as Error]
          })
        }
      },
      isVisible: ({ space, resources }) => {
        if (resources?.length !== 1) return false
        if (resources[0].type !== 'folder') return false
        if (!isProjectSpaceResource(space)) return false
        if (isSubspaceRootSync(resources[0].id)) return false
        return space.canEditDescription?.() ?? false
      },
      category: 'tertiary'
    },
    {
      name: 'remove-subspace',
      icon: 'shield-keyhole',
      label: () => $gettext('Remove subspace'),
      handler: async ({ space, resources }) => {
        try {
          await removeSubspace(space, resources[0].id)
          showMessage({ title: $gettext('Subspace marking removed.') })
        } catch (e) {
          showErrorMessage({
            title: $gettext('Failed to remove subspace'),
            errors: [e as Error]
          })
        }
      },
      isVisible: ({ space, resources }) => {
        if (resources?.length !== 1) return false
        if (resources[0].type !== 'folder') return false
        if (!isProjectSpaceResource(space)) return false
        if (!isSubspaceRootSync(resources[0].id)) return false
        return space.canEditDescription?.() ?? false
      },
      category: 'tertiary'
    }
  ])

  return { actions }
}
