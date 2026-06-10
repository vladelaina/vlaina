import { describe, expect, it } from 'vitest';
import { assertEditorSafeMarkdownContent } from './noteDocumentPersistence';

function createMultibyteMarkdown(byteTarget: number): string {
  const line = '你'.repeat(1000);
  const lineBytes = new TextEncoder().encode(`${line}\n`).length;
  const lineCount = Math.ceil(byteTarget / lineBytes);
  return Array.from({ length: lineCount }, () => line).join('\n');
}

describe('noteDocumentPersistence content bounds', () => {
  it('rejects markdown that exceeds the byte limit with multibyte text', () => {
    const oversizedMarkdown = createMultibyteMarkdown(11 * 1024 * 1024);

    expect(() => assertEditorSafeMarkdownContent(oversizedMarkdown)).toThrow(
      'Note file is too large to open.'
    );
  });
});
