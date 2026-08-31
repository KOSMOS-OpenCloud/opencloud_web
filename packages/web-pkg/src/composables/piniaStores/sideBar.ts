import { defineStore } from 'pinia'
import { computed, nextTick, ref, unref, watch } from 'vue'
import { useEmbedMode } from '../embedMode'
import { useAppModeStore } from './appMode'
import { useIsMobile } from '@opencloud-eu/design-system/composables'

const readFromStorage = (key: string, defaultValue: boolean): boolean => {
  try {
    const raw = window.localStorage.getItem(key)
    return raw === null ? defaultValue : JSON.parse(raw)
  } catch {
    return defaultValue
  }
}

const writeToStorage = (key: string, value: boolean) => {
  window.localStorage.setItem(key, JSON.stringify(value))
}

export const useSideBar = defineStore('sideBar', () => {
  const { isEnabled: isEmbedModeEnabled } = useEmbedMode()
  const appModeStore = useAppModeStore()
  const { isMobile } = useIsMobile()

  const sideBarActivePanel = ref<string | null>(null)

  // Normal refs, synced with storage via explicit read/write
  const isSideBarOpenRef = ref(readFromStorage('oc_sideBarOpen', false))
  const sideBarIsExpandedRef = ref(readFromStorage('oc_sideBarIsExpanded', false))

  const isSideBarOpen = computed(() => {
    if (appModeStore.isEnabled) return false
    return unref(isSideBarOpenRef)
  })

  const sideBarIsExpanded = computed(() => unref(sideBarIsExpandedRef))

  const toggleSideBarExpanded = () => {
    sideBarIsExpandedRef.value = !unref(sideBarIsExpandedRef)
    writeToStorage('oc_sideBarIsExpanded', unref(sideBarIsExpandedRef))
  }

  const focusSidebar = async () => {
    await nextTick()
    const appSideBar = document.getElementById('app-sidebar')
    if (!appSideBar) {
      return
    }
    appSideBar.focus()
  }

  const toggleSideBar = () => {
    isSideBarOpenRef.value = !unref(isSideBarOpenRef)
    writeToStorage('oc_sideBarOpen', unref(isSideBarOpenRef))
    if (unref(isSideBarOpenRef)) {
      focusSidebar()
    }
  }
  const closeSideBar = () => {
    isSideBarOpenRef.value = false
    writeToStorage('oc_sideBarOpen', false)
    sideBarActivePanel.value = null
  }
  const openSideBar = () => {
    isSideBarOpenRef.value = true
    writeToStorage('oc_sideBarOpen', true)
    sideBarActivePanel.value = null
    focusSidebar()
  }
  const openSideBarPanel = (panelName: string) => {
    isSideBarOpenRef.value = true
    writeToStorage('oc_sideBarOpen', true)
    sideBarActivePanel.value = panelName
    focusSidebar()
  }
  const setActiveSideBarPanel = (panelName: string) => {
    sideBarActivePanel.value = panelName
  }

  const onInitialLoad = () => {
    if (unref(isMobile)) {
      // close sidebar on mobile devices on initial load because it's a bottom drawer
      isSideBarOpenRef.value = false
      writeToStorage('oc_sideBarOpen', false)
    }
  }

  return {
    isSideBarOpen,
    sideBarActivePanel,
    sideBarIsExpanded,
    toggleSideBarExpanded,
    focusSidebar,
    onInitialLoad,
    toggleSideBar,
    closeSideBar,
    openSideBar,
    openSideBarPanel,
    setActiveSideBarPanel
  }
})

export type SideBarStore = ReturnType<typeof useSideBar>
