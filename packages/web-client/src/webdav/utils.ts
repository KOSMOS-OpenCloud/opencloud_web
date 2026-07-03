import { isPublicSpaceResource, SpaceResource } from '../helpers'
import { urlJoin } from '../utils'

const BROWSABLE_ARCHIVE_EXTENSIONS = ['.zip', '.7z']

export const getWebDavPath = (
  space: SpaceResource,
  { fileId, path, name }: { fileId?: string; path?: string; name?: string }
) => {
  if (path !== undefined) {
    const needsTrailingSlash = !path.endsWith('/') &&
      BROWSABLE_ARCHIVE_EXTENSIONS.some((ext) => path.toLowerCase().endsWith(ext))
    const effectivePath = needsTrailingSlash ? path + '/' : path
    if (needsTrailingSlash) {
      console.debug('[zipfs-debug] SLASH ADDED:', path, '->', effectivePath)
    }
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
