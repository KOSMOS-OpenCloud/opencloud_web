<template>
  <!-- Widgets von Apps (Extension-Point app.runtime.header.dock): auf dem Mobile im Dock unter der Topbar
       (#oc-topbar-dock in layouts/Application.vue), sonst an dieser Stelle in der Topbar -->
  <teleport :to="dockTarget" :disabled="!dockTarget">
    <div class="oc-topbar-dock-widgets" :class="isMobile ? 'order-3 flex flex-col min-w-0' : 'contents'">
      <custom-component-target :extension-point="topBarDockExtensionPoint" />
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, unref } from 'vue'
import { CustomComponentTarget } from '@opencloud-eu/web-pkg'
import { useIsMobile } from '@opencloud-eu/design-system/composables'
import { topBarDockExtensionPoint } from '../../extensionPoints'

const { isMobile } = useIsMobile()
// Das Dock steht erst nach dem Mounten im DOM (kein `defer` am Teleport, siehe SearchBar.vue in web-app-search)
const isMounted = ref(false)
onMounted(() => (isMounted.value = true))
const dockTarget = computed(() => (unref(isMobile) && unref(isMounted) ? '#oc-topbar-dock' : null))
</script>
