import { WebDavOptions } from './types'
import { urlJoin } from '../utils'
import { DAV, DAVRequestOptions } from './client'
import { DavProperties } from './constants'
import { buildResource } from '../helpers'

export const ListFileVersionsFactory = (dav: DAV, options: WebDavOptions) => {
  return {
    async listFileVersions(id: string, opts: DAVRequestOptions = {}) {
      console.log('[listFileVersions] requesting with Default properties:', DavProperties.Default.map(p => p.toString()))
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [currentFolder, ...versions] = await dav.propfind(
        urlJoin('meta', id, 'v', { leadingSlash: true }),
        { properties: DavProperties.Default, ...opts }
      )
      console.log('[listFileVersions] raw versions:', versions.map(v => ({
        name: v.basename,
        size: v.props?.getcontentlength,
        mdate: v.props?.getlastmodified,
        props: Object.keys(v.props || {})
      })))
      const result = versions.map((v) => buildResource(v, dav.extraProps))
      console.log('[listFileVersions] built resources:', result.map(r => ({
        name: r.name,
        size: r.size,
        mdate: r.mdate
      })))
      return result
    }
  }
}
