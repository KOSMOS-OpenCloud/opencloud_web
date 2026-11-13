import {
  downmixGain,
  isProbeableAudioUrl,
  opusDownmixChannelCount
} from '../../../src/helpers/audioDownmix'

function oggOpusStart(channelCount: number, mappingFamily: number): Uint8Array {
  const fileStart = new Uint8Array(47)
  fileStart.set(new TextEncoder().encode('OggS'), 0)
  fileStart.set(new TextEncoder().encode('OpusHead'), 28)
  fileStart[36] = 1
  fileStart[37] = channelCount
  fileStart[46] = mappingFamily
  return fileStart
}

describe('audioDownmix', () => {
  describe('opusDownmixChannelCount', () => {
    it('returns the channel count for mapping family 255 with more than two channels', () => {
      expect(opusDownmixChannelCount(oggOpusStart(20, 255))).toBe(20)
      expect(opusDownmixChannelCount(oggOpusStart(3, 255))).toBe(3)
    })
    it('returns 0 for surround, stereo and mono files', () => {
      expect(opusDownmixChannelCount(oggOpusStart(6, 1))).toBe(0)
      expect(opusDownmixChannelCount(oggOpusStart(2, 255))).toBe(0)
      expect(opusDownmixChannelCount(oggOpusStart(2, 0))).toBe(0)
      expect(opusDownmixChannelCount(oggOpusStart(1, 0))).toBe(0)
    })
    it('returns 0 for other files and for short input', () => {
      expect(opusDownmixChannelCount(new TextEncoder().encode('ID3'.padEnd(64, ' ')))).toBe(0)
      expect(opusDownmixChannelCount(oggOpusStart(20, 255).subarray(0, 40))).toBe(0)
      const vorbisStart = oggOpusStart(20, 255)
      vorbisStart.set(new TextEncoder().encode('\u0001vorbis '), 28)
      expect(opusDownmixChannelCount(vorbisStart)).toBe(0)
    })
  })
  describe('downmixGain', () => {
    it('scales the sum with 1/sqrt(N), capped at the WebAudio channel limit', () => {
      expect(downmixGain(4)).toBeCloseTo(0.5)
      expect(downmixGain(20)).toBeCloseTo(0.2236, 4)
      expect(downmixGain(255)).toBeCloseTo(downmixGain(32))
    })
  })
  describe('isProbeableAudioUrl', () => {
    it('accepts blob and same-origin urls only', () => {
      expect(isProbeableAudioUrl('blob:' + window.location.origin + '/abc')).toBe(true)
      expect(isProbeableAudioUrl(window.location.origin + '/remote.php/dav/spaces/x/a.ogg')).toBe(
        true
      )
      expect(isProbeableAudioUrl('https://radio.example.org/stream.ogg')).toBe(false)
    })
  })
})
