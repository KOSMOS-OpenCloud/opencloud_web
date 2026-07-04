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
    return urlJoin(space.webDavPath, path)
  }

  if (fileId !== undefined) {
    if (isPublicSpaceResource(space)) {
      throw new Error('public spaces need a path provided')
    }

    return urlJoin('spaces', fileId, name || '')
  }

  return space.webDavPath
}
