import { describe, it, expect } from 'vitest'
import { buildPropFindBody, buildPropPatchBody, NsOwncloudMetadata } from '../../../../src/webdav/client/builders'

describe('buildPropFindBody', () => {
  it('generates a basic propfind body', () => {
    const body = buildPropFindBody([], { extraProps: [] })
    expect(body).toContain('d:propfind')
    expect(body).toContain('xmlns:d')
    expect(body).toContain('xmlns:oc')
  })

  it('generates a search-files body when pattern is set', () => {
    const body = buildPropFindBody([], { pattern: 'test', extraProps: [] })
    expect(body).toContain('oc:search-files')
    expect(body).toContain('oc:pattern')
    expect(body).toContain('test')
  })

  it('includes regular extraProps without namespace prefix', () => {
    const body = buildPropFindBody([], { extraProps: ['my-custom-prop'] })
    expect(body).toContain('my-custom-prop')
    expect(body).not.toContain('xmlns:om')
  })

  it('includes om: extraProps with om namespace prefix', () => {
    const body = buildPropFindBody([], { extraProps: ['om:aktencode'] })
    expect(body).toContain('om:aktencode')
    expect(body).toContain(`xmlns:om="${NsOwncloudMetadata}"`)
  })

  it('includes xmlns:om only when om: props are present', () => {
    const body = buildPropFindBody([], { extraProps: ['plain-prop'] })
    expect(body).not.toContain('xmlns:om')
  })

  it('handles multiple om: props', () => {
    const body = buildPropFindBody([], {
      extraProps: ['om:aktencode', 'om:parent-aktencode', 'om:typ']
    })
    expect(body).toContain('om:aktencode')
    expect(body).toContain('om:parent-aktencode')
    expect(body).toContain('om:typ')
    expect(body).toContain(`xmlns:om="${NsOwncloudMetadata}"`)
  })

  it('handles mixed om: and regular extraProps', () => {
    const body = buildPropFindBody([], {
      extraProps: ['om:aktencode', 'legacy-prop']
    })
    expect(body).toContain('om:aktencode')
    expect(body).toContain('legacy-prop')
    expect(body).toContain(`xmlns:om="${NsOwncloudMetadata}"`)
  })

  it('includes om: props in search-files body', () => {
    const body = buildPropFindBody([], {
      pattern: 'test',
      extraProps: ['om:aktencode', 'om:parent-aktencode']
    })
    expect(body).toContain('oc:search-files')
    expect(body).toContain('om:aktencode')
    expect(body).toContain('om:parent-aktencode')
    expect(body).toContain(`xmlns:om="${NsOwncloudMetadata}"`)
  })
})

describe('buildPropPatchBody', () => {
  it('generates a basic proppatch body', () => {
    const body = buildPropPatchBody({ name: 'test' } as any)
    expect(body).toContain('d:propertyupdate')
    expect(body).toContain('xmlns:d')
    expect(body).toContain('xmlns:oc')
  })

  it('does not include xmlns:om when no om: props', () => {
    const body = buildPropPatchBody({ name: 'test' } as any)
    expect(body).not.toContain('xmlns:om')
  })

  it('includes xmlns:om when om: props are present', () => {
    const body = buildPropPatchBody(
      { 'om:aktencode': '11.12.01' } as any,
      ['om:aktencode']
    )
    expect(body).toContain(`xmlns:om="${NsOwncloudMetadata}"`)
    expect(body).toContain('om:aktencode')
  })
})

describe('NsOwncloudMetadata', () => {
  it('has the correct namespace URI', () => {
    expect(NsOwncloudMetadata).toBe('http://owncloud.org/ns/metadata')
  })
})
