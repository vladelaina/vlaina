import { describe, expect, it, vi } from 'vitest'

import {
  MAX_INLINE_LATEX_EDITOR_VALUE_CHARS,
  readInlineLatexEditorValue,
} from './view'

describe('LatexInlineTooltip value reader', () => {
  it('reads inline latex editor text through a bounded ProseMirror range', () => {
    const textBetween = vi.fn(() => 'x^2')
    const doc = {
      content: { size: 3 },
      textBetween,
      get textContent() {
        throw new Error('aggregate latex editor textContent should not be read')
      },
    }

    expect(readInlineLatexEditorValue(doc)).toBe('x^2')
    expect(textBetween).toHaveBeenCalledWith(0, 3, '\n', '\n')
  })

  it('rejects oversized inline latex editor docs before reading text', () => {
    const textBetween = vi.fn(() => {
      throw new Error('oversized latex editor doc should not be read')
    })
    const doc = {
      content: { size: MAX_INLINE_LATEX_EDITOR_VALUE_CHARS + 1 },
      textBetween,
      get textContent() {
        throw new Error('aggregate latex editor textContent should not be read')
      },
    }

    expect(readInlineLatexEditorValue(doc)).toBeNull()
    expect(textBetween).not.toHaveBeenCalled()
  })
})
