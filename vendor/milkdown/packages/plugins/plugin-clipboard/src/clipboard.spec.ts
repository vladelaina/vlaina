import { describe, expect, it } from 'vitest'

import { parseVscodeEditorDataMode } from './index'

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
