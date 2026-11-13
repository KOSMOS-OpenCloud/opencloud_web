import gainSharingProcessorUrl from './audioDownmixWorklet/processor?worker&url'
import { GAIN_SHARING_PROCESSOR_NAME } from './audioDownmixWorklet/gainSharing'

// Mehrkanal-Aufnahmen (Ogg/Opus mit einem Sprecher je Kanal, z. B. Meeting-Aufnahmen) haben keine
// Lautsprecher-Zuordnung. Der Browser gibt davon nur die ersten zwei Kanäle aus und verwirft den Rest.
// Für solche Dateien hängt der Player eine WebAudio-Kette hinter das <audio>, die alle Kanäle zu einem
// Signal mischt. Erkannt werden sie an der Kanalzuordnung „Familie 255“ (Kanäle ohne festgelegte Bedeutung) mit
// mehr als zwei Kanälen. Alles andere bleibt unberührt, auch Surround (Familie 1, z. B. 5.1): das rechnet der
// Browser selbst auf die Lautsprecher um.

const OPUS_HEAD_OFFSET = 28
const OPUS_HEAD_CHANNELS_OFFSET = OPUS_HEAD_OFFSET + 9
const OPUS_HEAD_MAPPING_FAMILY_OFFSET = OPUS_HEAD_OFFSET + 18
const OPUS_HEAD_PROBE_BYTES = OPUS_HEAD_MAPPING_FAMILY_OFFSET + 1
const OPUS_MAPPING_FAMILY_DISCRETE = 255

function hasAsciiAt(bytes: Uint8Array, offset: number, text: string): boolean {
  for (let index = 0; index < text.length; index++) {
    if (bytes[offset + index] !== text.charCodeAt(index)) {
      return false
    }
  }
  return true
}

/**
 * Kanalzahl aus dem Anfang einer Ogg/Opus-Datei, wenn der Player sie selbst mischen muss (Familie 255 und
 * mehr als zwei Kanäle); sonst 0.
 */
export function opusDownmixChannelCount(fileStart: Uint8Array): number {
  if (fileStart.length < OPUS_HEAD_PROBE_BYTES) {
    return 0
  }
  if (!hasAsciiAt(fileStart, 0, 'OggS') || !hasAsciiAt(fileStart, OPUS_HEAD_OFFSET, 'OpusHead')) {
    return 0
  }
  if (fileStart[OPUS_HEAD_MAPPING_FAMILY_OFFSET] !== OPUS_MAPPING_FAMILY_DISCRETE) {
    return 0
  }
  const channelCount = fileStart[OPUS_HEAD_CHANNELS_OFFSET]
  return channelCount > 2 ? channelCount : 0
}

/** Nur eigene Adressen und blob:-URLs: fremde Streams (Radio) blieben hinter WebAudio ohne CORS stumm. */
export function isProbeableAudioUrl(url: string): boolean {
  if (url.startsWith('blob:')) {
    return true
  }
  try {
    return new URL(url, window.location.href).origin === window.location.origin
  } catch {
    return false
  }
}

/**
 * Liest den Anfang der Datei und liefert die Kanalzahl, wenn der Player sie selbst mischen muss; sonst 0.
 * Die URL bleibt unverändert (signierte Download-URL), deshalb `cache: 'no-store'` statt Zeitstempel.
 */
export async function probeOpusDownmixChannelCount(
  url: string,
  signal?: AbortSignal
): Promise<number> {
  if (!isProbeableAudioUrl(url)) {
    return 0
  }
  try {
    const response = await fetch(url, {
      headers: { Range: `bytes=0-${OPUS_HEAD_PROBE_BYTES - 1}` },
      cache: 'no-store',
      signal
    })
    if (!response.ok || !response.body) {
      return 0
    }
    // Ignoriert der Server den Range-Kopf, kommt die ganze Datei: nur den Anfang lesen, dann abbrechen
    const reader = response.body.getReader()
    const fileStart = new Uint8Array(OPUS_HEAD_PROBE_BYTES)
    let receivedBytes = 0
    while (receivedBytes < OPUS_HEAD_PROBE_BYTES) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }
      const usableBytes = value.subarray(0, OPUS_HEAD_PROBE_BYTES - receivedBytes)
      fileStart.set(usableBytes, receivedBytes)
      receivedBytes += usableBytes.length
    }
    reader.cancel().catch(() => {})
    return opusDownmixChannelCount(fileStart.subarray(0, receivedBytes))
  } catch {
    return 0
  }
}

