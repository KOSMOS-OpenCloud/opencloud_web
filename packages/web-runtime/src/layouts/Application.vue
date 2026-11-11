<template>
  <div id="web-content" class="flex flex-col flex-nowrap h-dvh">
    <div id="global-progress-bar" class="w-full absolute top-0 z-100">
      <custom-component-target :extension-point="progressBarExtensionPoint" />
    </div>
    <div v-if="!appCompactStore.isEnabled" id="web-content-header" class="shrink basis-auto grow-0">
      <div v-if="isIE11" class="bg-role-surface-container text-center py-4">
        <p class="m-0" v-text="ieDeprecationWarning" />
      </div>
      <top-bar />
      <!-- Dock (kosmos 2026-11-11): auf dem Mobile teleportieren sich Suche und Audio-Player hierher, untereinander.
           Bewusst außerhalb von #oc-topbar: Themes (win11) setzen dessen Höhe fest, der Inhalt soll nachrutschen. -->
      <div id="oc-topbar-dock" class="flex flex-col min-w-0 px-2 sm:hidden" />
    </div>
    <div
      id="web-content-main"
      class="flex flex-col items-start justify-start grow shrink basis-auto overflow-y-hidden"
      :class="{ 'px-2 pb-2': !appCompactStore.isEnabled }"
    >
      <div
        class="app-container flex size-full overflow-hidden"
        :class="appCompactStore.isEnabled ? '' : 'bg-role-surface-container rounded-xl'"
      >
        <app-loading-spinner v-if="isLoading" />
        <template v-else>
          <sidebar-nav v-if="isSidebarVisible" :nav-items="navItems" />
          <app-floating-action-button />
          <router-view
            v-for="name in ['default', 'app', 'fullscreen']"
            :key="`router-view-${name}`"
            class="app-content border w-full bg-role-surface rounded-l-xl transition-all duration-350 ease-[cubic-bezier(0.34,0.11,0,1.12)]"
            :class="{ '[&_#app-sidebar]:hidden': globalSideBarVisible }"
            :name="name"
          />
          <!-- Globale rechte Seitenleiste (kosmos): nur auf Anforderung (oc:global-sidebar) und nur, wenn die App keine eigene zeigt -->
          <side-bar
            v-if="globalSideBarVisible"
            :available-panels="globalSideBarPanels"
            :panel-context="globalSideBarContext"
            :loading="false"
          />
        </template>
      </div>

      <div id="app-runtime-bottom-drawer" />
      <div id="mobile-right-sidebar" />
      <div id="app-runtime-footer" class="w-full" />
    </div>
    <div
      class="snackbars absolute inset-x-[20px] sm:left-auto bottom-[20px] z-[calc(var(--z-index-modal)+1)]"
    >
      <message-bar />
      <upload-info />
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  AppLoadingSpinner,
  CustomComponentExtension,
  CustomComponentTarget,
  FloatingActionButtonExtension,
  SideBar,
  useActiveApp,
  useExtensionRegistry,
  useSideBar
} from '@opencloud-eu/web-pkg'
import { useIsMobile } from '@opencloud-eu/design-system/composables'
import TopBar from '../components/Topbar/TopBar.vue'
import MessageBar from '../components/MessageBar.vue'
import SidebarNav from '../components/SidebarNav/SidebarNav.vue'
import UploadInfo from '../components/UploadInfo.vue'
import { useRouteMeta, useSpacesLoading, useNavItems, useAppModeStore, useAppCompactStore } from '@opencloud-eu/web-pkg'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, unref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useGettext } from 'vue3-gettext'
import { globalSideBarExtensionPoint, progressBarExtensionPoint } from '../extensionPoints'
import AppFloatingActionButton from '../components/AppFloatingActionButton.vue'

const { $gettext } = useGettext()
const { navItems } = useNavItems()
const { requestExtensions } = useExtensionRegistry()
const activeApp = useActiveApp()

