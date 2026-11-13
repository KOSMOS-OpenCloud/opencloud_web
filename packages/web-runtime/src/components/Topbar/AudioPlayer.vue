<template>
  <!-- Auf dem Mobile wandert der Player ins Dock unter der Topbar (#oc-topbar-dock in TopBar.vue) -->
  <teleport v-if="currentTrack" :to="dockTarget" :disabled="!dockTarget">
    <div
      class="audio-player flex items-center gap-1.5"
      :class="
        isMobile
          ? 'audio-player-docked order-2 my-1 flex-wrap rounded-2xl bg-role-surface text-role-on-surface border border-role-outline-variant pl-1.5 pr-2.5 py-1'
          : 'max-w-md'
      "
    >
      <oc-button
        v-if="isMobile"
        class="audio-player-toggle size-9 rounded-full shrink-0"
        appearance="filled"
        color-role="primary"
        :aria-label="isPlaying ? $gettext('Pause') : $gettext('Play')"
        @click="togglePlayback"
      >
        <oc-icon :name="isPlaying ? 'pause' : 'play'" size="small" />
      </oc-button>
      <select
        v-if="playlist.length > 1"
        class="bg-transparent truncate cursor-pointer"
        :class="
          isMobile
            ? 'text-sm font-semibold flex-1 min-w-0 py-1.5'
            : 'text-xs border border-role-outline rounded px-1 py-0.5 max-w-28'
        "
        :aria-label="$gettext('Select track')"
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
        class="truncate"
        :class="
          isMobile ? 'text-sm font-semibold flex-1 min-w-0 px-1' : 'text-xs max-w-28 hidden sm:inline'
        "
        :title="currentTrack.name"
      >
        {{ currentTrack.name }}
      </span>
      <!-- Eigenes Element für Mehrkanal-Dateien: einmal an WebAudio gebunden, lässt es sich nicht mehr lösen -->
      <audio
        :key="downmixChannels > 0 ? 'downmix' : 'plain'"
        ref="audioEl"
        :controls="!isMobile"
        autoplay
        preload="auto"
        class="h-10 w-64"
        :class="{ hidden: isMobile }"
        @ended="onEnded"
        @loadedmetadata="onLoadedMetadata"
        @play="onPlay"
        @pause="isPlaying = false"
        @timeupdate="onTimeUpdate"
        @durationchange="onDurationChange"
      >
        <source :src="currentTrack.url" />
      </audio>
      <span
        v-if="isMobile"
        class="audio-player-time text-xs tabular-nums text-role-on-surface-variant shrink-0"
        v-text="timeLabel"
      />
      <button
        class="oc-button-raw p-0.5 cursor-pointer hover:opacity-70"
        :aria-label="$gettext('Close audio player')"
        @click="stop"
      >
        <oc-icon name="close" size="small" />
      </button>
      <input
        v-if="isMobile && isSeekable"
        class="audio-player-seek w-full h-1 mx-1.5 mt-0.5 mb-1.5 cursor-pointer accent-role-primary"
        type="range"
        min="0"
        step="1"
        :max="Math.floor(duration)"
        :value="Math.floor(currentTime)"
        :aria-label="$gettext('Playback position')"
        @input="onSeek"
      />
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, ref, unref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useGettext } from 'vue3-gettext'
import { useAudioPlayerStore } from '@opencloud-eu/web-pkg'
import { useIsMobile } from '@opencloud-eu/design-system/composables'
import { AudioDownmix, connectMonoDownmix, probeOpusDownmixChannelCount } from '../../helpers/audioDownmix'

