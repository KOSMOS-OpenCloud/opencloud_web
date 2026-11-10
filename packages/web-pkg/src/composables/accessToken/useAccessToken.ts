import { useAuthStore } from '../piniaStores'
import { refreshAccessToken, secondsUntilExpiry } from '../../services/client/tokenRefresh'

/**
 * Gültiger Access-Token für Fälle, die nicht über `clientService.httpAuthenticated` laufen (fetch-Streams, Medien-URLs,
 * Web-Worker, XHR-Uploads). Erneuert vorher, wenn der Token in weniger als `minValiditySeconds` abläuft.
 * Apps kopieren nie `authStore.accessToken` und erneuern nie selbst (OPENCORE_SESSION.md §3.1).
 */
export function useAccessToken({ minValiditySeconds = 30 }: { minValiditySeconds?: number } = {}) {
  const authStore = useAuthStore()

  async function getAccessToken(): Promise<string | undefined> {
    const remaining = secondsUntilExpiry(authStore.accessToken)
    if (remaining !== undefined && remaining < minValiditySeconds) {
      try {
        await refreshAccessToken()
      } catch {
        // Erneuerung gescheitert: aktueller Token, der Aufrufer bekommt ggf. 401
      }
    }
    return authStore.accessToken
  }

  return { getAccessToken }
}
