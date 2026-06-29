export interface PlaylistEntry {
  url: string
  title: string
}

export function parseM3U(content: string): PlaylistEntry[] {
  const entries: PlaylistEntry[] = []
  const lines = content.split('\n').map((l) => l.trim()).filter(Boolean)
  let title = ''

  for (const line of lines) {
    if (line.startsWith('#EXTINF:')) {
      const comma = line.indexOf(',')
      title = comma >= 0 ? line.slice(comma + 1).trim() : ''
    } else if (line.startsWith('#')) {
      continue
    } else if (line.startsWith('http://') || line.startsWith('https://')) {
      entries.push({ url: line, title: title || line })
      title = ''
    }
  }
  return entries
}

export function parsePLS(content: string): PlaylistEntry[] {
  const entries: PlaylistEntry[] = []
  const files: Record<string, string> = {}
  const titles: Record<string, string> = {}

  for (const line of content.split('\n').map((l) => l.trim())) {
    const fileMatch = line.match(/^File(\d+)=(.+)$/i)
    if (fileMatch) {
      files[fileMatch[1]] = fileMatch[2]
    }
    const titleMatch = line.match(/^Title(\d+)=(.+)$/i)
    if (titleMatch) {
      titles[titleMatch[1]] = titleMatch[2]
    }
  }

  for (const key of Object.keys(files).sort((a, b) => Number(a) - Number(b))) {
    entries.push({
      url: files[key],
      title: titles[key] || files[key]
    })
  }
  return entries
}

export function parsePlaylist(content: string, filename: string): PlaylistEntry[] {
  if (filename.toLowerCase().endsWith('.pls') || content.trimStart().startsWith('[playlist]')) {
    return parsePLS(content)
  }
  return parseM3U(content)
}
