import { mock } from 'vitest-mock-extended'
import { SpaceResource } from '@opencloud-eu/web-client'
import { WebDAV } from '@opencloud-eu/web-client/webdav'
import {
  isWildcardOnlyQuery,
  loadSmartFolders,
  parseSmartFolders,
  savePersonalSmartFolders,
  serializeSmartFolders,
  smartFoldersFileName
} from '../../../src/helpers/smartFolders'

const invoices = { id: 'invoices', name: 'Rechnungen', query: 'metadata.doc.type:rechnung' }

describe('smartFolders', () => {
  describe('isWildcardOnlyQuery', () => {
    it.each(['', '*', '**', '"*"', ' ?* ', '\t'])('rejects "%s"', (query) => {
      expect(isWildcardOnlyQuery(query)).toBe(true)
    })
    it.each(['metadata.doc.type:rechnung', 'name:*.pdf', 'rechnung*'])('accepts "%s"', (query) => {
      expect(isWildcardOnlyQuery(query)).toBe(false)
    })
  })

  describe('parseSmartFolders', () => {
    it('reads the file format and marks entries as personal', () => {
      const content = JSON.stringify({ smartFolders: [invoices] })
      expect(parseSmartFolders(content)).toEqual([{ ...invoices, preset: false }])
    })
    it('accepts a plain array', () => {
      expect(parseSmartFolders(JSON.stringify([invoices]))).toHaveLength(1)
    })
    it('drops invalid and wildcard-only entries', () => {
      const content = JSON.stringify({
        smartFolders: [invoices, { id: 'all', name: 'Alles', query: '*' }, { name: 'no id' }]
      })
      expect(parseSmartFolders(content).map(({ id }) => id)).toEqual(['invoices'])
    })
    it('returns an empty list for broken content', () => {
      expect(parseSmartFolders('{not json')).toEqual([])
    })
  })

  describe('serializeSmartFolders', () => {
    it('stores personal entries only, without the preset flag', () => {
      const content = serializeSmartFolders([
        { ...invoices, preset: false },
        { id: 'preset', name: 'Preset', query: 'tag:x', preset: true }
      ])
      expect(JSON.parse(content)).toEqual({ smartFolders: [invoices] })
    })
  })

  describe('loadSmartFolders', () => {
    it('combines presets and personal entries, presets win on equal ids', async () => {
      const webdav = mock<WebDAV>()
      webdav.getFileContents.mockResolvedValue({
        body: JSON.stringify({
          smartFolders: [
            { id: 'invoices', name: 'Meine Rechnungen', query: 'x:y' },
            { id: 'mine', name: 'Meins', query: 'tag:mine' }
          ]
        })
      } as any)
      const smartFolders = await loadSmartFolders({
        webdav,
        personalSpace: mock<SpaceResource>(),
        presets: [invoices]
      })
      expect(smartFolders).toEqual([
        { ...invoices, preset: true },
        { id: 'mine', name: 'Meins', query: 'tag:mine', preset: false }
      ])
      expect(webdav.getFileContents).toHaveBeenCalledWith(expect.anything(), {
        path: `/${smartFoldersFileName}`
      })
    })
    it('treats a missing file as no personal smart folders', async () => {
      const webdav = mock<WebDAV>()
      webdav.getFileContents.mockRejectedValue({ statusCode: 404 })
      const smartFolders = await loadSmartFolders({
        webdav,
        personalSpace: mock<SpaceResource>(),
        presets: undefined
      })
      expect(smartFolders).toEqual([])
    })
    it('passes other errors on', async () => {
      const webdav = mock<WebDAV>()
      webdav.getFileContents.mockRejectedValue({ statusCode: 500 })
      await expect(
        loadSmartFolders({ webdav, personalSpace: mock<SpaceResource>(), presets: [] })
      ).rejects.toEqual({ statusCode: 500 })
    })
  })

  describe('savePersonalSmartFolders', () => {
    it('overwrites the file in the personal space', async () => {
      const webdav = mock<WebDAV>()
      await savePersonalSmartFolders({
        webdav,
        personalSpace: mock<SpaceResource>(),
        smartFolders: [{ ...invoices, preset: false }]
      })
      expect(webdav.putFileContents).toHaveBeenCalledWith(expect.anything(), {
        path: `/${smartFoldersFileName}`,
        content: serializeSmartFolders([invoices]),
        overwrite: true
      })
    })
  })
})
