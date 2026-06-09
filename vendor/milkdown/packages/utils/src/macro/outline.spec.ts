import { editorViewCtx } from '@milkdown/core'
import { describe, expect, it } from 'vitest'

import { outline } from './outline'

describe('outline macro', () => {
  it('collects heading text without reading aggregate textContent', () => {
    const heading = {
      attrs: {
        id: 'heading-id',
        level: 2,
      },
      descendants(callback: (child: { isText?: boolean; text?: string }) => boolean | void) {
        callback({ isText: true, text: 'Hello ' })
        callback({ isText: true, text: 'World' })
      },
      get textContent() {
        throw new Error('aggregate heading textContent should not be read')
      },
      type: { name: 'heading' },
    }
    const doc = {
      descendants(callback: (node: typeof heading) => void) {
        callback(heading)
      },
    }
    const ctx = {
      get(key: unknown) {
        if (key !== editorViewCtx)
          throw new Error('Unexpected context key')
        return { state: { doc } }
      },
    }

    expect(outline()(ctx as never)).toEqual([
      {
        id: 'heading-id',
        level: 2,
        text: 'Hello World',
      },
    ])
  })
})
