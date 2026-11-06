<template>
  <div class="flex">
    <files-view-wrapper>
      <app-bar :breadcrumbs="breadcrumbs" />
      <app-loading-spinner v-if="isLoading" />
      <no-content-message
        v-else-if="!smartFolders.length"
        id="files-smart-folders-empty"
        img-src="/images/empty-states/empty-favorites.svg"
      >
        <template #message>
          <span v-text="$gettext('No smart folders, yet')" />
        </template>
        <template #callToAction>
          <span
            v-text="$gettext('Save a search from the search results to show it here like a folder')"
          />
        </template>
      </no-content-message>
      <oc-table-simple v-else id="files-smart-folders-list" class="mx-4">
        <oc-table-head>
          <oc-table-tr>
            <oc-table-th>{{ $gettext('Name') }}</oc-table-th>
            <oc-table-th class="hidden md:table-cell">{{ $gettext('Search') }}</oc-table-th>
            <oc-table-th />
          </oc-table-tr>
        </oc-table-head>
        <oc-table-body>
          <oc-table-tr v-for="smartFolder in smartFolders" :key="smartFolder.id">
            <oc-table-td>
              <router-link :to="smartFolderLocation(smartFolder)" class="flex items-center gap-2">
                <oc-icon name="filter-3" fill-type="line" size="small" />
                <span v-text="smartFolder.name" />
              </router-link>
            </oc-table-td>
            <oc-table-td class="hidden md:table-cell font-mono">{{
              smartFolder.query
            }}</oc-table-td>
            <oc-table-td class="text-right">
              <span
                v-if="smartFolder.preset"
                class="text-role-on-surface-variant"
                v-text="$gettext('Preset')"
              />
              <oc-button
                v-else
                appearance="raw"
                :aria-label="$gettext('Delete smart folder')"
                @click="confirmRemove(smartFolder)"
              >
                <oc-icon name="delete-bin" fill-type="line" size="small" />
              </oc-button>
            </oc-table-td>
          </oc-table-tr>
        </oc-table-body>
      </oc-table-simple>
    </files-view-wrapper>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useGettext } from 'vue3-gettext'
import { v4 as uuidV4 } from 'uuid'
import {
  AppBar,
  AppLoadingSpinner,
  NoContentMessage,
  SmartFolder,
  createLocationCommon,
  useMessages,
  useModals,
  useSmartFolders
} from '@opencloud-eu/web-pkg'
import FilesViewWrapper from '../components/FilesViewWrapper.vue'

const { $gettext } = useGettext()
const { dispatchModal } = useModals()
const { showErrorMessage } = useMessages()
const { smartFolders, refreshSmartFolders, removeSmartFolder } = useSmartFolders()

const isLoading = ref(true)

const breadcrumbs = computed(() => [
  {
    id: uuidV4(),
    text: $gettext('Smart folders'),
    to: createLocationCommon('files-common-smart-folders'),
    isStaticNav: true
  }
])

function smartFolderLocation(smartFolder: SmartFolder) {
  return createLocationCommon('files-common-smart-folder', {
    params: { smartFolderId: smartFolder.id }
  })
}

function confirmRemove(smartFolder: SmartFolder) {
  dispatchModal({
    title: $gettext('Delete smart folder "%{name}"?', { name: smartFolder.name }),
    message: $gettext('Only the saved search is deleted, the files stay where they are.'),
    confirmText: $gettext('Delete'),
    onConfirm: async () => {
      try {
        await removeSmartFolder(smartFolder.id)
      } catch (error) {
        console.error(error)
        showErrorMessage({ title: $gettext('Failed to delete smart folder'), errors: [error] })
      }
    }
  })
}

onMounted(async () => {
  try {
    await refreshSmartFolders()
  } catch (error) {
    console.error(error)
    showErrorMessage({ title: $gettext('Failed to load smart folders'), errors: [error] })
  } finally {
    isLoading.value = false
  }
})
</script>