/** WebAudio kennt höchstens 32 Kanäle; Kanäle darüber gibt der Downmix nicht wieder. */
export const MAX_DOWNMIX_CHANNELS = 32

/**
 * Pegel der Summe: 1/√N. Bei unabhängigen Quellen bleibt die Lautheit etwa gleich; die reine Summe
 * übersteuert, der Mittelwert 1/N ist zu leise. Spitzen (mehrere Kanäle führen Ähnliches) fängt der Begrenzer.
 */
export function downmixGain(channelCount: number): number {
  return 1 / Math.sqrt(Math.max(1, Math.min(channelCount, MAX_DOWNMIX_CHANNELS)))
}

export interface AudioDownmix {
  /** Kanalzahl des laufenden Titels, bestimmt den Pegel der Summe. */
  setChannelCount: (channelCount: number) => void
  /** Nach einer Nutzeraktion aufrufen (play): Browser starten den AudioContext sonst angehalten. */
  resume: () => void
  close: () => void
}

/**
 * Leitet den Ton des Elements über WebAudio und mischt alle Kanäle zu einem Mono-Signal.
 * Gemischt wird mit dem Gain-Sharing-Mischer (audioDownmixWorklet): jeder Kanal bekommt sein Gewicht nach
 * seinem Anteil an der Gesamtleistung. Bis der Worklet geladen ist, und falls er sich nicht laden lässt,
 * läuft die einfache Summe mit 1/√N und Begrenzer.
 * Ein <audio> lässt sich nur einmal anbinden und danach nicht mehr lösen → für Dateien ohne Downmix
 * ein anderes Element verwenden.
 */
export function connectMonoDownmix(
  audioElement: HTMLAudioElement,
  channelCount: number
): AudioDownmix {
  const audioContext = new AudioContext()
  const elementSource = audioContext.createMediaElementSource(audioElement)
  const channelSplitter = audioContext.createChannelSplitter(MAX_DOWNMIX_CHANNELS)
  const monoSum = audioContext.createGain()
  monoSum.channelCount = 1
  monoSum.channelCountMode = 'explicit'
  elementSource.connect(channelSplitter)
  for (let channel = 0; channel < MAX_DOWNMIX_CHANNELS; channel++) {
    channelSplitter.connect(monoSum, channel)
  }
  monoSum.gain.value = downmixGain(channelCount)
  // Begrenzer hinter der Summe: steile Kennlinie knapp unter Vollaussteuerung
  const limiter = audioContext.createDynamicsCompressor()
  limiter.threshold.value = -3
  limiter.knee.value = 0
  limiter.ratio.value = 20
  limiter.attack.value = 0.003
  limiter.release.value = 0.25
  monoSum.connect(limiter)
  limiter.connect(audioContext.destination)

  let isClosed = false

  async function switchToGainSharing() {
    try {
      await audioContext.audioWorklet.addModule(gainSharingProcessorUrl)
      if (isClosed) {
        return
      }
      const gainSharingNode = new AudioWorkletNode(audioContext, GAIN_SHARING_PROCESSOR_NAME, {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        channelCount: MAX_DOWNMIX_CHANNELS,
        channelCountMode: 'explicit',
        channelInterpretation: 'discrete'
      })
      // Die Gewichte ergeben zusammen 1 → kein Begrenzer nötig
      gainSharingNode.connect(audioContext.destination)
      elementSource.connect(gainSharingNode)
      elementSource.disconnect(channelSplitter)
      limiter.disconnect()
    } catch (workletError) {
      console.warn('audio downmix: gain sharing not available, using plain sum', workletError)
    }
  }
  switchToGainSharing()

  function setChannelCount(nextChannelCount: number) {
    monoSum.gain.value = downmixGain(nextChannelCount)
  }

  function resume() {
    if (audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {})
    }
  }
  function close() {
    isClosed = true
    audioContext.close().catch(() => {})
  }
  return { setChannelCount, resume, close }
}
