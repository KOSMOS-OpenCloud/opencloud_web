import ApplicationsMenu from '../../../../src/components/Topbar/ApplicationsMenu.vue'
import {
  RouteLocation,
  defaultComponentMocks,
  defaultPlugins,
  shallowMount
} from '@opencloud-eu/web-test-helpers'
import { mock } from 'vitest-mock-extended'
import { AppMenuItemExtension } from '@opencloud-eu/web-pkg'

describe('ApplicationsMenu component', () => {
  describe('type', () => {
    it('renders internal button menu items', () => {
      const menuItem = { label: () => '', handler: () => undefined } as AppMenuItemExtension
      const { wrapper } = getWrapper({ menuItems: [menuItem] })
      const menuItemType = wrapper.find('oc-list-stub oc-button-stub').attributes('type')
      expect(menuItemType).toEqual('button')
    })
    it('renders internal link menu items', () => {
      const menuItem = { label: () => '', path: '/files' } as AppMenuItemExtension
      const { wrapper } = getWrapper({ menuItems: [menuItem] })
      const menuItemType = wrapper.find('oc-list-stub oc-button-stub').attributes('type')
      expect(menuItemType).toEqual('router-link')
    })
    it('renders external menu items', () => {
      const menuItem = { label: () => '', url: 'foo.bar' } as AppMenuItemExtension
      const { wrapper } = getWrapper({ menuItems: [menuItem] })
      const menuItemType = wrapper.find('oc-list-stub oc-button-stub').attributes('type')
      expect(menuItemType).toEqual('a')
    })
  })
  it('correctly sorts menu items by priority', () => {
    const menuItems = [
      { label: () => '1', priority: 50 },
      { label: () => '2', priority: 40 }
    ] as AppMenuItemExtension[]

    const { wrapper } = getWrapper({ menuItems })
    const firstElTxt = wrapper.findAll('oc-list-stub oc-button-stub')[0].find('span').text()
    expect(firstElTxt).toEqual(menuItems[1].label())
  })
  describe('groups', () => {
    it('renders no heading when no item has a group', () => {
      const menuItems = [{ label: () => '1' }, { label: () => '2' }] as AppMenuItemExtension[]
      const { wrapper } = getWrapper({ menuItems })
      expect(wrapper.findAll('.applications-group-title').length).toBe(0)
      expect(wrapper.findAll('oc-list-stub').length).toBe(1)
    })
    it('lists items without a group first, then every group below its heading', () => {
      const menuItems = [
        { label: () => 'viewer', priority: 70, group: 'UCM' },
        { label: () => 'admin', priority: 65, group: 'System' },
        { label: () => 'files', priority: 80 },
        { label: () => 'editor', priority: 60, group: 'UCM' }
      ] as AppMenuItemExtension[]

      const { wrapper } = getWrapper({ menuItems })
      expect(wrapper.findAll('.applications-group-title').map((title) => title.text())).toEqual([
        'UCM',
        'System'
      ])
      const lists = wrapper.findAll('oc-list-stub')
      const labelsOf = (listIndex: number) =>
        lists[listIndex].findAll('oc-button-stub span').map((label) => label.text())
      expect(labelsOf(0)).toEqual(['files'])
      expect(labelsOf(1)).toEqual(['editor', 'viewer'])
      expect(labelsOf(2)).toEqual(['admin'])
    })
  })
  describe('active state', () => {
    it('checks the current route path against the menu item path', () => {
      const menuItems = [
        { label: () => '1', path: '/1' },
        { label: () => '2', path: '/2' }
      ] as AppMenuItemExtension[]

      const { wrapper } = getWrapper({ menuItems, path: '/2' })
      const activeElTxt = wrapper.find('.router-link-active span').text()
      expect(activeElTxt).toEqual(menuItems[1].label())
    })
  })
})

function getWrapper({
  menuItems = [],
  path = '/'
}: { menuItems?: AppMenuItemExtension[]; path?: string } = {}) {
  const mocks = {
    ...defaultComponentMocks({
      currentRoute: mock<RouteLocation>({ path })
    })
  }

  return {
    wrapper: shallowMount(ApplicationsMenu, {
      props: {
        menuItems
      },
      global: {
        renderStubDefaultSlot: true,
        mocks,
        provide: mocks,
        plugins: [...defaultPlugins()]
      }
    })
  }
}
