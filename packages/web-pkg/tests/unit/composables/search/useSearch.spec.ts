import { defaultComponentMocks, getComposableWrapper } from '@opencloud-eu/web-test-helpers'
import { CapabilityStore, isMetadataQuery, useSearch } from '../../../../src/composables'
import { SearchResource, SpaceResource } from '@opencloud-eu/web-client'

describe('useSearch', () => {
  describe('method "search"', () => {
    it('can search', async () => {
      const files = [
        { id: 'foo', name: 'foo' },
        { id: 'bar', name: 'bar' },
        { id: 'baz', name: 'baz' }
      ] as SearchResource[]

      const wrapper = createWrapper({ resources: files })

      const noTermResult = await wrapper.vm.search('')
      expect(noTermResult).toEqual({ totalResults: null, values: [] })

      const withTermResult = await wrapper.vm.search('foo')
      expect(withTermResult.values.map((r) => r.data)).toMatchObject(files)
    })
    it('properly returns space resources', async () => {
      const files = [{ id: 'foo', name: 'foo', parentFolderId: '2' }] as SearchResource[]

      const wrapper = createWrapper({ resources: files })

      const withTerm = await wrapper.vm.search('foo')
      expect(withTerm.values.map((r) => r.data)[0].id).toEqual('2')
    })
  })
  describe('metadata queries', () => {
    it.each([
      'metadata.doc.type:rechnung',
      'metadata.doc.type:rechnung AND NOT metadata.booking.status:E',
      '(metadata.sender.vat_id:DE123)'
    ])('detects "%s"', (term) => {
      expect(isMetadataQuery(term)).toBe(true)
    })
    it.each(['rechnung', 'Rechnung: Müller', 'mymetadata.doc:x', 'metadata.doc.type:'])(
      'ignores "%s"',
      (term) => {
        expect(isMetadataQuery(term)).toBe(false)
      }
    )
    it('passes a metadata query through and keeps the filters', () => {
      const wrapper = createWrapper()
      expect(
        wrapper.vm.buildSearchTerm({ term: 'metadata.doc.type:rechnung', mediaType: 'pdf' })
      ).toEqual('(metadata.doc.type:rechnung) AND mediatype:("pdf")')
    })
    it('keeps the name search for plain terms', () => {
      const wrapper = createWrapper()
      expect(wrapper.vm.buildSearchTerm({ term: 'rechnung', isTitleOnlySearch: true })).toEqual(
        'name:"*rechnung*"'
      )
    })
  })
})

const createWrapper = ({ resources = [] }: { resources?: SearchResource[] } = {}) => {
  const spaces = [
    {
      id: '1',
      fileId: '1',
      driveType: 'personal',
      getDriveAliasAndItem: () => 'personal/admin'
    },
    {
      id: '2',
      driveType: 'project',
      name: 'New space',
      getDriveAliasAndItem: vi.fn()
    }
  ] as unknown as SpaceResource[]

  const mocks = defaultComponentMocks({})
  const capabilities = {
    spaces: { projects: true }
  } satisfies Partial<CapabilityStore['capabilities']>

  mocks.$clientService.webdav.search.mockResolvedValue({
    resources,
    totalResults: resources.length
  })

  return getComposableWrapper(
    () => {
      const { search, buildSearchTerm } = useSearch()

      return {
        search,
        buildSearchTerm
      }
    },
    {
      mocks,
      provide: mocks,
      pluginOptions: {
        piniaOptions: { spacesState: { spaces }, capabilityState: { capabilities } }
      }
    }
  )
}
