import { describe, expect, it } from 'vitest'

import {
  createNodeInParserFail,
  docTypeError,
  MAX_EXCEPTION_SERIALIZED_ARRAY_ITEMS,
  MAX_EXCEPTION_SERIALIZED_OUTPUT_CHARS,
  parserMatchError,
  stringifyForMilkdownError,
} from './index'

describe('exception serialization', () => {
  it('keeps ordinary error data readable', () => {
    expect(docTypeError({ type: 'paragraph' }).message).toBe(
      'Doc type error, unsupported type: {"type":"paragraph"}'
    )
  })

  it('serializes circular data without throwing', () => {
    const value: Record<string, unknown> = { type: 'node' }
    value.self = value

    expect(parserMatchError(value).message).toContain('"self":"[Circular]"')
  })

  it('keeps exception messages bounded for oversized arrays', () => {
    const value = Array.from(
      { length: MAX_EXCEPTION_SERIALIZED_ARRAY_ITEMS + 5 },
      (_, index) => index
    )

    const serialized = stringifyForMilkdownError(value)

    expect(serialized).toContain('[5 more items]')
    expect(serialized.length).toBeLessThanOrEqual(MAX_EXCEPTION_SERIALIZED_OUTPUT_CHARS)
  })

  it('does not let failing toJSON break parser node errors', () => {
    const attrs = {
      toJSON: () => {
        throw new Error('toJSON should not escape error formatting')
      },
    }

    expect(() => createNodeInParserFail({ name: 'paragraph' }, attrs)).not.toThrow()
    expect(createNodeInParserFail({ name: 'paragraph' }, attrs).message).toContain(
      '[Attributes]: [Unserializable].'
    )
  })
})
