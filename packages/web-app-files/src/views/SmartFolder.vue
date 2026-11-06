<template>
  <div class="flex">
    <files-view-wrapper>
      <app-bar :view-modes="viewModes" :has-bulk-actions="true" :breadcrumbs="breadcrumbs" />
      <app-loading-spinner v-if="areResourcesLoading" />
      <template v-else>
        <no-content-message
          v-if="isEmpty"
          id="files-smart-folder-empty"
          img-src="/images/empty-states/empty-favorites.svg"
        >
          <template #message>
            <span v-text="$gettext('No files match this smart folder')" />
          </template>
          <template #callToAction>
            <span v-if="smartFolder" class="font-mono" v-text="smartFolder.query" />
          </template>
        </no-content-message>
        <component
          :is="folderView.component"
          v-else
          v-model:selected-ids="selectedResourcesIds"
          :are-paths-displayed="true"
          :resources="paginatedResources"
          :view-mode="viewMode"
          :header-position="fileListHeaderY"
          :sort-by="sortBy"
          :sort-dir="sortDir"
          :sort-fields="sortFields"
          :view-size="viewSize"
          v-bind="folderView.componentAttrs?.()"
          @file-click="triggerDefaultAction"
          @item-visible="loadPreview({ space: getMatchingSpace($event), resource: $event })"
          @sort="handleSort"
        >
          <template #quickActions="props">
            <quick-actions class="hidden sm:block" :item="props.resource" />
          </template>
          <template #contextMenu="{ resource }">
            <context-actions
              v-if="isResourceInSelection(resource)"
              :action-options="{ space: getMatchingSpace(resource), resources: selectedResources }"
            />
          </template>
          <template #footer>
            <pagination :pages="paginationPages" :current-page="paginationPage" />
            <list-info v-if="paginatedResources.length > 0" class="w-full my-2" />
          </template>
        </component>
      </template>
    </files-view-wrapper>
    <file-side-bar :space="selectedResourceSpace" />
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, unref, watch } from 'vue'
import { Resource } from '@opencloud-eu/web-client'
import {
  AppBar,
  AppLoadingSpinner,
  ContextActions,
  FileSideBar,
  NoContentMessage,
  Pagination,
  ResourceTable,
  createLocationCommon,
  useFileActions,
  useGetMatchingSpace,
  useLoadPreview,
  useRouteParam,
  useSmartFolders
} from '@opencloud-eu/web-pkg'
import QuickActions from '../components/FilesList/QuickActions.vue'
import ListInfo from '../components/FilesList/ListInfo.vue'
import FilesViewWrapper from '../components/FilesViewWrapper.vue'
import { useResourcesViewDefaults } from '../composables'
import { folderViewsSmartFolderExtensionPoint } from '../extensionPoints'
import { useGettext } from 'vue3-gettext'
import { v4 as uuidV4 } from 'uuid'

export default defineComponent({
  components: {
    FilesViewWrapper,
    AppBar,
    FileSideBar,
    ResourceTable,
    QuickActions,
    AppLoadingSpinner,
    Pagination,
    NoContentMessage,
    ListInfo,
    ContextActions
  },

  setup() {
    const { getMatchingSpace } = useGetMatchingSpace()
    const { $gettext } = useGettext()
    const { smartFolders, refreshSmartFolders } = useSmartFolders()
    const smartFolderId = useRouteParam('smartFolderId')

    const resourcesViewDefaults = useResourcesViewDefaults<Resource, any, any[]>({
      folderViewExtensionPoint: folderViewsSmartFolderExtensionPoint
    })
    const { viewMode, loadResourcesTask } = resourcesViewDefaults
    const { loadPreview } = useLoadPreview(viewMode)

    const smartFolder = computed(() =>
      unref(smartFolders).find(({ id }) => id === unref(smartFolderId))
    )

    const breadcrumbs = computed(() => [
      {
        id: uuidV4(),
        text: $gettext('Smart folders'),
        to: createLocationCommon('files-common-smart-folders'),
        isStaticNav: true
      },
      {
        id: uuidV4(),
        text: unref(smartFolder)?.name || $gettext('Smart folder'),
        to: createLocationCommon('files-common-smart-folder', {
          params: { smartFolderId: unref(smartFolderId) }
        }),
        isStaticNav: true
      }
    ])

    watch(smartFolderId, () => {
      loadResourcesTask.perform()
    })

    return {
      ...useFileActions(),
      ...resourcesViewDefaults,
      getMatchingSpace,
      loadPreview,
      breadcrumbs,
      smartFolder,
      refreshSmartFolders
    }
  },

  computed: {
    isEmpty() {
      return this.paginatedResources.length < 1
    }
  },

  async created() {
    await Promise.all([this.refreshSmartFolders(), this.loadResourcesTask.perform()])
    this.scrollToResourceFromRoute(this.paginatedResources, 'files-app-bar')
  }
})
</script>
