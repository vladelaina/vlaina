import { describe, expect, it, vi } from 'vitest';
import { MARKDOWN_CODE_LINE_HEIGHT } from '@/components/common/markdown/markdownMetrics';
import { estimateCodeBlockHeight } from './chatAssistantMarkdownTypography';

describe('estimateCodeBlockHeight', () => {
  it('counts code lines without materializing a line array', () => {
    const splitSpy = vi.spyOn(String.prototype, 'split');

    try {
      const oneLineHeight = estimateCodeBlockHeight('const value = 1;');
      expect(estimateCodeBlockHeight('const value = 1;\n')).toBe(oneLineHeight);
      expect(estimateCodeBlockHeight('const value = 1;\nvalue += 1;')).toBe(
        oneLineHeight + MARKDOWN_CODE_LINE_HEIGHT,
      );
      expect(splitSpy).not.toHaveBeenCalled();
    } finally {
      splitSpy.mockRestore();
    }
  });
});
