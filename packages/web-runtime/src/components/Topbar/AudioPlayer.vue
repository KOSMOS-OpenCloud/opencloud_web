<template>
  <div v-if="currentTrack" class="flex items-center gap-2 max-w-md">
    <audio
      ref="audioEl"
      controls
      autoplay
      preload="auto"
      class="h-8 max-w-xs"
      @ended="stop"
    >
      <source :src="currentTrack.url" />
    </audio>
    <span class="text-xs truncate max-w-24 hidden sm:inline" :title="currentTrack.name">
      {{ currentTrack.name }}
    </span>
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
import { ref, watch } from 'vue'
import { useAudioPlayerStore } from '@opencloud-eu/web-pkg'

const audioPlayerStore = useAudioPlayerStore()
const { currentTrack } = storeToRefs(audioPlayerStore)
const { stop } = audioPlayerStore
const audioEl = ref<HTMLAudioElement>()

watch(currentTrack, (track) => {
  if (track && audioEl.value) {
    audioEl.value.load()
    audioEl.value.play()
  }
})
</script>
