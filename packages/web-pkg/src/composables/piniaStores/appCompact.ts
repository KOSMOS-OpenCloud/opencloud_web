import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// Latch from URL immediately, before any Vue component mounts
const initialCompact = new URLSearchParams(window.location.search).get('appCompact') === 'true'

export const useAppCompactStore = defineStore('appCompact', () => {
  const enabled = ref(initialCompact)

  const isEnabled = computed(() => enabled.value)

  function enable() {
    enabled.value = true
  }

  function disable() {
    enabled.value = false
  }

  return {
    isEnabled,
    enabled,
    enable,
    disable
  }
})
