import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearMeasurementCaches,
  getSegmentMetricCache,
  getSegmentMetrics,
  MAX_SEGMENT_METRIC_CACHE_FONTS,
  MAX_SEGMENT_METRICS_PER_FONT,
} from './measurement'

describe('pretext measurement caches', () => {
  beforeEach(() => {
    clearMeasurementCaches()
    vi.stubGlobal('OffscreenCanvas', class {
      getContext() {
        return {
          font: '',
          measureText: (text: string) => ({ width: text.length }),
        }
      }
    })
  })

  afterEach(() => {
    clearMeasurementCaches()
    vi.unstubAllGlobals()
  })

  it('bounds segment metric caches by font', () => {
    const firstFontCache = getSegmentMetricCache('400 15px font-0')

    for (let index = 1; index <= MAX_SEGMENT_METRIC_CACHE_FONTS; index += 1) {
      getSegmentMetricCache(`400 15px font-${index}`)
    }

    expect(getSegmentMetricCache('400 15px font-0')).not.toBe(firstFontCache)
  })

  it('bounds segment metrics within one font cache', () => {
    const cache = getSegmentMetricCache('400 15px sans-serif')
    const firstMetrics = getSegmentMetrics('segment-0', cache)

    for (let index = 1; index <= MAX_SEGMENT_METRICS_PER_FONT; index += 1) {
      getSegmentMetrics(`segment-${index}`, cache)
    }

    expect(cache.size).toBe(MAX_SEGMENT_METRICS_PER_FONT)
    expect(cache.has('segment-0')).toBe(false)
    expect(getSegmentMetrics('segment-0', cache)).not.toBe(firstMetrics)
  })
})
