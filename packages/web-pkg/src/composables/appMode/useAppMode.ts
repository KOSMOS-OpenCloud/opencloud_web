import { computed, ref } from 'vue'
import { useRouter } from '../router'

const appModeEnabled = ref(false)

export const useAppMode = () => {
  const router = useRouter()

  const isEnabled = computed(() => {
    return appModeEnabled.value || router.currentRoute.value.query.appMode === 'true'
  })

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
