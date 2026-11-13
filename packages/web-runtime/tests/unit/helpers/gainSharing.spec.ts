import { GainSharingMixer } from '../../../src/helpers/audioDownmixWorklet/gainSharing'

const SAMPLE_RATE = 48000

function sine(frequency: number, amplitude: number, sampleCount: number): Float32Array {
  return Float32Array.from({ length: sampleCount }, (_, sampleIndex) => {
    return amplitude * Math.sin((2 * Math.PI * frequency * sampleIndex) / SAMPLE_RATE)
  })
}

function peak(samples: Float32Array, from = 0): number {
  return samples.subarray(from).reduce((highest, sample) => Math.max(highest, Math.abs(sample)), 0)
}

function mix(channels: Float32Array[], channelCount = channels.length): Float32Array {
  const mixer = new GainSharingMixer(channelCount, SAMPLE_RATE)
  const output = new Float32Array(channels[0].length)
  mixer.process(channels, output)
  return output
}

describe('GainSharingMixer', () => {
  const settled = SAMPLE_RATE / 2

  it('keeps the level of a single speaker among silent channels', () => {
    const silence = new Float32Array(SAMPLE_RATE)
    const output = mix([silence, sine(440, 0.8, SAMPLE_RATE), silence, silence], 20)
    expect(peak(output, settled)).toBeGreaterThan(0.79)
    expect(peak(output, settled)).toBeLessThanOrEqual(0.8 + 1e-6)
  })

  it('never exceeds the loudest input when all channels carry the same signal', () => {
    const voice = sine(440, 0.9, SAMPLE_RATE)
    const output = mix(Array.from({ length: 20 }, () => voice))
    expect(peak(output)).toBeLessThanOrEqual(0.9 + 1e-6)
    expect(peak(output, settled)).toBeGreaterThan(0.89)
  })

  it('keeps a quieter second speaker audible', () => {
    const loud = sine(440, 0.8, SAMPLE_RATE)
    const quiet = sine(1000, 0.4, SAMPLE_RATE)
    const output = mix([loud, quiet])
    // Gewichte 0,8 und 0,2 (Leistung 4:1) → Anteil des leisen Sprechers 0,2 · 0,4
    const quietShare = output
      .subarray(settled)
      .reduce((sum, sample, sampleIndex) => sum + sample * quiet[settled + sampleIndex - 720], 0)
    expect(quietShare).toBeGreaterThan(0)
    expect(peak(output)).toBeLessThanOrEqual(0.8 + 1e-6)
  })

  it('delays the audio by the lookahead and keeps the word onset', () => {
    const mixer = new GainSharingMixer(2, SAMPLE_RATE)
    const onsetAt = 4800
    const voice = new Float32Array(SAMPLE_RATE / 2)
    voice.set(sine(440, 0.8, voice.length - onsetAt), onsetAt)
    const output = new Float32Array(voice.length)
    mixer.process([voice, new Float32Array(voice.length)], output)
    expect(mixer.latencySamples).toBe(720)
    expect(peak(output.subarray(0, onsetAt + mixer.latencySamples))).toBe(0)
    // erste Halbwelle nach dem Einsatz kommt schon mit vollem Gewicht
    const firstWave = output.subarray(
      onsetAt + mixer.latencySamples,
      onsetAt + mixer.latencySamples + 110
    )
    expect(peak(firstWave)).toBeGreaterThan(0.75)
  })
})
