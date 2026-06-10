import { describe, expect, it, vi } from 'vitest';
import {
  MAX_CHAT_MESSAGE_IMAGE_SOURCE_ENTRIES,
  MAX_CHAT_MESSAGE_IMAGE_SOURCES,
} from '@/components/Chat/common/messageClipboard';
import { countFencedCodeBlocks, countRenderableImages } from './chatStreamTextMetadata';

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

  it('bounds renderable image counting for image-heavy stream metadata', () => {
    const markdown = Array.from(
      { length: MAX_CHAT_MESSAGE_IMAGE_SOURCE_ENTRIES + 1 },
      (_, index) => `![image ${index}](https://example.com/${index}.png)`,
    ).join('\n');

    expect(countRenderableImages(markdown)).toBe(MAX_CHAT_MESSAGE_IMAGE_SOURCES);
  });
});
