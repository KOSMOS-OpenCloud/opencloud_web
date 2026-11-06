import { mock } from 'vitest-mock-extended'
import { ref } from 'vue'
import { Router, RouteLocation } from 'vue-router'
import { FolderLoaderSmartFolder } from '../../../../src/services/folder/loaders/loaderSmartFolder'

function routerOn(route: {
  name: string
  params?: Record<string, string>
  query?: Record<string, string>
}) {
  const router = mock<Router>()
  Object.defineProperty(router, 'currentRoute', { value: ref(route as unknown as RouteLocation) })
  return router
}

describe('FolderLoaderSmartFolder', () => {
  const loader = new FolderLoaderSmartFolder()

  it('is active on the smart folder route', () => {
    expect(
      loader.isActive(
        routerOn({ name: 'files-common-smart-folder', params: { smartFolderId: 'x' } })
      )
    ).toBe(true)
  })

  it('is active when an app was opened from a smart folder', () => {
    expect(
      loader.isActive(
        routerOn({ name: 'text-editor', query: { contextRouteName: 'files-common-smart-folder' } })
      )
    ).toBe(true)
  })

  it('is not active elsewhere and does not resolve the param route', () => {
    const router = routerOn({ name: 'files-common-search', query: {} })
    expect(loader.isActive(router)).toBe(false)
    expect(router.resolve).not.toHaveBeenCalled()
  })
})
