import { describe, expect, it, vi } from 'vitest';
import {
  createMarkdownLinkPasteNodes,
  MAX_MARKDOWN_LINK_PASTE_NODES,
} from './markdownLinkPlugin';

function createMockSchema() {
  return {
    text: vi.fn((text: string, marks?: readonly unknown[]) => ({
      marks: marks ?? [],
      text,
      type: 'text',
    })),
  };
}

describe('createMarkdownLinkPasteNodes', () => {
  it('creates bounded text nodes for markdown link paste payloads', () => {
    const schema = createMockSchema();
    const linkMarkType = {
      create: vi.fn((attrs: { href: string }) => ({ attrs, type: 'link' })),
    };

    const nodes = createMarkdownLinkPasteNodes(
      '[Docs](https://example.com) and [Site](catim.md)',
      schema as never,
      linkMarkType,
    ) as unknown as Array<{ marks: ReadonlyArray<{ attrs: { href: string } }>; text: string }>;

    expect(nodes.map((node) => node.text)).toEqual(['Docs', ' and ', 'Site']);
    expect(nodes[0]?.marks[0]?.attrs.href).toBe('https://example.com');
    expect(nodes[2]?.marks[0]?.attrs.href).toBe('https://catim.md');
  });

  it('returns null instead of creating oversized paste node lists', () => {
    const schema = createMockSchema();
    const linkMarkType = {
      create: vi.fn((attrs: { href: string }) => ({ attrs, type: 'link' })),
    };
    const text = Array.from(
      { length: MAX_MARKDOWN_LINK_PASTE_NODES + 1 },
      (_value, index) => `[${index}](https://example.com/${index})`,
    ).join(' ');

    expect(createMarkdownLinkPasteNodes(text, schema as never, linkMarkType)).toBeNull();
  });
});
