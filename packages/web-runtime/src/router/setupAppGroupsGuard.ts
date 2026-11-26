import { Router } from 'vue-router'
import { useUserStore, WebRouteMeta } from '@opencloud-eu/web-pkg'
import { isMemberOfAppGroups } from '../helpers/appGroups'
import { routeNames } from './names'

/**
 * kosmos: keeps users out of the routes of an app that is limited to groups they are not a member of.
 * The runtime writes the groups of the app into the meta of its routes (`requiredGroups`).
 *
 * Runs after `setupAuthGuard`: routes that need a user have a loaded user here. Without a user nobody
 * is a member, so a route with groups stays closed for anonymous and public link contexts as well.
 */
export const setupAppGroupsGuard = (router: Router) => {
  router.beforeEach((to) => {
    const requiredGroups = (to.meta as WebRouteMeta)?.requiredGroups
    if (!requiredGroups?.length) {
      return true
    }

    const userStore = useUserStore()
    if (isMemberOfAppGroups(userStore.user, requiredGroups)) {
      return true
    }

    return { name: routeNames.appAccessDenied }
  })
}
