import { User } from '@opencloud-eu/web-client/graph/generated'

/**
 * kosmos: an app can be limited to the members of groups (`groups` in the app manifest or in apps.yaml,
 * delivered as `external_apps[].groups`). Without groups the app is open to every user. Group names are
 * display names and compared without case. This only steers the ui, the backend of an app checks on its own.
 *
 * @param user
 * @param groups
 */
export const isMemberOfAppGroups = (
  user: Pick<User, 'memberOf'> | null | undefined,
  groups?: string[]
): boolean => {
  const requiredGroupNames = (groups || [])
    .map((groupName) => groupName?.trim().toLowerCase())
    .filter(Boolean)
  if (!requiredGroupNames.length) {
    return true
  }

  const userGroupNames = (user?.memberOf || [])
    .map((group) => group.displayName?.trim().toLowerCase())
    .filter(Boolean)
  return requiredGroupNames.some((groupName) => userGroupNames.includes(groupName))
}
