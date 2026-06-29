import { Resource } from '@opencloud-eu/web-client'

export const useFileTypes = () => {
  const isFileTypeImage = (file: Resource) => {
    return !isFileTypeAudio(file) && !isFileTypeVideo(file)
  }
  const playlistMimeTypes = [
    'audio/x-mpegurl', 'audio/mpegurl',
    'application/pls+xml', 'application/vnd.apple.mpegurl'
  ]

  const isFileTypePlaylist = (file: Resource) => {
    const mt = file.mimeType?.toLowerCase() || ''
    return playlistMimeTypes.includes(mt) ||
      file.name?.toLowerCase().endsWith('.m3u') ||
      file.name?.toLowerCase().endsWith('.pls')
  }

  const isFileTypeAudio = (file: Resource) => {
    return file.mimeType.toLowerCase().startsWith('audio') || isFileTypePlaylist(file)
  }
  const isFileTypeVideo = (file: Resource) => {
    return file.mimeType.toLowerCase().startsWith('video')
  }

  return {
    isFileTypeImage,
    isFileTypeAudio,
    isFileTypePlaylist,
    isFileTypeVideo
  }
}
