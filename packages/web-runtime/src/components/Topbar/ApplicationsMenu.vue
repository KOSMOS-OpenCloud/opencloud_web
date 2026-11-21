<template>
  <nav id="applications-menu" :aria-label="$gettext('Main navigation')" class="flex items-center">
    <oc-button
      id="_appSwitcherButton"
      v-oc-tooltip="applicationSwitcherLabel"
      appearance="raw-inverse"
      color-role="chrome"
      class="oc-topbar-menu-burger"
      :aria-label="applicationSwitcherLabel"
      no-hover
    >
      <oc-icon name="apps-3" class="flex" fill-type="fill" />
    </oc-button>
    <oc-drop
      :title="$gettext('Applications')"
      drop-id="app-switcher-dropdown"
      toggle="#_appSwitcherButton"
      mode="click"
      padding-size="small"
      close-on-click
      class="w-xs"
      @show-drop="updateAppIcons"
    >
      <!-- kosmos: Einträge mit `group` stehen unter einer Überschrift mit dem Gruppennamen (nichts klappt auf),
           Einträge ohne Gruppe wie bisher in der Liste darüber -->
      <div
        v-for="(section, sectionIndex) in menuSections"
        :key="`apps-menu-section-${section.group ?? ''}`"
        class="block relative"
      >
        <h3
          v-if="section.group"
          :id="`apps-menu-group-${sectionIndex}`"
          class="applications-group-title m-0 px-3 pb-1 text-xs font-semibold uppercase text-role-on-surface-variant"
          :class="sectionIndex > 0 ? 'pt-3' : 'pt-1'"
          v-text="$gettext(section.group)"
        />
        <oc-list
          class="applications-list"
          :aria-labelledby="section.group ? `apps-menu-group-${sectionIndex}` : undefined"
        >
          <!-- kosmos: gleicher Innenabstand für den aktiven (filled) und die übrigen (raw) Einträge, sonst rückt
               der aktive Eintrag ein. Mit !, weil Themes gefüllten Knöpfen eigenen Abstand geben (aqua: 14px). -->
          <li v-for="(n, nid) in section.items" :key="`apps-menu-${sectionIndex}-${nid}`">
            <oc-button
              :key="n.url ? 'apps-menu-external-link' : 'apps-menu-internal-link'"
              :appearance="isMenuItemActive(n) ? 'filled' : 'raw-inverse'"
              :color-role="isMenuItemActive(n) ? 'secondaryContainer' : 'surface'"
              justify-content="left"
              gap-size="large"
              class="px-1.5!"
              :class="{ 'router-link-active': isMenuItemActive(n), active: isMenuItemActive(n) }"
              :data-test-id="n.id"
              v-bind="getAdditionalAttributes(n)"
              v-on="getAdditionalEventBindings(n)"
            >
              <oc-application-icon
                :key="`apps-menu-icon-${sectionIndex}-${nid}-${appIconKey}`"
                :icon="n.icon || 'link'"
                :color-primary="n.color"
              />
              <span v-text="$gettext(n.label())" />
            </oc-button>
          </li>
        </oc-list>
      </div>
    </oc-drop>
  </nav>
</template>

<script lang="ts">
import { defineComponent, PropType, ref, computed, unref, useTemplateRef } from 'vue'
import { OcDrop } from '@opencloud-eu/design-system/components'
import { useGettext } from 'vue3-gettext'
import { v4 as uuidV4 } from 'uuid'
import { AppMenuItemExtension, useRouter } from '@opencloud-eu/web-pkg'

export default defineComponent({
  props: {
    menuItems: {
      type: Array as PropType<AppMenuItemExtension[]>,
      required: false,
      default: (): AppMenuItemExtension[] => []
    }
  },
  setup(props) {
    const router = useRouter()
    const { $gettext } = useGettext()
    const appIconKey = ref('')

    const menu = useTemplateRef<typeof OcDrop>('menu')

    const activeRoutePath = computed(() => unref(router.currentRoute).path)
    const sortedMenuItems = computed(() => {
      return [...props.menuItems].sort(
        (a, b) => (a.priority || Number.MAX_SAFE_INTEGER) - (b.priority || Number.MAX_SAFE_INTEGER)
      )
    })

    // kosmos: first the items without a group, then one section per group. Groups keep the order of their
    // first item, so the lowest priority of a group decides where the group stands.
    const menuSections = computed(() => {
      const ungroupedItems: AppMenuItemExtension[] = []
      const groupedItems = new Map<string, AppMenuItemExtension[]>()
      for (const menuItem of unref(sortedMenuItems)) {
        const groupName = typeof menuItem.group === 'string' ? menuItem.group.trim() : ''
        if (!groupName) {
          ungroupedItems.push(menuItem)
          continue
        }
        if (!groupedItems.has(groupName)) {
          groupedItems.set(groupName, [])
        }
        groupedItems.get(groupName).push(menuItem)
      }
      const sections: { group: string | null; items: AppMenuItemExtension[] }[] = []
      if (ungroupedItems.length) {
        sections.push({ group: null, items: ungroupedItems })
      }
      groupedItems.forEach((items, group) => sections.push({ group, items }))
      return sections
    })

    const applicationSwitcherLabel = computed(() => {
      return $gettext('Application Switcher')
    })
    const updateAppIcons = () => {
      appIconKey.value = uuidV4().replaceAll('-', '')
    }

    const getAdditionalEventBindings = (item: AppMenuItemExtension) => {
      return item.handler ? { click: item.handler } : {}
    }
    const getAdditionalAttributes = (item: AppMenuItemExtension) => {
      let type: 'a' | 'button' | 'router-link'
      if (item.handler) {
        type = 'button'
      } else if (item.path) {
        type = 'router-link'
      } else {
        type = 'a'
      }

      return {
        type,
        ...(type === 'router-link' && { to: item.path }),
        ...(type === 'a' && { href: item.url, target: '_blank' as const })
      }
    }
    const isMenuItemActive = (item: AppMenuItemExtension) => {
      return unref(activeRoutePath)?.startsWith(item.path)
    }

    return {
      menu,
      sortedMenuItems,
      menuSections,
      appIconKey,
      updateAppIcons,
      applicationSwitcherLabel,
      getAdditionalAttributes,
      getAdditionalEventBindings,
      isMenuItemActive
    }
  }
})
</script>
