import { describe, expect, it } from 'vitest'

import {
  MAX_PRISM_CODE_CHARS,
  MAX_PRISM_HAST_DEPTH,
  canHighlightPrismCode,
  flatNodes,
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
})
