import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface AudioTrack {
  id: string
  name: string
  url: string
}

export const useAudioPlayerStore = defineStore('audioPlayer', () => {
  const currentTrack = ref<AudioTrack | null>(null)

  const play = (track: AudioTrack) => {
    currentTrack.value = track
  }

  const stop = () => {
    currentTrack.value = null
  }

  return { currentTrack, play, stop }
})
