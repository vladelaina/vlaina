import { describe, expect, it, vi } from 'vitest'
import { analyzeText, type AnalysisProfile } from './analysis'

const profile: AnalysisProfile = {
  breakKeepAllAfterPunctuation: true,
  carryCJKAfterClosingQuote: true,
}

describe('analyzeText', () => {
  it('carries trailing forward-sticky CJK punctuation without materializing text arrays', () => {
    const arrayFrom = Array.from
    const arrayFromSpy = vi.spyOn(Array, 'from').mockImplementation((value: unknown) => {
      if (typeof value === 'string') {
        throw new Error('Array.from should not be used for text analysis strings')
      }
      return arrayFrom(value as never)
    })

    try {
      const analysis = analyzeText('你「好」嗎', profile)

      expect(analysis.texts.join('')).toBe('你「好」嗎')
    } finally {
      arrayFromSpy.mockRestore()
    }
  })
})