const { $gettext } = useGettext()
const { isMobile } = useIsMobile()
// Das Dock steht erst nach dem Mounten im DOM (kein `defer` am Teleport, siehe SearchBar.vue in web-app-search)
const isMounted = ref(false)
onMounted(() => (isMounted.value = true))
const dockTarget = computed(() => (isMobile.value && isMounted.value ? '#oc-topbar-dock' : null))
const audioPlayerStore = useAudioPlayerStore()
const { currentTrack, playlist } = storeToRefs(audioPlayerStore)
const { selectTrack, stop } = audioPlayerStore
const audioEl = ref<HTMLAudioElement>()

// Mehrkanal-Aufnahmen (ein Sprecher je Kanal): der Browser gäbe nur die ersten zwei Kanäle aus.
// Familie 255 mit mehr als 2 Kanälen → alle Kanäle über WebAudio zu Mono addieren (helpers/audioDownmix.ts). 0 = kein Downmix.
const downmixChannels = ref(0)
let activeDownmix: AudioDownmix | null = null
let downmixElement: HTMLAudioElement | null = null

function closeDownmix() {
  activeDownmix?.close()
  activeDownmix = null
  downmixElement = null
}

function applyDownmix() {
  const audioElement = unref(audioEl)
  if (unref(downmixChannels) === 0 || !audioElement) {
    closeDownmix()
    return
  }
  if (downmixElement === audioElement) {
    // nächster Mehrkanal-Titel im selben Element: die Kette steht schon, nur der Pegel richtet sich neu
    activeDownmix?.setChannelCount(unref(downmixChannels))
    return
  }
  closeDownmix()
  activeDownmix = connectMonoDownmix(audioElement, unref(downmixChannels))
  downmixElement = audioElement
}

function onPlay() {
  isPlaying.value = true
  activeDownmix?.resume()
}

onBeforeUnmount(closeDownmix)

// Zustand für die eigene Bedienung im Dock (auf dem Desktop zeigt der Browser seine Bedienelemente)
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)

// Streams (Radio per m3u) haben keine endliche Dauer → kein Spulen, nur laufende Zeit
const isSeekable = computed(() => Number.isFinite(duration.value) && duration.value > 0)

const formatTime = (seconds: number) => {
  const totalSeconds = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const paddedSeconds = String(totalSeconds % 60).padStart(2, '0')
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${paddedSeconds}`
  }
  return `${minutes}:${paddedSeconds}`
}

const timeLabel = computed(() => {
  if (!isSeekable.value) {
    return formatTime(currentTime.value)
  }
  return `${formatTime(currentTime.value)} / ${formatTime(duration.value)}`
})

const togglePlayback = () => {
  if (!audioEl.value) return
  if (audioEl.value.paused) {
    audioEl.value.play()
    return
  }
  audioEl.value.pause()
}

const onTimeUpdate = () => {
  currentTime.value = audioEl.value?.currentTime ?? 0
}

const onDurationChange = () => {
  duration.value = audioEl.value?.duration ?? 0
}

const onSeek = (e: Event) => {
  if (!audioEl.value) return
  audioEl.value.currentTime = Number((e.target as HTMLInputElement).value)
}

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
  if (!currentTrack.value) {
    downmixChannels.value = 0
    closeDownmix()
    return
  }
  currentTime.value = 0
  duration.value = 0
  const probedTrack = currentTrack.value
  const downmixChannelCount = await probeOpusDownmixChannelCount(probedTrack.url)
  if (currentTrack.value !== probedTrack) {
    // inzwischen wurde ein anderer Titel gewählt
    return
  }
  downmixChannels.value = downmixChannelCount
  await nextTick()
  applyDownmix()
  if (audioEl.value) {
    pendingSeek = currentTrack.value.startTime !== undefined
    audioEl.value.load()
    audioEl.value.play()
  }
})

// Der Wechsel Dock ↔ Topbar hängt das <audio> im DOM um, der Browser pausiert dabei → danach weiterspielen
watch(isMobile, async () => {
  const wasPlaying = isPlaying.value
  await nextTick()
  if (wasPlaying && audioEl.value?.paused) {
    audioEl.value.play()
  }
})
</script>
