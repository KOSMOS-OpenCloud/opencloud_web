import { RouteRecordRaw, Router } from 'vue-router'
import clone from 'lodash-es/clone'
import { RuntimeApi } from './types'
import {
  ApiError,
  Extension,
  ExtensionPoint,
  ExtensionRegistry,
  SidebarNavExtension,
  useUserStore
} from '@opencloud-eu/web-pkg'
import { isMemberOfAppGroups } from '../helpers/appGroups'
import { isObject, isArray } from 'lodash-es'
import { computed } from 'vue'
import { AppNavigationItem, ApplicationMount } from '@opencloud-eu/web-pkg'

/**
 * kosmos: path below which a mount announces the routes of the app, e.g. `calendar/todos`
 *
 * @param applicationId
 * @param mount
 */
export const getMountPath = (applicationId: string, mount: ApplicationMount): string => {
  return `${mount.app}/${mount.path || applicationId.split('/').pop()}`
}

/**
 * inject application specific routes into runtime
 *
 * @param applicationId
 * @param router
 * @param routes
 * @param mounts
 * @param groups
 */
const announceRoutes = (
  applicationId: string,
  router: Router,
  routes: RouteRecordRaw[],
  mounts: ApplicationMount[] = [],
  groups: string[] = []
): void => {
  if (!isArray(routes)) {
    throw new ApiError("routes can't be blank")
  }

  announceRoutesBelow(applicationId, router, routes, groups)
  // kosmos: the same routes once more below every mount, route names carry the mount path
  mounts.forEach((mount) => {
    announceRoutesBelow(getMountPath(applicationId, mount), router, routes, groups)
  })
}

const announceRoutesBelow = (
  applicationId: string,
  router: Router,
  routes: RouteRecordRaw[],
  groups: string[] = []
): void => {
  const namespaceRouteName = (name: string) => {
    return name.startsWith(`${applicationId}-`) ? name : `${applicationId}-${name}`
  }
  routes
    .map((applicationRoute) => {
      if (!isObject(applicationRoute)) {
        throw new ApiError("route can't be blank", applicationRoute)
      }

      const route = clone(applicationRoute)
      if (route.name) {
        route.name =
          applicationId === route.name ? route.name : namespaceRouteName(String(route.name))
      }

      route.path = `/${encodeURI(applicationId)}${route.path}`

      // kosmos: an app limited to groups carries them on every route, `setupAppGroupsGuard` keeps others out
      if (groups.length) {
        route.meta = { ...route.meta, requiredGroups: groups }
      }

      if (route.children) {
        route.children = route.children.map((childRoute) => {
          if (!isObject(applicationRoute)) {
            throw new ApiError("route children can't be blank", applicationRoute, childRoute)
          }

          const r = clone(childRoute)
          if (childRoute.name) {
            r.name = namespaceRouteName(String(childRoute.name))
          }
          return r
        })
      }

      return route
    })
    .forEach((route) => {
      router.addRoute(route)
    })
}

/**
 * inject application specific navigation items into runtime
 *
 * @param applicationId
 * @param extensionRegistry
 * @param navigationItems
 * @param isApplicationAllowed
 */
const announceNavigationItems = (
  applicationId: string,
  extensionRegistry: ExtensionRegistry,
  navigationItems: AppNavigationItem[],
  isApplicationAllowed: () => boolean = () => true
): void => {
  if (!isObject(navigationItems)) {
    throw new ApiError("navigationItems can't be blank")
  }

  const navExtensionPoint = {
    id: `app.${applicationId}.navItems`,
    extensionType: 'sidebarNav',
    multiple: true
  }
  const extensionPoints = computed<ExtensionPoint<Extension>[]>(() => [navExtensionPoint])
  extensionRegistry.registerExtensionPoints(extensionPoints)

  const navExtensions = navigationItems.map((navItem) => ({
    id: `app.${applicationId}.${navItem.name}`,
    type: 'sidebarNav',
    navItem,
    extensionPointIds: [navExtensionPoint.id]
  })) as SidebarNavExtension[]

  extensionRegistry.registerExtensions(
    computed(() => (isApplicationAllowed() ? navExtensions : []))
  )
}

/**
 * kosmos: inject the main menu entries of the mounts into the primary apps
 *
 * @param applicationId
 * @param extensionRegistry
 * @param mounts
 * @param isApplicationAllowed
 */
const announceMounts = (
  applicationId: string,
  extensionRegistry: ExtensionRegistry,
  mounts: ApplicationMount[],
  isApplicationAllowed: () => boolean = () => true
): void => {
  const navExtensions = mounts
    .filter((mount) => isObject(mount.navItem))
    .map((mount) => ({
      // must not start with `app.<mount.app>.`, those ids mark the own items of the primary app
      id: `mount.${mount.app}.${applicationId}`,
      type: 'sidebarNav',
      navItem: { ...mount.navItem, route: { path: `/${getMountPath(applicationId, mount)}` } },
      extensionPointIds: [`app.${mount.app}.navItems`]
    })) as SidebarNavExtension[]

  if (navExtensions.length) {
    extensionRegistry.registerExtensions(
      computed(() => (isApplicationAllowed() ? navExtensions : []))
    )
  }
}

/**
 * exposed runtime api, this wraps all available api actions in a closure and provides application
 * specific data to the implementations.
 *
 * each application get its own provisioned api!
 */
export const buildRuntimeApi = ({
  applicationName,
  applicationId,
  router,
  extensionRegistry,
  mounts = [],
  groups = []
}: {
  applicationName: string
  applicationId: string
  router: Router
  extensionRegistry: ExtensionRegistry
  mounts?: ApplicationMount[]
  /** kosmos: display names of the groups whose members may use the app, empty means every user */
  groups?: string[]
}): RuntimeApi => {
  if (!applicationName) {
    throw new ApiError("applicationName can't be blank")
  }

  if (!applicationId) {
    throw new ApiError("applicationId can't be blank")
  }

  // kosmos: read inside the computed lists of the registry, so the entries follow login and logout
  const isApplicationAllowed = () => isMemberOfAppGroups(useUserStore().user, groups)

  return {
    announceRoutes: (routes: RouteRecordRaw[]): void =>
      announceRoutes(applicationId, router, routes, mounts, groups),
    announceNavigationItems: (navigationItems: AppNavigationItem[]): void =>
      announceNavigationItems(
        applicationId,
        extensionRegistry,
        navigationItems,
        isApplicationAllowed
      ),
    announceMounts: (): void =>
      announceMounts(applicationId, extensionRegistry, mounts, isApplicationAllowed)
  }
}
