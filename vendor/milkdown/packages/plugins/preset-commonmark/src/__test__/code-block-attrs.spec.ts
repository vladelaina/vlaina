import { describe, expect, it } from 'vitest'

import {
  MAX_CODE_BLOCK_LANGUAGE_CHARS,
  normalizeCodeBlockLanguageAttr,
} from '../node/code-block'

describe('code block attrs', () => {
  it('normalizes safe language attrs', () => {
    expect(normalizeCodeBlockLanguageAttr(' ts ')).toBe('ts')
    expect(normalizeCodeBlockLanguageAttr('c++')).toBe('c++')
    expect(normalizeCodeBlockLanguageAttr('foo.bar_baz#1-2')).toBe('foo.bar_baz#1-2')
  })

  it('drops unsafe or oversized language attrs', () => {
    expect(normalizeCodeBlockLanguageAttr('two words')).toBe('')
    expect(normalizeCodeBlockLanguageAttr('javascript" onclick="alert(1)')).toBe('')
    expect(normalizeCodeBlockLanguageAttr('x'.repeat(MAX_CODE_BLOCK_LANGUAGE_CHARS + 1))).toBe('')
    expect(normalizeCodeBlockLanguageAttr(null)).toBe('')
  })
})
