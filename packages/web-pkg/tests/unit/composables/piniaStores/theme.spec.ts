import { useLocalStorage, usePreferredDark } from '@vueuse/core'
import { ThemeConfigType, useThemeStore } from '../../../../src/composables/piniaStores'
import { mockDeep } from 'vitest-mock-extended'
import { createPinia, setActivePinia } from 'pinia'
import { computed, ref } from 'vue'

vi.mock('@vueuse/core', () => {
  return { useLocalStorage: vi.fn(() => ref('')), usePreferredDark: vi.fn(() => ref(false)) }
})

describe('useThemeStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('initializeThemes', () => {
    it('sets availableThemes', () => {
      const themeConfig = mockDeep<ThemeConfigType>()
      themeConfig.clients.web.themes = [
        { label: 'light', designTokens: {}, isDark: false },
        { label: 'dark', designTokens: {}, isDark: true }
      ]

      const store = useThemeStore()
      store.initializeThemes(themeConfig)

      expect(store.availableThemes.length).toBe(themeConfig.clients.web.themes.length)
    })
    describe('currentTheme', () => {
      it.each([true, false])('gets set based on the OS setting', (isDark) => {
        vi.mocked(usePreferredDark).mockReturnValue(computed(() => isDark))
        vi.mocked(useLocalStorage).mockReturnValue(ref<string>(null))

        const themeConfig = mockDeep<ThemeConfigType>()
        themeConfig.clients.web.themes = [
          { label: 'light', designTokens: {}, isDark: false },
          { label: 'dark', designTokens: {}, isDark: true }
        ]
        themeConfig.clients.web.defaults = {}

        const store = useThemeStore()
        store.initializeThemes(themeConfig)

        expect(store.currentTheme.label).toEqual(
          themeConfig.clients.web.themes.find((t) => t.isDark === isDark).label
        )
      })
      it('falls back to the first theme if no match for the OS setting is found', () => {
        vi.mocked(usePreferredDark).mockReturnValue(computed(() => true))
        vi.mocked(useLocalStorage).mockReturnValue(ref<string>(null))

        const themeConfig = mockDeep<ThemeConfigType>()
        themeConfig.clients.web.themes = [{ label: 'light', designTokens: {}, isDark: false }]
        themeConfig.clients.web.defaults = {}

        const store = useThemeStore()
        store.initializeThemes(themeConfig)

        expect(store.currentTheme.label).toEqual('light')
      })
    })
  })

  describe('signature color', () => {
    it('sets and removes the custom property --oc-signature', () => {
      vi.mocked(useLocalStorage).mockReturnValue(ref<string>(null))
      const store = useThemeStore()

      store.setSignatureColor('#00aa55')
      expect(document.documentElement.style.getPropertyValue('--oc-signature')).toBe('#00aa55')

      store.setSignatureColor(null)
      expect(document.documentElement.style.getPropertyValue('--oc-signature')).toBe('')
    })
  })

  describe('background image', () => {
    it('sets and removes the custom property --oc-background', () => {
      URL.revokeObjectURL = vi.fn()
      const store = useThemeStore()

      store.setBackgroundImage('blob:first')
      expect(document.documentElement.style.getPropertyValue('--oc-background')).toBe(
        'url("blob:first")'
      )

      store.setBackgroundImage(null)
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:first')
      expect(document.documentElement.style.getPropertyValue('--oc-background')).toBe('')
    })
  })
})
