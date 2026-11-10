import { mock } from 'vitest-mock-extended'
import { ExtensionRegistry, SidebarNavExtension } from '../../../../src/composables/piniaStores'
import { getExtensionNavItems } from '../../../../src/composables/navItems'
import { AppNavigationItem } from '../../../../src/apps'

const navExtension = (id: string, name: string, isVisible?: () => boolean) =>
  ({
    id,
    type: 'sidebarNav',
    extensionPointIds: ['app.files.navItems'],
    navItem: { name, route: { path: `/${name}` }, ...(isVisible && { isVisible }) }
  }) as SidebarNavExtension

const getRegistry = (extensions: SidebarNavExtension[]) => {
  const extensionRegistry = mock<ExtensionRegistry>()
  extensionRegistry.requestExtensions.mockReturnValue(extensions as any)
  return extensionRegistry
}

const names = (items: AppNavigationItem[]) => items.map(({ name }) => name)

describe('getExtensionNavItems', () => {
  const extensions = [
    navExtension('app.files.Personal', 'Personal'),
    navExtension('app.files.Spaces', 'Spaces'),
    navExtension('tudu.files.nav', 'Todos'),
    navExtension('rooms.files.nav', 'Rooms')
  ]

  it('returns the items of the app and of other apps', () => {
    const extensionRegistry = getRegistry(extensions)
    expect(names(getExtensionNavItems({ extensionRegistry, appId: 'files' }))).toEqual([
      'Personal',
      'Spaces',
      'Todos',
      'Rooms'
    ])
  })

  it('returns only the items announced by the app itself with ownItemsOnly', () => {
    const extensionRegistry = getRegistry(extensions)
    expect(
      names(getExtensionNavItems({ extensionRegistry, appId: 'files', ownItemsOnly: true }))
    ).toEqual(['Personal', 'Spaces'])
  })

  it('still hides invisible items', () => {
    const extensionRegistry = getRegistry([
      navExtension('app.files.Personal', 'Personal'),
      navExtension('app.files.Trash', 'Trash', () => false)
    ])
    expect(
      names(getExtensionNavItems({ extensionRegistry, appId: 'files', ownItemsOnly: true }))
    ).toEqual(['Personal'])
  })
})
