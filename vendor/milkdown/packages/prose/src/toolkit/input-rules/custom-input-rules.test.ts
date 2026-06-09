import { describe, expect, it } from 'vitest'

import { textMayTriggerInputRule } from './custom-input-rules'

describe('textMayTriggerInputRule', () => {
  it('skips ordinary text that cannot complete markdown input rules', () => {
    expect(textMayTriggerInputRule('a')).toBe(false)
    expect(textMayTriggerInputRule('中')).toBe(false)
    expect(textMayTriggerInputRule('7')).toBe(false)
  })

  it('keeps markdown delimiters, whitespace, and composition flushes on the input-rule path', () => {
    for (const text of ['', ' ', '\n', '|', '#', '*', '_', '`', '~', '$', ']', ')', '.']) {
      expect(textMayTriggerInputRule(text)).toBe(true)
    }
  })
})
