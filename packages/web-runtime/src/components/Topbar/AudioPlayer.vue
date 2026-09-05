<template>
  <div v-if="currentTrack" class="flex items-center gap-1.5 max-w-md">
    <select
      v-if="playlist.length > 1"
      class="text-xs bg-transparent border border-role-outline rounded px-1 py-0.5 max-w-28 truncate cursor-pointer"
      :value="currentTrackIndex"
      @change="onSelectTrack"
    >
      <option
        v-for="(track, i) in playlist"
        :key="track.id + i"
        :value="i"
        v-text="track.name"
      />
    </select>
    <span
      v-else
      class="text-xs truncate max-w-28 hidden sm:inline"
      :title="currentTrack.name"
    >
      {{ currentTrack.name }}
    </span>
    <audio
      ref="audioEl"
      controls
      autoplay
      preload="auto"
      class="h-10 w-64"
      @ended="onEnded"
      @loadedmetadata="onLoadedMetadata"
    >
      <source :src="currentTrack.url" />
    </audio>
    <button
      class="oc-button-raw p-0.5 cursor-pointer hover:opacity-70"
      :aria-label="$gettext('Close audio player')"
      @click="stop"
    >
      <oc-icon name="close" size="small" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, ref, watch, nextTick } from 'vue'
import { useAudioPlayerStore } from '@opencloud-eu/web-pkg'

const audioPlayerStore = useAudioPlayerStore()
const { currentTrack, playlist } = storeToRefs(audioPlayerStore)
const { selectTrack, stop } = audioPlayerStore
const audioEl = ref<HTMLAudioElement>()

const currentTrackIndex = computed(() => {
  const ct = currentTrack.value
  if (!ct) return 0
  const idx = playlist.value.findIndex((t) => t.url === ct.url)
  return idx >= 0 ? idx : 0
})

const onSelectTrack = (e: Event) => {
  const idx = Number((e.target as HTMLSelectElement).value)
  selectTrack(idx)
}

const onEnded = () => {
  // Auto-advance to next track in playlist
  const next = currentTrackIndex.value + 1
  if (next < playlist.value.length) {
    selectTrack(next)
  }
}

let pendingSeek = false

const onLoadedMetadata = () => {
  if (pendingSeek && audioEl.value && currentTrack.value?.startTime !== undefined) {
    audioEl.value.currentTime = currentTrack.value.startTime
    pendingSeek = false
  }
}

watch(currentTrack, async () => {
  if (currentTrack.value && audioEl.value) {
    pendingSeek = currentTrack.value.startTime !== undefined
    await nextTick()
    audioEl.value.load()
    audioEl.value.play()
  }
})
</script>
