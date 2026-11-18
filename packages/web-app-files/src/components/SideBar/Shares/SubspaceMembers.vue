<template>
  <div id="oc-subspace-members" class="relative rounded-sm">
    <invite-collaborator-form
      v-if="canShare({ space, resource })"
      key="subspace-collaborator"
      :save-button-label="$gettext('Add')"
      :label="$gettext('Add members')"
      :invite-label="$gettext('Search')"
      :resource="resource"
      :show-private-link="false"
      :show-share-options="false"
      :success-message="$gettext('Member was added successfully')"
      :error-message="$gettext('Failed to add member')"
      :subspace="true"
      class="mt-2"
    />
    <template v-if="hasMembers">
      <div class="flex items-center justify-between">
        <h4 class="font-semibold my-0" v-text="$gettext('Members')" />
      </div>
      <ul
        id="subspace-members-list"
        class="oc-list m-0"
        :aria-label="$gettext('Subspace members')"
      >
        <li v-for="collaborator in directShares" :key="collaborator.id" class="pt-2">
          <collaborator-list-item
            :share="collaborator"
            :modifiable="canShare({ space, resource })"
            :removable="canShare({ space, resource })"
            :is-space-share="true"
            @on-delete="deleteMemberConfirm(collaborator)"
          />
        </li>
      </ul>
    </template>
    <p v-else class="text-sm text-role-on-surface-variant mt-2">
      {{ $gettext('No subspace members yet. Add members to restrict access to this folder.') }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, unref, watch, Ref } from 'vue'
import { useGettext } from 'vue3-gettext'
import {
  SpaceResource,
  Resource,
  CollaboratorShare
} from '@opencloud-eu/web-client'
import {
  useCanShare,
  useMessages,
  useModals,
  useSharesStore,
  useClientService,
  useSubspaces
} from '@opencloud-eu/web-pkg'
import InviteCollaboratorForm from './Collaborators/InviteCollaborator/InviteCollaboratorForm.vue'
import CollaboratorListItem from './Collaborators/ListItem.vue'

const { $gettext } = useGettext()
const { canShare } = useCanShare()
const { showMessage, showErrorMessage } = useMessages()
const { dispatchModal } = useModals()
const clientService = useClientService()
const sharesStore = useSharesStore()
const { deleteSubspaceShare } = sharesStore

const resource = inject<Ref<Resource>>('resource')
const space = inject<Ref<SpaceResource>>('space')

const directShares = computed(() =>
  sharesStore.collaboratorShares.filter((s: CollaboratorShare) => !s.indirect)
)

const { isSubspaceRoot, reloadSubspaces } = useSubspaces()

// A folder with shares is not a subspace. Only a folder registered as
// subspace has subspace members; the direct shares of any other folder are
// plain shares and are listed in the share panel, not here.
const isSubspace = computed(() => {
  const folder = unref(resource)
  return !!folder?.id && isSubspaceRoot(folder.id)
})

const hasMembers = computed(() => unref(isSubspace) && directShares.value.length > 0)

// Adding the first member creates the subspace, removing the last one removes
// it again: refresh the subspace list whenever the direct shares change.
watch(
  () => directShares.value.length,
  () => {
    const currentSpace = unref(space)
    if (currentSpace) {
      reloadSubspaces(currentSpace)
    }
  }
)

const deleteMemberConfirm = (share: CollaboratorShare) => {
  dispatchModal({
    title: $gettext('Remove member'),
    confirmText: $gettext('Remove'),
    message: $gettext('Are you sure you want to remove this member?'),
    hasInput: false,
    onConfirm: async () => {
      try {
        await deleteSubspaceShare({
          clientService,
          space: unref(space),
          resource: unref(resource),
          collaboratorShare: share
        })
        showMessage({ title: $gettext('Member was removed successfully') })
      } catch (error) {
        console.error(error)
        showErrorMessage({
          title: $gettext('Failed to remove member'),
          errors: [error as Error]
        })
      }
    }
  })
}

// Subspace registration is handled by the backend, but only for this panel:
// adding a member here (subspace/permissions endpoint) registers the folder
// as subspace, removing the last grant removes the subspace again.
// A share created in the share panel is a plain share and never creates a
// subspace. No UI-side marking needed.
</script>
