import { useClientService } from '@opencloud-eu/web-pkg'

/**
 * OpenCore extension: per-user authentication directory.
 *
 * idm stays the directory for all users; only the password check can be
 * delegated per user to an external directory (identity_manager=directories).
 * These endpoints are an OpenCore addition and are not part of the generated
 * LibreGraph client, so they are called over the raw authenticated HTTP client.
 * See opendock/OPENCORE_DIRECTORY.md.
 *
 * The reserved value "internal" means the built-in idm.
 */
export const INTERNAL_AUTH_DIRECTORY = 'internal'

export type AuthDirectory = {
  name: string
  label: string
}

// A cache-busting query parameter: browsers otherwise serve stale GET responses
// even with no-store headers.
function noCache(url: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`
}

export function useAuthDirectory() {
  const clientService = useClientService()

  // listAuthDirectories returns the selectable auth sources: the built-in
  // "internal" first, then every configured external directory.
  async function listAuthDirectories(): Promise<AuthDirectory[]> {
    const { data } = await clientService.httpAuthenticated.get<{ value: AuthDirectory[] }>(
      noCache('/graph/v1.0/extensions/opencore/authDirectories')
    )
    return data?.value || []
  }

  // getUserAuthDirectory returns the auth directory assigned to a user.
  // "internal" means the built-in idm.
  async function getUserAuthDirectory(userId: string): Promise<string> {
    const { data } = await clientService.httpAuthenticated.get<{ authDirectory: string }>(
      noCache(`/graph/v1.0/users/${encodeURIComponent(userId)}/authDirectory`)
    )
    return data?.authDirectory || INTERNAL_AUTH_DIRECTORY
  }

  // setUserAuthDirectory assigns the auth directory of a user. "internal" stores
  // the user as internal (idm).
  async function setUserAuthDirectory(userId: string, directory: string): Promise<void> {
    await clientService.httpAuthenticated.put(
      `/graph/v1.0/users/${encodeURIComponent(userId)}/authDirectory`,
      { authDirectory: directory || INTERNAL_AUTH_DIRECTORY }
    )
  }

  // lookupUser reports whether a login exists in an external directory. Used
  // before assigning a user to it: the OpenCore login must equal the directory's
  // uid (E9). Only existence is returned, never any attribute value.
  async function lookupUser(directory: string, login: string): Promise<boolean> {
    const { data } = await clientService.httpAuthenticated.get<{ exists: boolean }>(
      noCache(
        `/graph/v1.0/extensions/opencore/authDirectories/${encodeURIComponent(
          directory
        )}/users/${encodeURIComponent(login)}`
      )
    )
    return !!data?.exists
  }

  return {
    listAuthDirectories,
    getUserAuthDirectory,
    setUserAuthDirectory,
    lookupUser
  }
}
