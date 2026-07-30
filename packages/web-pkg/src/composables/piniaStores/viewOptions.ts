import { defineStore } from 'pinia'
import { ref, type Component, markRaw } from 'vue'

export interface ViewOptionEntry {
  id: string
  component: Component
}

/**
 * Extensions register custom view-option entries (oc-switch, etc.)
 * that appear in the ViewOptions dropdown alongside built-in options.
 */
export const useViewOptionsStore = defineStore('viewOptions', () => {
  const entries = ref<ViewOptionEntry[]>([])

  function register(entry: ViewOptionEntry) {
    if (entries.value.some((e) => e.id === entry.id)) return
    entries.value.push({ ...entry, component: markRaw(entry.component) })
  }

  function unregister(id: string) {
    entries.value = entries.value.filter((e) => e.id !== id)
  }

  return { entries, register, unregister }
})
