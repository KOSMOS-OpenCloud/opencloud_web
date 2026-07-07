import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

interface AppModeConfig {
  spaceId: string
  spaceName: string
  driveAlias: string
  driveType: string
  name: string
  icon?: string
  color?: string
  menu?: {
    label: string
    icon?: string
    path?: string
    url?: string
    children?: { label: string; icon?: string; path?: string; url?: string }[]
  }[]
}

export const useAppModeStore = defineStore('appMode', () => {
  const enabled = ref(false)
  const config = ref<AppModeConfig | null>(null)
  const spaceAlias = ref('')

  const isEnabled = computed(() => enabled.value)

  function enable(appConfig: AppModeConfig, alias: string) {
    config.value = appConfig
    spaceAlias.value = alias
    enabled.value = true
  }

  function disable() {
    enabled.value = false
    config.value = null
    spaceAlias.value = ''
  }

  function checkRoute(path: string) {
    // Auto-disable when navigating away from the app mode space
    if (enabled.value && spaceAlias.value && !path.includes(spaceAlias.value)) {
      disable()
    }
  }

  return {
    isEnabled,
    enabled,
    config,
    spaceAlias,
    enable,
    disable,
    checkRoute
  }
})
