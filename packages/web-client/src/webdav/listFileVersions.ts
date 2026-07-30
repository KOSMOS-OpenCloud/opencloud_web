import { WebDavOptions } from './types'
import { urlJoin } from '../utils'
import { DAV, DAVRequestOptions } from './client'
import { DavProperty } from './constants'
import { buildResource } from '../helpers'

// Version resources don't support owner/permission properties —
// requesting them causes a nil pointer crash in Reva's PROPFIND handler.
const VersionProperties = [
  DavProperty.ContentLength,
  DavProperty.LastModifiedDate,
  DavProperty.ETag,
  DavProperty.MimeType,
  DavProperty.ResourceType,
  DavProperty.Name,
  DavProperty.FileId
]

export const ListFileVersionsFactory = (dav: DAV, options: WebDavOptions) => {
  return {
    async listFileVersions(id: string, opts: DAVRequestOptions = {}) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [currentFolder, ...versions] = await dav.propfind(
        urlJoin('meta', id, 'v', { leadingSlash: true }),
        { properties: VersionProperties, ...opts }
      )
      return versions.map((v) => buildResource(v, dav.extraProps))
    }
  }
}
