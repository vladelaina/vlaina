import { describe, expect, it } from 'vitest'

import { sanitizePreviewContent } from './preview-panel'

describe('code block preview panel', () => {
  it('sanitizes string preview content', () => {
    expect(sanitizePreviewContent('<p onclick="evil()">safe</p>')).toBe('<p>safe</p>')
  })

  it('sanitizes element preview content', () => {
    const element = document.createElement('p')
    element.setAttribute('onclick', 'evil()')
    element.textContent = 'safe'

    expect(sanitizePreviewContent(element)).toBe('<p>safe</p>')
  })

  it('skips oversized preview content before DOM sanitizing', () => {
    const payload = `${'x'.repeat(2 * 1024 * 1024 + 1)}<p>safe</p>`

    expect(sanitizePreviewContent(payload)).toBe('')
  })
})
