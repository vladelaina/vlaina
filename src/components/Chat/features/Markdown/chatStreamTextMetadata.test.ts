import { describe, expect, it, vi } from 'vitest';
import { countFencedCodeBlocks } from './chatStreamTextMetadata';

describe('chat stream text metadata', () => {
  it('counts CRLF fenced code blocks without materializing line arrays', () => {
    const splitSpy = vi.spyOn(String.prototype, 'split');
    const markdown = [
      '````ts',
      '```',
      'const value = 1;',
      '````',
      '',
      '~~~mermaid',
      'graph TD',
      '~~~',
    ].join('\r\n');

    try {
      expect(countFencedCodeBlocks(markdown)).toBe(2);
      expect(splitSpy).not.toHaveBeenCalled();
    } finally {
      splitSpy.mockRestore();
    }
  });
});
