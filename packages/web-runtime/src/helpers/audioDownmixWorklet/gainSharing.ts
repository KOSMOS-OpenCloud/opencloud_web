// Gain-Sharing-Mischer (Automixer) für Mehrkanal-Aufnahmen mit einem Sprecher je Kanal.
// Jeder Kanal bekommt in jedem Moment ein Gewicht nach seinem Anteil an der Gesamtleistung:
//   g_i(t) = E_i(t)^p / Σ_j E_j(t)^p,   Ausgang = Σ g_i · x_i
// E_i ist die geglättete Leistung des Kanals. Die Gewichte ergeben zusammen 1: ein einzelner Sprecher
// behält seinen Pegel, mehrere teilen sich den Pegel, die Summe übersteuert nicht.
// Reine Rechnung ohne WebAudio, damit sie sich testen lässt; der Worklet steht in processor.ts.

export const GAIN_SHARING_PROCESSOR_NAME = 'kosmos-gain-sharing-downmix'

export interface GainSharingOptions {
  /** Anstieg der Hüllkurve in ms. */
  attackMs?: number
  /** Abklingen der Hüllkurve in ms; zu kurz → Gewichte flattern zwischen Silben. */
  releaseMs?: number
  /** Vorausschau in ms: der Ton läuft um diese Zeit verzögert, die Gewichte nicht → Wortanfänge bleiben ganz. */
  lookaheadMs?: number
  /** Exponent p; 1 = Anteil an der Leistung, größer trennt schärfer. */
  sharpness?: number
}

export const GAIN_SHARING_DEFAULTS: Required<GainSharingOptions> = {
  attackMs: 10,
  releaseMs: 300,
  lookaheadMs: 15,
  sharpness: 1
}

// Sockel je Kanal: in Pausen (alle Hüllkurven nahe 0) verteilen sich die Gewichte gleichmäßig
const POWER_FLOOR = 1e-10

export class GainSharingMixer {
  private readonly channelCount: number
  private readonly attackCoefficient: number
  private readonly releaseCoefficient: number
  private readonly sharpness: number
  private readonly delaySamples: number
  private readonly envelopes: Float64Array
  private readonly weightedPowers: Float64Array
  private readonly delayLines: Float32Array[]
  private delayPosition = 0

  constructor(channelCount: number, sampleRate: number, options: GainSharingOptions = {}) {
    const settings = { ...GAIN_SHARING_DEFAULTS, ...options }
    this.channelCount = channelCount
    this.attackCoefficient = 1 - Math.exp(-1 / ((settings.attackMs / 1000) * sampleRate))
    this.releaseCoefficient = 1 - Math.exp(-1 / ((settings.releaseMs / 1000) * sampleRate))
    this.sharpness = settings.sharpness
    this.delaySamples = Math.max(1, Math.round((settings.lookaheadMs / 1000) * sampleRate))
    this.envelopes = new Float64Array(channelCount)
    this.weightedPowers = new Float64Array(channelCount)
    this.delayLines = Array.from(
      { length: channelCount },
      () => new Float32Array(this.delaySamples)
    )
  }

  /** Verzögerung des Ausgangs gegenüber dem Eingang in Samples. */
  get latencySamples(): number {
    return this.delaySamples
  }

  /**
   * Mischt einen Block. Fehlende Kanäle (inputChannels kürzer als channelCount) zählen als Stille.
   * Alle Kanäle und output haben dieselbe Länge.
   */
  process(inputChannels: Float32Array[], output: Float32Array): void {
    const usedChannels = Math.min(this.channelCount, inputChannels.length)
    for (let sampleIndex = 0; sampleIndex < output.length; sampleIndex++) {
      let powerSum = 0
      for (let channel = 0; channel < this.channelCount; channel++) {
        const sample = channel < usedChannels ? inputChannels[channel][sampleIndex] : 0
        const power = sample * sample
        const envelope = this.envelopes[channel]
        const coefficient = power > envelope ? this.attackCoefficient : this.releaseCoefficient
        const nextEnvelope = envelope + (power - envelope) * coefficient
        this.envelopes[channel] = nextEnvelope
        const weightedPower =
          (this.sharpness === 1 ? nextEnvelope : Math.pow(nextEnvelope, this.sharpness)) +
          POWER_FLOOR
        this.weightedPowers[channel] = weightedPower
        powerSum += weightedPower
      }
      let mixedSample = 0
      for (let channel = 0; channel < this.channelCount; channel++) {
        const delayLine = this.delayLines[channel]
        // Der verzögerte Ton trifft auf die Gewichte von jetzt
        mixedSample += (this.weightedPowers[channel] / powerSum) * delayLine[this.delayPosition]
        delayLine[this.delayPosition] =
          channel < usedChannels ? inputChannels[channel][sampleIndex] : 0
      }
      output[sampleIndex] = mixedSample
      this.delayPosition = (this.delayPosition + 1) % this.delaySamples
    }
  }
}
