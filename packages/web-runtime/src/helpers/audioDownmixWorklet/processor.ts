// AudioWorklet des Gain-Sharing-Mischers. Wird als eigene Datei ausgeliefert und über
// audioContext.audioWorklet.addModule geladen (siehe helpers/audioDownmix.ts).
import { GAIN_SHARING_PROCESSOR_NAME, GainSharingMixer } from './gainSharing'

// Die Typen des Worklet-Gültigkeitsbereichs fehlen in der DOM-Bibliothek von TypeScript
declare const sampleRate: number
declare function registerProcessor(name: string, processorClass: unknown): void
declare class AudioWorkletProcessor {
  constructor()
}

class GainSharingProcessor extends AudioWorkletProcessor {
  private mixer: GainSharingMixer | null = null

  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const inputChannels = inputs[0]
    const output = outputs[0]?.[0]
    if (!output || !inputChannels || inputChannels.length === 0) {
      return true
    }
    if (!this.mixer) {
      this.mixer = new GainSharingMixer(inputChannels.length, sampleRate)
    }
    this.mixer.process(inputChannels, output)
    return true
  }
}

registerProcessor(GAIN_SHARING_PROCESSOR_NAME, GainSharingProcessor)
