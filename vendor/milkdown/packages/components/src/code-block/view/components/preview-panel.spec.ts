import { describe, expect, it } from 'vitest'

import {
  isPreviewHtmlWithinDomBudget,
  maxPreviewHtmlDepth,
  maxPreviewHtmlNodes,
  sanitizePreviewContent,
} from './preview-panel'

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

  it('skips preview content with too many DOM nodes', () => {
    const payload = '<span></span>'.repeat(maxPreviewHtmlNodes + 1)

    expect(isPreviewHtmlWithinDomBudget(payload)).toBe(false)
    expect(sanitizePreviewContent(payload)).toBe('')
  })

  it('skips deeply nested preview content', () => {
    const payload = `${'<div>'.repeat(maxPreviewHtmlDepth + 1)}safe${'</div>'.repeat(maxPreviewHtmlDepth + 1)}`

    expect(isPreviewHtmlWithinDomBudget(payload)).toBe(false)
    expect(sanitizePreviewContent(payload)).toBe('')
  })
})
