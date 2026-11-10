import type { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios'

/**
 * Zentrale Token-Erneuerung (kosmos, OPENCORE_SESSION.md §3.1).
 *
 * Die Laufzeit (web-runtime) registriert die eigentliche Erneuerung (`signinSilent`). Alle Stellen, die einen
 * frischen Token brauchen (401-Wiederholung, Aufwachen der Seite, `useAccessToken`), gehen über
 * `refreshAccessToken()`; gleichzeitige Aufrufe teilen sich eine einzige Erneuerung (single-flight).
 */
type TokenRefresher = () => Promise<void>

let refresher: TokenRefresher | null = null
let inflight: Promise<void> | null = null

export function setTokenRefresher(fn: TokenRefresher | null) {
  refresher = fn
}

export function refreshAccessToken(): Promise<void> {
  if (!refresher) {
    return Promise.reject(new Error('no token refresher registered'))
  }
  if (!inflight) {
    inflight = refresher().finally(() => {
      inflight = null
    })
  }
  return inflight
}

/** Sekunden bis zum Ablauf eines JWT (exp), oder undefined, wenn nicht lesbar */
export function secondsUntilExpiry(token: string | undefined): number | undefined {
  if (!token) {
    return undefined
  }
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const { exp } = JSON.parse(
      atob(payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), '='))
    )
    return typeof exp === 'number' ? exp - Date.now() / 1000 : undefined
  } catch {
    return undefined
  }
}

type RetriableConfig = InternalAxiosRequestConfig & { _ocTokenRetried?: boolean }

/**
 * 401 einer Anfrage mit Bearer: einmal erneuern (single-flight) und die Anfrage wiederholen. Der Request-Interceptor
 * des Clients setzt beim zweiten Lauf den neuen Token. Öffentliche Links (Basic) und bereits wiederholte Anfragen
 * werden nicht angefasst.
 */
export function installTokenRetry(instance: AxiosInstance | undefined) {
  if (!instance?.interceptors?.response) {
    return
  }
  instance.interceptors.response.use(undefined, async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined
    const authHeader = String(config?.headers?.Authorization || '')
    if (
      error.response?.status !== 401 ||
      !config ||
      config._ocTokenRetried ||
      !authHeader.startsWith('Bearer ')
    ) {
      throw error
    }
    config._ocTokenRetried = true
    try {
      await refreshAccessToken()
    } catch {
      throw error
    }
    return instance!(config)
  })
}
