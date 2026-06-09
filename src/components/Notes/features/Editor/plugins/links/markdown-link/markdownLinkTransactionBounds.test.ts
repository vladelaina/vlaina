import { describe, expect, it, vi } from 'vitest';
import {
  MAX_MARKDOWN_LINK_TRANSACTION_STEP_TEXT_CHARS,
  transactionMayCreateMarkdownLink,
} from './markdownLinkPlugin';

describe('markdown link transaction bounds', () => {
  it('bounds inserted transaction text checks for markdown links', () => {
    const smallContent = {
      size: 12,
      textBetween: vi.fn(() => 'plain text'),
    };
    const largeContent = {
      size: MAX_MARKDOWN_LINK_TRANSACTION_STEP_TEXT_CHARS + 1,
      textBetween: vi.fn(() => {
        throw new Error('oversized markdown link transaction text should not be read');
      }),
    };

    expect(transactionMayCreateMarkdownLink({ steps: [{ slice: { content: smallContent } }] })).toBe(false);
    expect(smallContent.textBetween).toHaveBeenCalledWith(0, 12, '\n', '\ufffc');
    expect(transactionMayCreateMarkdownLink({ steps: [{ slice: { content: largeContent } }] })).toBe(true);
    expect(largeContent.textBetween).not.toHaveBeenCalled();
  });
});
