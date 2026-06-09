import { describe, expect, it, vi } from 'vitest'

import {
  MAX_PRISM_CODE_CHARS,
  MAX_PRISM_HAST_DEPTH,
  canHighlightPrismCode,
  flatNodes,
  readHighlightablePrismCode,
} from './get-decorations'

describe('plugin-prism get-decorations', () => {
  it('flattens highlighted HAST nodes without recursion', () => {
    const nodes = [{
      type: 'element',
      tagName: 'span',
      properties: { className: ['token', 'keyword'] },
      children: [{ type: 'text', value: 'const' }],
    }] as any

    expect(flatNodes(nodes)).toEqual([{
      text: 'const',
      className: ['token', 'keyword'],
    }])
  })

  it('rejects over-deep highlighted HAST trees before flattening exhausts the stack', () => {
    let node: any = { type: 'text', value: 'deep' }
    for (let index = 0; index <= MAX_PRISM_HAST_DEPTH + 1; index += 1) {
      node = {
        type: 'element',
        tagName: 'span',
        properties: { className: ['token'] },
        children: [node],
      }
    }

    expect(flatNodes([node])).toBeNull()
  })

  it('skips prism highlighting for oversized code blocks', () => {
    expect(canHighlightPrismCode('x'.repeat(MAX_PRISM_CODE_CHARS))).toBe(true)
    expect(canHighlightPrismCode('x'.repeat(MAX_PRISM_CODE_CHARS + 1))).toBe(false)
  })

  it('skips oversized code blocks without reading aggregate textContent', () => {
    const textBetween = vi.fn(() => {
      throw new Error('oversized code should not be read')
    })
    const node = {
      content: { size: MAX_PRISM_CODE_CHARS + 1 },
      textBetween,
      get textContent() {
        throw new Error('aggregate code textContent should not be read')
      },
    }

    expect(readHighlightablePrismCode(node as any)).toBeNull()
    expect(textBetween).not.toHaveBeenCalled()
  })

  it('reads highlightable code through a bounded ProseMirror range', () => {
    const textBetween = vi.fn(() => 'const value = 1')
    const node = {
      content: { size: 15 },
      textBetween,
      get textContent() {
        throw new Error('aggregate code textContent should not be read')
      },
    }

    expect(readHighlightablePrismCode(node as any)).toBe('const value = 1')
    expect(textBetween).toHaveBeenCalledWith(0, 15, '\n', '\n')
  })
})
