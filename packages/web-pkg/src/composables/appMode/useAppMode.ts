import { watch } from 'vue'
import { useRouter } from '../router'
import { useAppModeStore } from '../piniaStores/appMode'

export const useAppMode = () => {
  const store = useAppModeStore()
  const router = useRouter()

  // Watch route changes for auto-disable when leaving the app space
  watch(() => router.currentRoute.value.path, (path) => {
    store.checkRoute(path)
  })

  return {
    isEnabled: store.isEnabled,
    enable: store.enable,
    disable: store.disable
  }
}
