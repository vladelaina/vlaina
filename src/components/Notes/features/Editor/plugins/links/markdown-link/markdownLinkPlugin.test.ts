import { describe, expect, it } from 'vitest';
import { shouldHandleMarkdownLinkPaste } from './markdownLinkPlugin';

describe('shouldHandleMarkdownLinkPaste', () => {
  it('handles single-line markdown link text', () => {
    expect(shouldHandleMarkdownLinkPaste('Read [Docs](https://example.com)')).toBe(true);
  });

  it('handles localized markdown link text', () => {
    expect(shouldHandleMarkdownLinkPaste('阅读【文档】（https://example.com）')).toBe(true);
    expect(shouldHandleMarkdownLinkPaste('阅读[文档】（https://example.com)')).toBe(true);
  });

  it('does not handle multiline markdown content', () => {
    expect(
      shouldHandleMarkdownLinkPaste('# Title\n\n[Docs](https://example.com)\n- item'),
    ).toBe(false);
  });

  it('does not handle structural markdown line with link', () => {
    expect(shouldHandleMarkdownLinkPaste('# [Docs](https://example.com)')).toBe(false);
    expect(shouldHandleMarkdownLinkPaste('- [Docs](https://example.com)')).toBe(false);
    expect(shouldHandleMarkdownLinkPaste('＃ 【文档】（https://example.com）')).toBe(false);
  });

  it('does not handle standalone fenced code block payload', () => {
    expect(
      shouldHandleMarkdownLinkPaste('```markdown\n[Docs](https://example.com)\n```'),
    ).toBe(false);
  });
});
