import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface AudioTrack {
  id: string
  name: string
  url: string
}

export const useAudioPlayerStore = defineStore('audioPlayer', () => {
  const currentTrack = ref<AudioTrack | null>(null)
  const playlist = ref<AudioTrack[]>([])

  const play = (track: AudioTrack) => {
    playlist.value = [track]
    currentTrack.value = track
  }

  const playList = (tracks: AudioTrack[], startIndex = 0) => {
    playlist.value = tracks
    currentTrack.value = tracks[startIndex] || tracks[0] || null
  }

  const selectTrack = (index: number) => {
    if (index >= 0 && index < playlist.value.length) {
      currentTrack.value = playlist.value[index]
    }
  }

  const stop = () => {
    currentTrack.value = null
    playlist.value = []
  }

  return { currentTrack, playlist, play, playList, selectTrack, stop }
})
