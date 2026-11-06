import { SpaceResource } from '@opencloud-eu/web-client'
import { WebDAV } from '@opencloud-eu/web-client/webdav'

/**
 * A smart folder is a saved KQL search shown like a folder. Presets come from
 * the web config (`options.smartFolders`) and are read-only; personal smart
 * folders live in a JSON file in the user's personal space.
 */
export interface SmartFolder {
  id: string
  name: string
  query: string
  preset?: boolean
}

export const smartFoldersFileName = '.smartfolders.json'

/**
 * A query without any literal character expands to every term of the search
 * index. The backend rejects it; we never send it.
 */
export function isWildcardOnlyQuery(query: string): boolean {
  return query.replace(/[*?"\s]/g, '') === ''
}

function isSmartFolder(value: unknown): value is SmartFolder {
  if (!value || typeof value !== 'object') {
    return false
  }
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.query === 'string' &&
    candidate.id !== '' &&
    !isWildcardOnlyQuery(candidate.query)
  )
}

/**
 * Parses the personal smart folder file. Invalid content yields an empty list
 * instead of an error, a broken file must not break the files app.
 */
export function parseSmartFolders(content: string): SmartFolder[] {
  try {
    const parsed = JSON.parse(content)
    const entries = Array.isArray(parsed) ? parsed : parsed?.smartFolders
    if (!Array.isArray(entries)) {
      return []
    }
    return entries
      .filter(isSmartFolder)
      .map(({ id, name, query }) => ({ id, name, query, preset: false }))
  } catch {
    return []
  }
}

export function serializeSmartFolders(smartFolders: SmartFolder[]): string {
  const personal = smartFolders
    .filter((smartFolder) => !smartFolder.preset)
    .map(({ id, name, query }) => ({ id, name, query }))
  return JSON.stringify({ smartFolders: personal }, null, 2)
}

export async function loadPersonalSmartFolders({
  webdav,
  personalSpace
}: {
  webdav: WebDAV
  personalSpace: SpaceResource
}): Promise<SmartFolder[]> {
  if (!personalSpace) {
    return []
  }
  try {
    const { body } = await webdav.getFileContents(personalSpace, {
      path: `/${smartFoldersFileName}`
    })
    return parseSmartFolders(typeof body === 'string' ? body : JSON.stringify(body))
  } catch (error) {
    if (error?.statusCode === 404) {
      return []
    }
    throw error
  }
}

export function presetSmartFolders(presets: { id: string; name: string; query: string }[]) {
  return (presets || [])
    .filter(isSmartFolder)
    .map(({ id, name, query }) => ({ id, name, query, preset: true }))
}

/** Presets first; a personal smart folder never shadows a preset id. */
export async function loadSmartFolders({
  webdav,
  personalSpace,
  presets
}: {
  webdav: WebDAV
  personalSpace: SpaceResource
  presets: { id: string; name: string; query: string }[]
}): Promise<SmartFolder[]> {
  const presetFolders = presetSmartFolders(presets)
  const presetIds = new Set(presetFolders.map((smartFolder) => smartFolder.id))
  const personalFolders = await loadPersonalSmartFolders({ webdav, personalSpace })
  return [
    ...presetFolders,
    ...personalFolders.filter((smartFolder) => !presetIds.has(smartFolder.id))
  ]
}

export async function savePersonalSmartFolders({
  webdav,
  personalSpace,
  smartFolders
}: {
  webdav: WebDAV
  personalSpace: SpaceResource
  smartFolders: SmartFolder[]
}): Promise<void> {
  await webdav.putFileContents(personalSpace, {
    path: `/${smartFoldersFileName}`,
    content: serializeSmartFolders(smartFolders),
    overwrite: true
  })
}
