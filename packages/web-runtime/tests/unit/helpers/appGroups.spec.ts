import { isMemberOfAppGroups } from '../../../src/helpers/appGroups'

const userWithGroups = (...groupNames: string[]) => ({
  memberOf: groupNames.map((displayName) => ({ displayName }))
})

describe('isMemberOfAppGroups', () => {
  it('lets everybody in without groups', () => {
    expect(isMemberOfAppGroups(null)).toBe(true)
    expect(isMemberOfAppGroups(null, [])).toBe(true)
    expect(isMemberOfAppGroups(userWithGroups('Admin'), [' '])).toBe(true)
  })
  it('lets nobody in without a user', () => {
    expect(isMemberOfAppGroups(null, ['Construct'])).toBe(false)
    expect(isMemberOfAppGroups(undefined, ['Construct'])).toBe(false)
    expect(isMemberOfAppGroups({}, ['Construct'])).toBe(false)
  })
  it('needs one of the groups, compared without case', () => {
    expect(isMemberOfAppGroups(userWithGroups('Admin'), ['Construct'])).toBe(false)
    expect(isMemberOfAppGroups(userWithGroups('Admin', 'Construct'), ['Construct'])).toBe(true)
    expect(isMemberOfAppGroups(userWithGroups('construct'), [' Construct '])).toBe(true)
    expect(isMemberOfAppGroups(userWithGroups('Statik'), ['Construct', 'Statik'])).toBe(true)
  })
})
