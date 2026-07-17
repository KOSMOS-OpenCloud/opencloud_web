import { describe, it, expect, beforeEach } from 'vitest'
import { subspaceCache, isSubspaceRootSync } from '../../../../src/composables/spaces/useSubspaces'

describe('isSubspaceRootSync', () => {
  beforeEach(() => {
    subspaceCache.clear()
  })

  it('returns false when cache is empty', () => {
    expect(isSubspaceRootSync('any-id')).toBe(false)
  })

  it('returns true when node ID matches a subspace entry', () => {
    subspaceCache.set('space1', [
      { id: 'node-abc', path: '/finance' },
      { id: 'node-def', path: '/hr' }
    ])

    expect(isSubspaceRootSync('node-abc')).toBe(true)
    expect(isSubspaceRootSync('node-def')).toBe(true)
  })

  it('returns false when node ID does not match', () => {
    subspaceCache.set('space1', [{ id: 'node-abc', path: '/finance' }])

    expect(isSubspaceRootSync('other-node')).toBe(false)
  })

  it('extracts nodeID from spaceID$nodeID format', () => {
    subspaceCache.set('space1', [{ id: 'node-abc', path: '/finance' }])

    expect(isSubspaceRootSync('space1$node-abc')).toBe(true)
    expect(isSubspaceRootSync('space1$other')).toBe(false)
  })

  it('searches across all cached spaces', () => {
    subspaceCache.set('space1', [{ id: 'node-1', path: '/a' }])
    subspaceCache.set('space2', [{ id: 'node-2', path: '/b' }])

    expect(isSubspaceRootSync('node-1')).toBe(true)
    expect(isSubspaceRootSync('node-2')).toBe(true)
    expect(isSubspaceRootSync('node-3')).toBe(false)
  })

  it('handles bare nodeID without $ separator', () => {
    subspaceCache.set('space1', [{ id: 'simple-id', path: '/dir' }])

    expect(isSubspaceRootSync('simple-id')).toBe(true)
  })
})
