<template>
  <div id="oc-subspace-members" class="px-2 py-2">
    <invite-collaborator-form
      v-if="canShare({ resource, space })"
      key="subspace-collaborator"
      :label="$gettext('Search for people or groups')"
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

// Mark the folder as subspace immediately when this panel is mounted.
// This ensures the SubspaceRootFilter will catch any shares created via
// the invite form. A subspace with zero grants has no effect on permissions.
const r = unref(resource)
const s = unref(space)
if (r && s && !isSubspaceRoot(r.id)) {
  setSubspace(s, r.id).catch((e: unknown) =>
    console.error('Failed to mark folder as subspace:', e)
  )
}

// When all shares are removed, remove the subspace marking
watch(directShares, async (shares, oldShares) => {
  const r = unref(resource)
  const s = unref(space)
  if (!r || !s) return

  const hadMembers = (oldShares?.length ?? 0) > 0
  if (shares.length === 0 && hadMembers && isSubspaceRoot(r.id)) {
    try {
      await removeSubspace(s, r.id)
    } catch (e) {
      console.error('Failed to remove subspace marking:', e)
    }
  }
})
</script>
