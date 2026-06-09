import { describe, expect, it } from 'vitest'

import {
  MAX_IMAGE_BLOCK_CAPTION_CHARS,
  normalizeImageBlockCaption,
  normalizeImageBlockRatio,
} from './schema'

describe('image block schema attrs', () => {
  it('bounds caption metadata', () => {
    expect(normalizeImageBlockCaption('Caption')).toBe('Caption')
    expect(normalizeImageBlockCaption('x'.repeat(MAX_IMAGE_BLOCK_CAPTION_CHARS + 1))).toHaveLength(
      MAX_IMAGE_BLOCK_CAPTION_CHARS
    )
    expect(normalizeImageBlockCaption(null)).toBe('')
  })

  it('normalizes invalid and oversized ratios', () => {
    expect(normalizeImageBlockRatio('1.5')).toBe(1.5)
    expect(normalizeImageBlockRatio('0')).toBe(1)
    expect(normalizeImageBlockRatio('not-a-number')).toBe(1)
    expect(normalizeImageBlockRatio(1000)).toBe(100)
  })
})
