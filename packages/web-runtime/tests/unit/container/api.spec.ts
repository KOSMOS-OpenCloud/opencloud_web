import { createRouter, createWebHashHistory } from 'vue-router'
import { unref } from 'vue'
import { createTestingPinia } from '@opencloud-eu/web-test-helpers'
import { SidebarNavExtension, useExtensionRegistry } from '@opencloud-eu/web-pkg'
import { buildRuntimeApi, getMountPath } from '../../../src/container/api'

const component = { template: '<div />' }

function getRuntimeApi(mounts?: Parameters<typeof buildRuntimeApi>[0]['mounts']) {
  createTestingPinia({ stubActions: false })
  const router = createRouter({ history: createWebHashHistory(), routes: [] })
  const extensionRegistry = useExtensionRegistry()
  const runtimeApi = buildRuntimeApi({
    applicationName: 'Todos',
    applicationId: 'files/todos',
    router,
    extensionRegistry,
    mounts
  })
  return { router, extensionRegistry, runtimeApi }
}

describe('runtime api', () => {
  describe('getMountPath', () => {
    it('uses the last segment of the application id by default', () => {
      expect(getMountPath('files/todos', { app: 'calendar' })).toBe('calendar/todos')
    })
    it('uses the path of the mount if given', () => {
      expect(getMountPath('files/todos', { app: 'calendar', path: 'tasks' })).toBe('calendar/tasks')
    })
  })

  describe('announceRoutes', () => {
    it('announces the routes below the application id only without mounts', () => {
      const { router, runtimeApi } = getRuntimeApi()
      runtimeApi.announceRoutes([{ path: '/', name: 'todos', component }])

      expect(router.getRoutes().map(({ path }) => path)).toEqual(['/files/todos/'])
    })
    it('announces the routes below every mount as well', () => {
      const { router, runtimeApi } = getRuntimeApi([{ app: 'calendar' }])
      runtimeApi.announceRoutes([
        { path: '/', name: 'todos', component },
        { path: '/:id', name: 'todo', component }
      ])

      expect(router.resolve('/files/todos/4711').name).toBe('files/todos-todo')
      expect(router.resolve('/calendar/todos/4711').name).toBe('calendar/todos-todo')
      expect(router.resolve('/calendar/todos/').name).toBe('calendar/todos-todos')
    })
  })

  describe('announceMounts', () => {
    it('registers the nav item of a mount in the main menu of the primary app', () => {
      const { extensionRegistry, runtimeApi } = getRuntimeApi([
        { app: 'calendar', navItem: { name: 'Todos', icon: 'task-line', priority: 35 } },
        { app: 'mail' }
      ])
      runtimeApi.announceMounts()

      const navExtensions = extensionRegistry.requestExtensions<SidebarNavExtension>({
        id: 'app.calendar.navItems',
        extensionType: 'sidebarNav'
      })
      expect(navExtensions.length).toBe(1)
      expect(navExtensions[0].id.startsWith('app.calendar.')).toBeFalsy()
      expect(navExtensions[0].navItem).toEqual({
        name: 'Todos',
        icon: 'task-line',
        priority: 35,
        route: { path: '/calendar/todos' }
      })
      expect(
        extensionRegistry.requestExtensions<SidebarNavExtension>({
          id: 'app.mail.navItems',
          extensionType: 'sidebarNav'
        }).length
      ).toBe(0)
    })
    it('registers nothing without mounts', () => {
      const { extensionRegistry, runtimeApi } = getRuntimeApi()
      runtimeApi.announceMounts()

      expect(unref(extensionRegistry.extensions).length).toBe(0)
    })
  })
})
