<template>
  <nav v-if="tiles.length" id="quick-menu" :aria-label="$gettext('Quick menu')" class="flex items-center">
    <oc-button
      id="_quickMenuButton"
      v-oc-tooltip="$gettext('Quick menu')"
      appearance="raw-inverse"
      color-role="chrome"
      :aria-label="$gettext('Quick menu')"
      no-hover
    >
      <oc-icon name="flashlight" class="flex" fill-type="fill" />
    </oc-button>
    <oc-drop
      :title="$gettext('Quick menu')"
      drop-id="quick-menu-dropdown"
      toggle="#_quickMenuButton"
      mode="click"
      padding-size="small"
      close-on-click
      class="w-xs"
    >
      <!-- grid like a phone's quick settings: 3 columns, at most 4 rows -->
      <ul class="quick-menu-grid grid grid-cols-3 gap-1 m-0 p-0 list-none">
        <li v-for="tile in tiles" :key="tile.id" class="flex">
          <!-- raw-inverse + surface = Schrift/Icon in on-surface, passt zu hellem und dunklem Theme
               (raw + surface wäre die Flächenfarbe selbst: unsichtbar, Nutzer 2026-11-08); wie ApplicationsMenu -->
          <oc-button
            :appearance="tile.isActive?.() ? 'filled' : 'raw-inverse'"
            :color-role="tile.isActive?.() ? 'secondaryContainer' : 'surface'"
            class="quick-menu-tile flex-1 flex-col gap-1 py-3 px-1 rounded-md"
            :data-test-id="tile.id"
            v-bind="attributesFor(tile)"
            v-on="eventsFor(tile)"
          >
            <oc-icon :name="tile.icon" :fill-type="tile.iconFillType || 'line'" size="large" />
            <span class="text-xs text-center leading-tight" v-text="tile.label()" />
          </oc-button>
        </li>
      </ul>
    </oc-drop>
  </nav>
</template>

<script lang="ts">
import { computed, defineComponent, unref } from 'vue'
import { useGettext } from 'vue3-gettext'
import { storeToRefs } from 'pinia'
import {
  QuickMenuItemExtension,
  useAuthStore,
  useExtensionRegistry,
  useThemeStore
} from '@opencloud-eu/web-pkg'
import { quickMenuExtensionPoint } from '../../extensionPoints'
import { routeNames } from '../../router/names'

// Quick menu: lightning button in the top bar that opens a grid of tiles (3 columns, max 12).
// Tiles come from apps via the extension point 'app.runtime.header.quick-menu'; the runtime adds
// the theme toggle (light ↔ dark variant of the current theme set) and the preferences page.
const MAX_TILES = 12

export default defineComponent({
  name: 'QuickMenu',
  setup() {
    const { $gettext } = useGettext()
    const extensionRegistry = useExtensionRegistry()
    const authStore = useAuthStore()
    const themeStore = useThemeStore()
    const { currentTheme, hasDarkVariant } = storeToRefs(themeStore)

    const builtInTiles = computed<QuickMenuItemExtension[]>(() => {
      const tiles: QuickMenuItemExtension[] = []
      if (unref(hasDarkVariant)) {
        tiles.push({
          id: 'com.github.opencloud-eu.web.runtime.quick-menu.theme',
          type: 'quickMenuItem',
          extensionPointIds: [quickMenuExtensionPoint.id],
          label: () => (unref(currentTheme)?.isDark ? $gettext('Light') : $gettext('Dark')),
          icon: unref(currentTheme)?.isDark ? 'sun' : 'moon',
          priority: 900,
          handler: () => themeStore.toggleDarkVariant()
        })
      }
      if (authStore.userContextReady) {
        tiles.push({
          id: 'com.github.opencloud-eu.web.runtime.quick-menu.preferences',
          type: 'quickMenuItem',
          extensionPointIds: [quickMenuExtensionPoint.id],
          label: () => $gettext('Preferences'),
          icon: 'settings-4',
          priority: 1000,
          // direkt zu Einstellungen → Präferenzen (Nutzer 2026-11-08), nicht zur Kontoübersicht
          path: `/${routeNames.account}/preferences`
        })
      }
      return tiles
    })

    const tiles = computed(() => {
      const fromApps = extensionRegistry
        .requestExtensions<QuickMenuItemExtension>(quickMenuExtensionPoint)
        .filter((tile) => !tile.isVisible || tile.isVisible())
      return [...fromApps, ...unref(builtInTiles)]
        .sort((a, b) => (a.priority || Number.MAX_SAFE_INTEGER) - (b.priority || Number.MAX_SAFE_INTEGER))
        .slice(0, MAX_TILES)
    })

    const attributesFor = (tile: QuickMenuItemExtension) => {
      if (tile.handler) {
        return { type: 'button' as const }
      }
      return { type: 'router-link' as const, to: tile.path }
    }
    const eventsFor = (tile: QuickMenuItemExtension) => {
      return tile.handler ? { click: tile.handler } : {}
    }

    return { tiles, attributesFor, eventsFor }
  }
})
</script>
