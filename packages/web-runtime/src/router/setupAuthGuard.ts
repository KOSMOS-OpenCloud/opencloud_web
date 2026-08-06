import {
  extractPublicLinkToken,
  isIdpContextRequired,
  isPublicLinkContextRequired,
  isUserContextRequired
} from './index'
import { Router, RouteLocation } from 'vue-router'
import {
  contextRouteNameKey,
  queryItemAsString,
  useAuthStore,
  useEmbedMode
} from '@opencloud-eu/web-pkg'
import { authService } from '../services/auth/authService'
import { unref } from 'vue'

export const setupAuthGuard = (router: Router) => {
  router.beforeEach(async (to, from) => {
    const { isDelegatingAuthentication } = useEmbedMode()

    console.log('[authGuard] to:', to.path, 'name:', String(to.name), 'from:', from?.path)

    if (from && to.path === from.path && !hasContextRouteNameChanged(to, from)) {
      console.log('[authGuard] same path, skip')
      return true
    }

    const authStore = useAuthStore()
    await authService.initializeContext(to)

    if (authService.hasAuthErrorOccurred) {
      console.log('[authGuard] AUTH ERROR -> accessDenied')
      return to.name === 'accessDenied' || { name: 'accessDenied' }
    }

    if (isPublicLinkContextRequired(router, to)) {
      if (!authStore.publicLinkContextReady) {
        console.log('[authGuard] publicLink not ready -> resolvePublicLink')
        const publicLinkToken = extractPublicLinkToken(to)
        return {
          name: 'resolvePublicLink',
          params: { token: publicLinkToken },
          query: { redirectUrl: to.fullPath }
        }
      }
      return true
    }

    if (isUserContextRequired(router, to)) {
      if (!authStore.userContextReady) {
        if (unref(isDelegatingAuthentication)) {
          console.log('[authGuard] user not ready -> oidc-callback')
          return { path: '/web-oidc-callback' }
        }
        console.log('[authGuard] user NOT ready -> /login, redirect:', to.fullPath)
        return { path: '/login', query: { redirectUrl: to.fullPath } }
      }
      console.log('[authGuard] user ready, pass through')
      return true
    }

    if (isIdpContextRequired(router, to)) {
      if (!authStore.idpContextReady) {
        console.log('[authGuard] idp not ready -> /login')
        if (unref(isDelegatingAuthentication)) {
          return { path: '/web-oidc-callback' }
        }

        return { path: '/login', query: { redirectUrl: to.fullPath } }
      }
      return true
    }

    return true
  })
  router.afterEach((to, from) => {
    console.log('[router.afterEach] navigated to:', to.path, 'name:', String(to.name), 'from:', from?.path)
    if (to.name !== 'accessDenied') {
      return
    }
    authService.hasAuthErrorOccurred = false
  })
}

export const hasContextRouteNameChanged = (to: RouteLocation, from: RouteLocation): boolean => {
  if (!to.query[contextRouteNameKey] && !from.query[contextRouteNameKey]) {
    return false
  }

  return (
    queryItemAsString(to.query[contextRouteNameKey]) !==
    queryItemAsString(from.query[contextRouteNameKey])
  )
}
