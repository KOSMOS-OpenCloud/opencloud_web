import { defineStore } from 'pinia'
import { ref, unref, watch } from 'vue'
import { Extension, ExtensionPoint } from './types'
import { useLocalStorage } from '@vueuse/core'
import { useClientService } from '../../clientService'

export interface ExtensionPreferenceItem {
  extensionPointId: string
  selectedExtensionIds: string[]
}

const BUNDLE_NAME = 'extension-preferences'
const SETTING_NAME = 'extension-preferences'

export const useExtensionPreferencesStore = defineStore('extensionPreferences', () => {
  // localStorage as fast cache, server as source of truth
  const extensionPreferences = useLocalStorage<Record<string, ExtensionPreferenceItem>>(
    'extensionPreferences',
    {}
  )
  const serverLoaded = ref(false)
  let bundleId: string | undefined
  let settingId: string | undefined
  let valueId: string | undefined

  // Load from Settings API on init
  async function loadFromServer() {
    try {
      const clientService = useClientService()
      const http = clientService.httpAuthenticated

      // Find bundle and setting IDs
      const { data: bundlesData } = await http.post<{ bundles: any[] }>(
        '/api/v0/settings/bundles-list',
        {}
      )
      const bundle = bundlesData.bundles?.find((b: any) => b.name === BUNDLE_NAME)
      if (!bundle) return // Server doesn't support extension-preferences bundle yet

      bundleId = bundle.id
      const setting = bundle.settings?.find((s: any) => s.name === SETTING_NAME)
      if (!setting) return
      settingId = setting.id

      // Load current values
      const { data: valuesData } = await http.post<{ values: any[] }>(
        '/api/v0/settings/values-list',
        { account_uuid: 'me' }
      )
      const val = valuesData.values?.find(
        (v: any) => v.identifier?.setting === SETTING_NAME
      )
      if (val?.value?.stringValue) {
        valueId = val.value.id
        const parsed = JSON.parse(val.value.stringValue)
        extensionPreferences.value = parsed
      }
      serverLoaded.value = true
    } catch (e) {
      // Settings API not available — fall back to localStorage silently
      console.debug('[ExtensionPreferences] Server load failed, using localStorage', e)
    }
  }

  async function saveToServer() {
    if (!bundleId || !settingId) return
    try {
      const clientService = useClientService()
      const json = JSON.stringify(unref(extensionPreferences))
      const { data } = await clientService.httpAuthenticated.post<{ value: any }>(
        '/api/v0/settings/values-save',
        {
          value: {
            accountUuid: 'me',
            bundleId,
            settingId,
            resource: { type: 'TYPE_USER' },
            stringValue: json,
            ...(valueId && { id: valueId })
          }
        }
      )
      if (data.value?.id) {
        valueId = data.value.id
      }
    } catch (e) {
      console.error('[ExtensionPreferences] Server save failed', e)
    }
  }

  // Load from server (non-blocking)
  loadFromServer()

  const getExtensionPreference = (
    extensionPointId: string,
    defaultExtensionIds: string[]
  ): ExtensionPreferenceItem => {
    const extensionPreference = extensionPreferences.value[extensionPointId]
    if (extensionPreference) {
      return extensionPreference
    }
    return {
      extensionPointId,
      selectedExtensionIds: defaultExtensionIds
    }
  }
  const extractDefaultExtensionIds = (
    extensionPoint: ExtensionPoint<Extension>,
    extensions: Extension[]
  ): string[] => {
    if (extensionPoint.multiple) {
      return extensions.map((extension) => extension.id)
    }
    if (extensionPoint.defaultExtensionId) {
      return [extensionPoint.defaultExtensionId]
    }
    return []
  }
  const setSelectedExtensionIds = (extensionPointId: string, extensionIds: string[]) => {
    if (!Object.hasOwn(unref(extensionPreferences), extensionPointId)) {
      extensionPreferences.value[extensionPointId] = {
        extensionPointId,
        selectedExtensionIds: extensionIds
      }
    } else {
      extensionPreferences.value[extensionPointId].selectedExtensionIds = extensionIds
    }
    saveToServer()
  }

  return {
    extensionPreferences,
    extractDefaultExtensionIds,
    getExtensionPreference,
    setSelectedExtensionIds
  }
})

export type ExtensionPreferencesStore = ReturnType<typeof useExtensionPreferencesStore>
