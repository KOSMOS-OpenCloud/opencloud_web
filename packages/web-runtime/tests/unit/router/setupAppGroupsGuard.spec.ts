import { Router } from 'vue-router'
import { setupAppGroupsGuard } from '../../../src/router/setupAppGroupsGuard'
import { useUserStore } from '@opencloud-eu/web-pkg'

vi.mock('@opencloud-eu/web-pkg', () => ({
  useUserStore: vi.fn()
}))

type Guard = (to: any) => unknown

function installGuard(userGroupNames: string[] | null): Guard {
  vi.mocked(useUserStore).mockReturnValue({
    user: userGroupNames && {
      memberOf: userGroupNames.map((displayName) => ({ displayName }))
    }
  } as any)

  let guard: Guard
  const router = { beforeEach: (registeredGuard: Guard) => (guard = registeredGuard) }
  setupAppGroupsGuard(router as unknown as Router)
  return guard
}

describe('setupAppGroupsGuard', () => {
  it('passes routes without groups', () => {
    expect(installGuard(null)({ meta: {} })).toBe(true)
    expect(installGuard(['Admin'])({ meta: { requiredGroups: [] } })).toBe(true)
  })
  it('passes members', () => {
    expect(installGuard(['Admin', 'Construct'])({ meta: { requiredGroups: ['Construct'] } })).toBe(
      true
    )
  })
  it('sends everybody else to the app access denied page', () => {
    const target = { name: 'appAccessDenied' }
    expect(installGuard(['Admin'])({ meta: { requiredGroups: ['Construct'] } })).toEqual(target)
    expect(installGuard(null)({ meta: { requiredGroups: ['Construct'] } })).toEqual(target)
  })
})
