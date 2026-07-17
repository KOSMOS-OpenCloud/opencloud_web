<template>
  <div id="oc-subspace-members" class="px-2 py-2">
    <invite-collaborator-form
      v-if="canShare({ resource, space })"
      key="subspace-collaborator"
      :label="$gettext('Share with people')"
      :save-button-label="$gettext('Add')"
      :resource="resource"
      class="mb-2"
    />
    <p v-if="!hasMembers" class="text-sm text-role-on-surface-variant">
      {{
        $gettext(
          'No subspace members yet. Add members to restrict access to this folder.'
        )
      }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, unref, watch, Ref } from 'vue'
import { SpaceResource, Resource } from '@opencloud-eu/web-client'
import {
  useCanShare,
  useSharesStore,
  useSubspaces
} from '@opencloud-eu/web-pkg'
import InviteCollaboratorForm from './Collaborators/InviteCollaborator/InviteCollaboratorForm.vue'

const { canShare } = useCanShare()
const sharesStore = useSharesStore()
const { setSubspace, removeSubspace, isSubspaceRoot } = useSubspaces()

const resource = inject<Ref<Resource>>('resource')
const space = inject<Ref<SpaceResource>>('space')

const directShares = computed(() =>
  sharesStore.collaboratorShares.filter((s) => !s.indirect)
)

const hasMembers = computed(() => directShares.value.length > 0)

// Auto-manage subspace marking: mark on first member, unmark on last removal
watch(directShares, async (shares, oldShares) => {
  const r = unref(resource)
  const s = unref(space)
  if (!r || !s) return

  const hadMembers = (oldShares?.length ?? 0) > 0
  const hasNow = shares.length > 0

  if (hasNow && !hadMembers && !isSubspaceRoot(r.id)) {
    try {
      await setSubspace(s, r.id)
    } catch (e) {
      console.error('Failed to mark folder as subspace:', e)
    }
  } else if (!hasNow && hadMembers && isSubspaceRoot(r.id)) {
    try {
      await removeSubspace(s, r.id)
    } catch (e) {
      console.error('Failed to remove subspace marking:', e)
    }
  }
})
</script>
