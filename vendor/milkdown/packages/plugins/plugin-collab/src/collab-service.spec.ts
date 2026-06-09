import { describe, expect, it } from 'vitest'

import { isEmptyCollabTemplateDocument } from './collab-service'

describe('collab template defaults', () => {
  it('checks empty template docs without reading aggregate textContent', () => {
    const node = {
      childCount: 1,
      content: { size: 3 },
      get textContent() {
        throw new Error('aggregate collab document textContent should not be read')
      },
    }

    expect(isEmptyCollabTemplateDocument(node as never)).toBe(false)
    expect(isEmptyCollabTemplateDocument({ childCount: 0, content: { size: 0 } } as never)).toBe(true)
  })
})