const requiredAuthContext = useRouteMeta('authContext')
const { areSpacesLoading } = useSpacesLoading()
const isLoading = computed(() => {
  if (['anonymous', 'idp'].includes(unref(requiredAuthContext))) {
    return false
  }
  return unref(areSpacesLoading)
})

const { isTablet } = useIsMobile()

const hasFloatingActionButton = computed(() => {
  return !!requestExtensions<FloatingActionButtonExtension>({
    id: `app.${unref(activeApp)}.floating-action-button`,
    extensionType: 'floatingActionButton'
  }).filter(({ isVisible }) => !isVisible || isVisible()).length
})

const hasSidebarNavExtension = computed(() => {
  const mainExtensionPoint = {
    id: `app.${unref(activeApp)}.sidebar-nav.main`,
    extensionType: 'customComponent'
  }
  const bottomExtensionPoint = {
    id: `app.${unref(activeApp)}.sidebar-nav.bottom`,
    extensionType: 'customComponent'
  }
  return (
    requestExtensions<CustomComponentExtension>(mainExtensionPoint).length > 0 ||
    requestExtensions<CustomComponentExtension>(bottomExtensionPoint).length > 0
  )
})

const appModeStore = useAppModeStore()
const appCompactStore = useAppCompactStore()

// Latch from current URL — reliable regardless of router lifecycle
if (new URLSearchParams(window.location.search).get('appCompact') === 'true') {
  appCompactStore.enable()
}

const isSidebarVisible = computed(() => {
  if (appModeStore.isEnabled) return false
  return (
    !unref(isTablet) &&
    (unref(navItems).length || unref(hasFloatingActionButton) || unref(hasSidebarNavExtension))
  )
})

// Globale rechte Seitenleiste: Panels aus app.runtime.sidebar, geöffnet per Fenster-Ereignis (z. B. Quick-Menü „Chat“).
// In den Dateiansichten (Routen files-*, FileSideBar mit global.files.sidebar) öffnet nur das Panel; überall sonst rendert
// die Hülle ihre Seitenleiste und blendet eine App-eigene (#app-sidebar im router-view) so lange aus.
const sideBarStore = useSideBar()
const router = useRouter()
const globalSideBarRequested = ref(false)
const globalSideBarPanels = computed(() => requestExtensions(globalSideBarExtensionPoint).map((e) => e.panel))
const globalSideBarContext = { parent: null, items: [] } as any
const globalSideBarVisible = computed(
  () => unref(globalSideBarRequested) && unref(globalSideBarPanels).length > 0 && sideBarStore.isSideBarOpen
)
const onGlobalSideBar = async (event: Event) => {
  const panel = (event as CustomEvent<{ panel?: string }>).detail?.panel
  if (!panel) return
  // nur die echten Dateiansichten (Routen files-*) haben die FileSideBar mit global.files.sidebar; Apps unter /files/
  // wie Räume oder Todos haben eigene Seitenleisten ohne dieses Panel → dort übernimmt die Hülle
  if (!String(router.currentRoute.value.name || '').startsWith('files-')) globalSideBarRequested.value = true
  await nextTick()
  sideBarStore.openSideBarPanel(panel)
}
onMounted(() => window.addEventListener('oc:global-sidebar', onGlobalSideBar))
onBeforeUnmount(() => window.removeEventListener('oc:global-sidebar', onGlobalSideBar))
watch(() => router.currentRoute.value.path, () => { globalSideBarRequested.value = false })
watch(() => sideBarStore.isSideBarOpen, (open) => { if (!open) globalSideBarRequested.value = false })

const isIE11 = !!(window as any).MSInputMethodContext && !!(document as any).documentMode

const ieDeprecationWarning = computed(() =>
  $gettext(
    'Internet Explorer (your current browser) is not officially supported. For security reasons, please switch to another browser.'
  )
)

onMounted(async () => {
  await nextTick()
})
</script>
