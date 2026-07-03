import { isPublicSpaceResource, SpaceResource } from '../helpers'
import { urlJoin } from '../utils'

/**
 * Builds a webdav path based on a given `path` or `fileId`. A `path` takes precedence.
 **/
export const getWebDavPath = (
  space: SpaceResource,
  { fileId, path, name }: { fileId?: string; path?: string; name?: string }
) => {
  if (path !== undefined) {
    console.debug('[zipfs-debug] getWebDavPath input path:', JSON.stringify(path))
    const result = urlJoin(space.webDavPath, path, { trailingSlash: 'keep' })
    console.debug('[zipfs-debug] getWebDavPath result:', result)
    return result
  }

  if (fileId !== undefined) {
    if (isPublicSpaceResource(space)) {
      throw new Error('public spaces need a path provided')
    }

    return urlJoin('spaces', fileId, name || '')
  }

  return space.webDavPath
}
