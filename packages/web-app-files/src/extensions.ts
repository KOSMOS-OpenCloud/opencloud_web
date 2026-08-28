import {
  ApplicationInformation,
  CreateNewActionExtension,
  Extension,
  FloatingActionButtonExtension,
  isLocationPublicActive,
  isLocationSpacesActive,
  useCapabilityStore,
  useConfigStore,
  useExtensionRegistry,
  useResourcesStore,
  useRouter,
  useSearch,
  useSideBar,
  useSpaceActionsCreate,
  useFileActionsJobPipeline,
  useUserStore
} from '@opencloud-eu/web-pkg'
import { computed, markRaw, unref } from 'vue'
import { SDKSearch } from './search'
import { useSideBarPanels } from './composables/extensions/useFileSideBars'
import { useFolderViews } from './composables/extensions/useFolderViews'
import { useFolderVaultIndicator } from './composables/extensions/useFolderVaultIndicator'
import { useFileActions } from './composables/extensions/useFileActions'
import { useSpaceActions } from './composables/extensions/useSpaceActions'
import { useTrashActions } from './composables/extensions/useTrashActions'
import { useUploadActions } from './composables/extensions/useUploadActions'
import { urlJoin } from '@opencloud-eu/web-client'
import { useGettext } from 'vue3-gettext'
import { storeToRefs } from 'pinia'
import CreateOrUploadMenu from './components/CreateOrUploadMenu.vue'
import { APPID } from './appid'

export const extensions = (appInfo: ApplicationInformation) => {
  const capabilityStore = useCapabilityStore()
  const configStore = useConfigStore()
  const userStore = useUserStore()
  const resourcesStore = useResourcesStore()
  const { currentFolder } = storeToRefs(resourcesStore)
  const router = useRouter()
  const { search: searchFunction } = useSearch()
  const { $gettext } = useGettext()

  const { actions: createSpaceActions } = useSpaceActionsCreate()
  const createSpaceAction = computed(() => unref(createSpaceActions)[0])

  const fileActionExtensions = useFileActions()
  const spaceActionExtensions = useSpaceActions()
  const trashActionExtensions = useTrashActions()
  const uploadActionExtensions = useUploadActions()
  const folderViewExtensions = useFolderViews()
  const sideBarPanelExtensions = useSideBarPanels()
  const folderVaultIndicator = useFolderVaultIndicator()
  const { actions: jobPipelineActions } = useFileActionsJobPipeline()

  return computed<Extension[]>(() => [
    ...fileActionExtensions,
    // Job pipeline actions (dynamically loaded, reactive)
    ...unref(jobPipelineActions).map((action) => ({
      id: `com.github.opencloud-eu.web.files.context-action.job-${action.name}`,
      extensionPointIds: [
        'global.files.context-actions',
        'global.files.batch-actions'
      ],
      type: 'action' as const,
      action: {
        ...action,
        category: 'secondary'
      }
    })),
    ...spaceActionExtensions,
    ...trashActionExtensions,
    ...uploadActionExtensions,
    ...folderViewExtensions,
    ...sideBarPanelExtensions,
    folderVaultIndicator,
    {
      id: 'com.github.opencloud-eu.web.files.search',
      extensionPointIds: ['app.search.provider'],
      type: 'search',
      searchProvider: new SDKSearch(capabilityStore, searchFunction, configStore)
    },
    // Default create-new-actions (Spaces + Upload/Folder)
    {
      id: 'com.github.opencloud-eu.web.files.create-new-action.space',
      extensionPointIds: ['app.files.create-new-action'],
      type: 'createNewAction',
      isActive: () =>
        isLocationSpacesActive(router, 'files-spaces-projects') &&
        unref(createSpaceAction).isVisible(),
      handler: () => unref(createSpaceAction).handler(),
      mode: 'handler',
    } as CreateNewActionExtension,
    {
      id: 'com.github.opencloud-eu.web.files.create-new-action.upload',
      extensionPointIds: ['app.files.create-new-action'],
      type: 'createNewAction',
      isActive: () => !!unref(currentFolder)?.canUpload({ user: userStore.user }),
      handler: () => {},
      mode: 'drop',
      dropComponent: markRaw(CreateOrUploadMenu),
    } as CreateNewActionExtension,
    // FloatingActionButton driven by create-new-action registry
    (() => {
      const { requestExtensions } = useExtensionRegistry()
      const activeAction = () =>
        requestExtensions<CreateNewActionExtension>({
          id: 'app.files.create-new-action',
          extensionType: 'createNewAction'
        }).find((ext) => ext.isActive())
      // Chat-Panel offen → FAB ("Neu") deckt den Chat-Submit-Button auf
      // kleinen Bildschirmen ab → ausblenden, wenn genau dieses Panel aktiv ist.
      const sideBarStore = useSideBar()

      return {
        id: `com.github.opencloud-eu.web.${APPID}.floating-action-button`,
        extensionPointIds: ['app.files.floating-action-button'],
        type: 'floatingActionButton',
        icon: 'add',
        label: () => activeAction()?.label?.() || $gettext('New'),
        handler: () => activeAction()?.handler(),
        isDisabled: () => !activeAction(),
        mode: () => activeAction()?.mode || 'handler',
        isVisible: () =>
          !isLocationPublicActive(router, 'files-public-upload') &&
          !(unref(sideBarStore.isSideBarOpen) && sideBarStore.sideBarActivePanel === 'chat-with-file'),
        get dropComponent() { return activeAction()?.dropComponent || markRaw(CreateOrUploadMenu) },
      } as FloatingActionButtonExtension
    })(),
    ...((userStore.user && [
      {
        id: `app.${appInfo.id}.menuItem`,
        type: 'appMenuItem',
        label: () => appInfo.name,
        color: appInfo.color,
        icon: appInfo.icon,
        priority: 10,
        path: urlJoin(appInfo.id)
      }
    ]) ||
      [])
  ])
}
