<template>
  <oc-button
    v-if="canSave"
    id="files-search-save-smart-folder"
    class="mr-2"
    appearance="raw"
    size="small"
    @click="openSaveDialog"
  >
    <oc-icon name="filter-3" fill-type="line" size="small" />
    <span v-text="$gettext('Save as smart folder')" />
  </oc-button>
</template>

<script setup lang="ts">
import { computed, unref } from 'vue'
import { storeToRefs } from 'pinia'
import { useGettext } from 'vue3-gettext'
import {
  createLocationCommon,
  isWildcardOnlyQuery,
  useMessages,
  useModals,
  useRouter,
  useSmartFolders,
  useSpacesStore
} from '@opencloud-eu/web-pkg'

const props = defineProps<{
  /** Builds the KQL query of the current search (same as the result list). */
  buildQuery: () => string
  /** Suggested name, usually the search term. */
  suggestedName?: string
}>()

const { $gettext } = useGettext()
const router = useRouter()
const { dispatchModal } = useModals()
const { showMessage, showErrorMessage } = useMessages()
const { addSmartFolder } = useSmartFolders()
const { personalSpace } = storeToRefs(useSpacesStore())

// Personal smart folders are stored in the personal space
const canSave = computed(() => !!unref(personalSpace))

function openSaveDialog() {
  const query = props.buildQuery()
  if (!query || isWildcardOnlyQuery(query)) {
    showErrorMessage({ title: $gettext('This search cannot be saved as smart folder') })
    return
  }
  dispatchModal({
    title: $gettext('Save as smart folder'),
    confirmText: $gettext('Save'),
    hasInput: true,
    inputLabel: $gettext('Name'),
    inputValue: props.suggestedName || '',
    onInput: (name: string, setError: (error: string) => void) => {
      setError(name.trim() ? null : $gettext('Name must not be empty'))
    },
    onConfirm: async (name: string) => {
      try {
        const smartFolder = await addSmartFolder(name, query)
        showMessage({ title: $gettext('Smart folder "%{name}" saved', { name: smartFolder.name }) })
        await router.push(
          createLocationCommon('files-common-smart-folder', {
            params: { smartFolderId: smartFolder.id }
          })
        )
      } catch (error) {
        console.error(error)
        showErrorMessage({ title: $gettext('Failed to save smart folder'), errors: [error] })
      }
    }
  })
}
</script>
