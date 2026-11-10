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
  // pickers (embed mode) start with a closed sidebar and don't touch the stored state of the
  // regular files view, which shares the local storage (same origin)
  const embedSideBarOpenRef = ref(false)

  const isSideBarOpen = computed(() => {
    if (appModeStore.isEnabled) return false
    if (unref(isEmbedModeEnabled)) return unref(embedSideBarOpenRef)
    return unref(isSideBarOpenRef)
  })

  const setSideBarOpen = (isOpen: boolean) => {
    if (unref(isEmbedModeEnabled)) {
      embedSideBarOpenRef.value = isOpen
      return
    }
    isSideBarOpenRef.value = isOpen
    writeToStorage('oc_sideBarOpen', isOpen)
  }

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

  // Reset the double-width so the sidebar can be reopened at the normal width.
  const resetExpanded = () => {
    if (unref(sideBarIsExpandedRef)) {
      sideBarIsExpandedRef.value = false
      writeToStorage('oc_sideBarIsExpanded', false)
    }
  }
  const toggleSideBar = () => {
    setSideBarOpen(!unref(isSideBarOpen))
    if (unref(isSideBarOpen)) {
      focusSidebar()
    } else {
      resetExpanded()
    }
  }
  const closeSideBar = () => {
    setSideBarOpen(false)
    sideBarActivePanel.value = null
    resetExpanded()
  }
  const openSideBar = () => {
    setSideBarOpen(true)
    sideBarActivePanel.value = null
    focusSidebar()
  }
  const openSideBarPanel = (panelName: string) => {
    setSideBarOpen(true)
    sideBarActivePanel.value = panelName
    focusSidebar()
  }
  const setActiveSideBarPanel = (panelName: string) => {
    sideBarActivePanel.value = panelName
  }

  const onInitialLoad = () => {
    if (unref(isMobile)) {
      // close sidebar on mobile devices on initial load because it's a bottom drawer
      setSideBarOpen(false)
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
