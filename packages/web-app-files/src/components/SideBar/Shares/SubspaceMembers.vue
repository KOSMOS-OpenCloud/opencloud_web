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
  useSubspaces,
  useClientService
} from '@opencloud-eu/web-pkg'
import InviteCollaboratorForm from './Collaborators/InviteCollaborator/InviteCollaboratorForm.vue'
import CollaboratorListItem from './Collaborators/ListItem.vue'

const { $gettext } = useGettext()
const { canShare } = useCanShare()
const { showMessage, showErrorMessage } = useMessages()
const { dispatchModal } = useModals()
const clientService = useClientService()
const sharesStore = useSharesStore()
const { deleteShare } = sharesStore
const { setSubspace, removeSubspace, isSubspaceRoot } = useSubspaces()

const resource = inject<Ref<Resource>>('resource')
const space = inject<Ref<SpaceResource>>('space')

const directShares = computed(() =>
  sharesStore.collaboratorShares.filter((s: CollaboratorShare) => !s.indirect)
)

const hasMembers = computed(() => directShares.value.length > 0)

const deleteMemberConfirm = (share: CollaboratorShare) => {
  dispatchModal({
    title: $gettext('Remove member'),
    confirmText: $gettext('Remove'),
    message: $gettext('Are you sure you want to remove this member?'),
    hasInput: false,
    onConfirm: async () => {
      try {
        await deleteShare({
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

// Auto-manage subspace marking based on member changes
watch(directShares, async (shares, oldShares) => {
  const r = unref(resource)
  const s = unref(space)
  if (!r || !s) return

  const hadMembers = (oldShares?.length ?? 0) > 0
  const hasNow = shares.length > 0

  if (hasNow && !hadMembers && !isSubspaceRoot(r.id)) {
    // First member added → mark as subspace
    try {
      await setSubspace(s, r.id)
    } catch (e) {
      console.error('Failed to mark folder as subspace:', e)
    }
  } else if (!hasNow && hadMembers && isSubspaceRoot(r.id)) {
    // Last member removed → remove subspace marking
    try {
      await removeSubspace(s, r.id)
    } catch (e) {
      console.error('Failed to remove subspace marking:', e)
    }
  }
})
</script>
