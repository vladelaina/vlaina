import { expect, it, vi } from 'vitest'

import { splitFirstMarkdownBlock } from './context'

it('extracts the first markdown block without splitting the full string', () => {
  const split = vi.spyOn(String.prototype, 'split').mockImplementation(() => {
    throw new Error('splitFirstMarkdownBlock should not split the full string')
  })

  try {
    expect(splitFirstMarkdownBlock('first\n\nsecond\n\nthird')).toEqual({
      firstBlock: 'first',
      rest: '\n\nsecond\n\nthird',
    })
    expect(splitFirstMarkdownBlock('first')).toEqual({
      firstBlock: 'first',
      rest: '',
    })
  } finally {
    split.mockRestore()
  }
})
