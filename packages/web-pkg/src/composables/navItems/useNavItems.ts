import { RouteLocationAsRelativeTyped, useRoute, useRouter } from 'vue-router'
import { orderBy } from 'lodash-es'
import { useGettext } from 'vue3-gettext'
import { computed, unref } from 'vue'
import {
  ExtensionRegistry,
  SidebarNavExtension,
  useAuthStore,
  useExtensionRegistry
} from '../piniaStores'
import { useActiveApp } from '../router'
import { useEmbedMode } from '../embedMode'
import { AppNavigationItem } from '../../apps'

export interface NavItem extends Omit<AppNavigationItem, 'name'> {
  name: string
  active: boolean
}

export const getExtensionNavItems = ({
  extensionRegistry,
  appId,
  ownItemsOnly = false
}: {
  extensionRegistry: ExtensionRegistry
  appId: string
  ownItemsOnly?: boolean
}) =>
  extensionRegistry
    .requestExtensions<SidebarNavExtension>({
      id: `app.${appId}.navItems`,
      extensionType: 'sidebarNav'
    })
    // items announced by the app itself have the id app.<appId>.<name>, items of other apps
    // (e.g. dApps like Todos or Rooms in the files navigation) have their own ids
    .filter(({ id }) => !ownItemsOnly || id.startsWith(`app.${appId}.`))
    .map(({ navItem }) => navItem)
    .filter((n) => !Object.hasOwn(n, 'isVisible') || n.isVisible())

export const useNavItems = () => {
  const router = useRouter()
  const route = useRoute()
  const { $gettext } = useGettext()
  const authStore = useAuthStore()
  const activeApp = useActiveApp()
  const extensionRegistry = useExtensionRegistry()

  const { isEnabled: isEmbedModeEnabled } = useEmbedMode()

  const extensionNavItems = computed(() => {
    // pickers (embed mode) only navigate files, so items of other apps are hidden there
    return getExtensionNavItems({
      extensionRegistry,
      appId: unref(activeApp),
      ownItemsOnly: unref(isEmbedModeEnabled)
    })
  })

  const navItems = computed<NavItem[]>(() => {
    if (!authStore.userContextReady) {
      return []
    }

    const { href: currentHref } = router.resolve(unref(route))
    return orderBy(
      unref(extensionNavItems).map((item) => {
        let active = typeof item.isActive !== 'function' || item.isActive()

        if (active) {
          active = [item.route, ...(item.activeFor || [])].filter(Boolean).some((currentItem) => {
            try {
              const comparativeHref = router.resolve(
                currentItem as RouteLocationAsRelativeTyped
              ).href
              return currentHref.startsWith(comparativeHref)
            } catch (e) {
              console.error(e)
              return false
            }
          })
        }

        const name = typeof item.name === 'function' ? item.name() : item.name

        return {
          ...item,
          name: $gettext(name),
          active
        }
      }),
      ['priority', 'name']
    )
  })

  return { navItems }
}
