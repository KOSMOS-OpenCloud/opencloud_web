<template>
  <Teleport to="#mobile-right-sidebar" :disabled="!isMobile">
    <component
      :is="isMobile ? 'oc-bottom-drawer' : 'div'"
      id="app-sidebar"
      tabindex="-1"
      v-bind="sidebarProps"
    >
      <side-bar-panels
        :loading="loading"
        :available-panels="availablePanels"
        :panel-context="panelContext"
        :active-panel="activePanel"
        @select-panel="setSidebarPanel"
        @close="closeSideBar"
        @close-panel="focusSidebar"
      >
        <template #body>
          <slot name="body" />
        </template>
        <template #rootHeader>
          <slot name="rootHeader" />
        </template>
        <template #subHeader>
          <slot name="subHeader" />
        </template>
      </side-bar-panels>
    </component>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onUnmounted, unref, useAttrs } from 'vue'
import { SideBarPanel, SideBarPanelContext } from './types'
import SideBarPanels from './SideBarPanels.vue'
import { useIsMobile } from '@opencloud-eu/design-system/composables'
import { useSideBar } from '../../composables'
import { storeToRefs } from 'pinia'

const { loading, availablePanels, panelContext } = defineProps<{
  loading: boolean
  availablePanels: SideBarPanel<unknown, unknown, unknown>[]
  panelContext: SideBarPanelContext<unknown, unknown, unknown>
}>()

const emit = defineEmits<{
  (e: 'selectPanel', panel: string): void
  (e: 'close'): void
}>()

defineSlots<{
  body: () => unknown
  rootHeader: () => unknown
  subHeader: () => unknown
}>()

defineOptions({ inheritAttrs: false })
const attrs = useAttrs()

const { isMobile } = useIsMobile()
const sidebarStore = useSideBar()
const { focusSidebar } = sidebarStore
const { sideBarActivePanel: activePanel, sideBarIsExpanded } = storeToRefs(sidebarStore)

const sidebarProps = computed(() => {
  if (unref(isMobile)) {
    // bottom drawer props for mobile
    return {
      ...unref(attrs),
      isFocusTrapActive: !loading,
      hasFullHeight: true,
      maxHeight: 'max-h-[80vh]',
      class: 'z-100',
      onClicked: onBottomDrawerClicked
    }
  }

  // Tailwind scans sources for literal class names. Build the arbitrary-width
  // classes from two fully-written strings (not a template literal) so both
  // w-[360px] and w-[720px] are detected and generated in the CSS bundle.
  const expanded = unref(sideBarIsExpanded)
  const widthClass = expanded ? 'w-[720px]' : 'w-[360px]'
  const minWidthClass = expanded ? 'min-w-[720px]' : 'min-w-[360px]'
  const classes = [
    'border-l',
    'focus:outline-0',
    'focus-visible:outline-0',
    widthClass,
    minWidthClass,
    'overflow-hidden',
    'relative',
    'focus:shadow-none',
    'focus-visible:shadow-none',
    ...(unref(attrs)?.class ? [unref(attrs).class] : [])
  ]
  if (loading) {
    classes.push('flex', 'justify-center', 'items-center')
  }
  return {
    ...unref(attrs),
    class: classes
  }
})

const onBottomDrawerClicked = (event: MouseEvent) => {
  if (!event.target) {
    return
  }

  const bottomDrawerOutsideClicked = event.target === event.currentTarget
  const linkClicked = event.target instanceof HTMLAnchorElement
  const actionPanelItemClicked = (event.target as HTMLElement).closest('ul.sidebar-actions-panel')
  if (bottomDrawerOutsideClicked || linkClicked || actionPanelItemClicked) {
    // in some scenarios we want to close the bottom drawer, e.g. when clicking outside or on a file action
    closeSideBar()
  }
}
const closeSideBar = () => {
  sidebarStore.closeSideBar()
  emit('close')
}
const setSidebarPanel = (panel: string) => {
  sidebarStore.openSideBarPanel(panel)
  emit('selectPanel', panel)
}

onUnmounted(() => {
  if (unref(isMobile)) {
    // in mobile, when the sidebar is unmounted, we assume a route change > close bottom drawer
    closeSideBar()
  }
})
</script>
