import { describe, expect, it } from 'vitest'

import {
  MAX_INLINE_LATEX_VALUE_CHARS,
  normalizeInlineLatexValue,
} from './inline-latex'

describe('inline latex value normalization', () => {
  it('keeps bounded inline latex values', () => {
    expect(normalizeInlineLatexValue('x^2')).toBe('x^2')
  })

  it('drops oversized inline latex values before storing node attrs', () => {
    expect(normalizeInlineLatexValue('x'.repeat(MAX_INLINE_LATEX_VALUE_CHARS + 1))).toBe('')
  })

  it('drops non-string inline latex values', () => {
    expect(normalizeInlineLatexValue(null)).toBe('')
  })
})
