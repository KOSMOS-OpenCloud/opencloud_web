import { ref, unref } from 'vue'
import { ErrorTimeout } from 'oidc-client-ts'
import { AuthServiceInterface } from '../../authContext'
import { WebWorker, useWebWorkersStore } from '../../piniaStores/webWorkers'
import { Router } from 'vue-router'
import TokenWorker from './worker?worker'

export type TokenTimerWorkerTopic = 'set' | 'reset'

export const useTokenTimerWorker = ({
  authService,
  router
}: {
  authService: AuthServiceInterface
  router: Router
}) => {
  const { createWorker } = useWebWorkersStore()

  const worker = ref<WebWorker>()

  const startWorker = () => {
    worker.value = createWorker(TokenWorker as unknown as string)

    unref(unref(worker).worker).onmessage = async () => {
      const timerTriggeredAt = new Date().toISOString()
      console.debug(`[token-timer] Worker fired at ${timerTriggeredAt}, calling signinSilent()`)
      const silentStart = performance.now()
      try {
        await authService.signinSilent()
        const silentDurationMs = Math.round(performance.now() - silentStart)
        console.debug(`[token-timer] signinSilent() succeeded in ${silentDurationMs}ms`)
      } catch (error) {
        const silentDurationMs = Math.round(performance.now() - silentStart)
        const errorName = error instanceof Error ? error.name : typeof error
        const errorMsg = error instanceof Error ? error.message : String(error)
        console.warn(
          `[token-timer] signinSilent() failed after ${silentDurationMs}ms: ` +
            `${errorName}: ${errorMsg}`
        )
        if (error instanceof ErrorTimeout || error instanceof TypeError) {
          console.warn('[token-timer] Network error (ErrorTimeout/TypeError), retrying in 5 seconds...')
          unref(worker).post(JSON.stringify({ topic: 'set', expiry: 5, expiryThreshold: 0 }))
          return
        }

        console.error('[token-timer] Auth error, calling handleAuthError:', error)
        authService.handleAuthError(unref(router.currentRoute))
      }
    }
  }

  const setTokenTimer = ({
    expiry,
    expiryThreshold
  }: {
    expiry: number
    expiryThreshold: number
  }) => {
    if (!unref(worker)) {
      console.error('token timer worker is not running')
      return
    }

    unref(worker).post(JSON.stringify({ topic: 'set', expiry, expiryThreshold }))
  }

  const resetTokenTimer = () => {
    if (!unref(worker)) {
      console.error('token timer worker is not running')
      return
    }

    unref(worker).post(JSON.stringify({ topic: 'reset' }))
  }

  return { startWorker, setTokenTimer, resetTokenTimer }
}
