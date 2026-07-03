import { isPublicSpaceResource, SpaceResource } from '../helpers'
import { urlJoin } from '../utils'

const BROWSABLE_ARCHIVE_EXTENSIONS = ['.zip', '.7z']

/**
 * Builds a webdav path based on a given `path` or `fileId`. A `path` takes precedence.
 *
 * Public spaces currently don't support id-based paths, hence `path` needs to be provided.
 * Some id-based requests need a resource `name` appended (mkcol, put, copy, move, restore).
 * In this case, the `fileId` is supposed to be the id of the parent folder.
 *
 * Paths ending with a browsable archive extension (e.g. .zip) get a trailing slash
 * appended so WebDAV treats them as directory listings (archive browsing).
 **/
export const getWebDavPath = (
  space: SpaceResource,
  { fileId, path, name }: { fileId?: string; path?: string; name?: string }
) => {
  if (path !== undefined) {
    // If path ends with a browsable archive extension, ensure trailing slash
    // so the server's archive interceptor treats it as a directory listing
    const needsTrailingSlash = !path.endsWith('/') &&
      BROWSABLE_ARCHIVE_EXTENSIONS.some((ext) => path.toLowerCase().endsWith(ext))
    const effectivePath = needsTrailingSlash ? path + '/' : path
    return urlJoin(space.webDavPath, effectivePath, { trailingSlash: 'keep' })
  }

  if (fileId !== undefined) {
    if (isPublicSpaceResource(space)) {
      throw new Error('public spaces need a path provided')
    }

    return urlJoin('spaces', fileId, name || '')
  }

  return space.webDavPath
}
