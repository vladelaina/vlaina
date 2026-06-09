import { describe, expect, it } from 'vitest'

import {
  canParseClipboardPayload,
  maxClipboardHtmlChars,
  maxClipboardTextChars,
  parseVscodeEditorDataMode,
} from './index'

describe('parseVscodeEditorDataMode', () => {
  it('extracts bounded VSCode language modes', () => {
    expect(parseVscodeEditorDataMode('{"mode":"typescript"}')).toBe('typescript')
  })

  it('ignores malformed and oversized VSCode clipboard metadata', () => {
    expect(parseVscodeEditorDataMode('{')).toBeNull()
    expect(parseVscodeEditorDataMode(JSON.stringify({ mode: 'x'.repeat(129) }))).toBeNull()
    expect(parseVscodeEditorDataMode(' '.repeat(16 * 1024 + 1))).toBeNull()
  })
})

describe('canParseClipboardPayload', () => {
  it('accepts bounded clipboard payloads', () => {
    expect(canParseClipboardPayload('text', '<p>html</p>')).toBe(true)
  })

  it('rejects oversized clipboard text or html before DOM and markdown parsing', () => {
    expect(canParseClipboardPayload('x'.repeat(maxClipboardTextChars + 1), '')).toBe(false)
    expect(canParseClipboardPayload('', 'x'.repeat(maxClipboardHtmlChars + 1))).toBe(false)
  })
})
