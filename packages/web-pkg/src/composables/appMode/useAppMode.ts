import { computed, ref, watch } from 'vue'
import { useRouter } from '../router'

const appModeEnabled = ref(false)

export const useAppMode = () => {
  const router = useRouter()

  // Latch: once ?appMode=true is seen, stay in app mode until explicitly disabled
  watch(() => router.currentRoute.value.query.appMode, (val) => {
    if (val === 'true') appModeEnabled.value = true
  }, { immediate: true })

  const isEnabled = computed(() => appModeEnabled.value)

  function enable() {
    appModeEnabled.value = true
  }

  function disable() {
    appModeEnabled.value = false
  }

  return {
    isEnabled,
    enable,
    disable
  }
}
