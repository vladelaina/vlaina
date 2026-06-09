import { describe, expect, it } from 'vitest'

import { sanitizeIconMarkup } from './icon'

describe('Icon', () => {
  it('sanitizes icon markup', () => {
    expect(sanitizeIconMarkup('<svg onclick="evil()"><path /></svg>')).toBe('<svg><path></path></svg>')
  })

  it('skips oversized icon markup before sanitizing', () => {
    const icon = `${'x'.repeat(64 * 1024 + 1)}<svg></svg>`

    expect(sanitizeIconMarkup(icon)).toBe('')
  })
})
