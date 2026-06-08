import { describe, expect, it, vi } from 'vitest';
import { editorViewCtx, parserCtx } from '@milkdown/kit/core';
import {
  createLargePlainMarkdownDocJSON,
  replaceEditorMarkdown,
} from './MilkdownEditorInner';

function createContext(parser: (markdown: string) => unknown) {
  const dispatch = vi.fn();
  const replace = vi.fn(() => ({ step: 'replace' }));
  const nodeFromJSON = vi.fn((json: unknown) => ({
    content: { type: 'fast-doc-content', json },
  }));
  const view = {
    dispatch,
    state: {
      schema: { nodeFromJSON },
      doc: { content: { size: 12 } },
      tr: { replace },
    },
  };
  const ctx = {
    get: vi.fn((token: unknown) => {
      if (token === editorViewCtx) return view;
      if (token === parserCtx) return parser;
      throw new Error('Unexpected token');
    }),
  };

  return { ctx, dispatch, nodeFromJSON, replace, view };
}

describe('replaceEditorMarkdown', () => {
  it('returns false without dispatching when the parser throws', () => {
    const { ctx, dispatch, replace } = createContext(() => {
      throw new Error('parse failed');
    });

    expect(replaceEditorMarkdown(ctx as never, '# Disk edit')).toBe(false);
    expect(replace).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('returns false without dispatching when the parser cannot create a document', () => {
    const { ctx, dispatch, replace } = createContext(() => null);

    expect(replaceEditorMarkdown(ctx as never, '# Disk edit')).toBe(false);
    expect(replace).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('dispatches a document replacement only after parsing succeeds', () => {
    const doc = { content: { type: 'doc-content' } };
    const { ctx, dispatch, replace } = createContext(() => doc);

    expect(replaceEditorMarkdown(ctx as never, '# Disk edit')).toBe(true);
    expect(replace).toHaveBeenCalledWith(0, 12, expect.objectContaining({
      content: doc.content,
    }));
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('uses the large plain markdown fast document path without calling the parser', () => {
    const parser = vi.fn(() => {
      throw new Error('parser should not run');
    });
    const { ctx, dispatch, nodeFromJSON, replace } = createContext(parser);
    const markdown = [
      '# Large Fast Path',
      '',
      ...Array.from({ length: 1100 }, (_, index) => `Paragraph ${index} ${'plain text '.repeat(90)}`),
    ].join('\n\n');

    expect(replaceEditorMarkdown(ctx as never, markdown)).toBe(true);
    expect(markdown.length).toBeGreaterThan(1_000_000);
    expect(parser).not.toHaveBeenCalled();
    expect(nodeFromJSON).toHaveBeenCalledWith(expect.objectContaining({
      type: 'doc',
      content: expect.arrayContaining([
        expect.objectContaining({ type: 'heading' }),
        expect.objectContaining({ type: 'paragraph' }),
      ]),
    }));
    expect(replace).toHaveBeenCalledWith(0, 12, expect.objectContaining({
      content: expect.objectContaining({ type: 'fast-doc-content' }),
    }));
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('falls back to the parser for complex large markdown', () => {
    const doc = { content: { type: 'parsed-doc-content' } };
    const parser = vi.fn(() => doc);
    const { ctx, nodeFromJSON, replace } = createContext(parser);
    const markdown = [
      '# Large Complex Path',
      '',
      ...Array.from({ length: 1100 }, (_, index) => `Paragraph ${index} with [a link](https://example.com) ${'plain text '.repeat(90)}`),
    ].join('\n\n');

    expect(replaceEditorMarkdown(ctx as never, markdown)).toBe(true);
    expect(markdown.length).toBeGreaterThan(1_000_000);
    expect(nodeFromJSON).not.toHaveBeenCalled();
    expect(parser).toHaveBeenCalledWith(markdown);
    expect(replace).toHaveBeenCalledWith(0, 12, expect.objectContaining({
      content: doc.content,
    }));
  });
});

describe('createLargePlainMarkdownDocJSON', () => {
  it('creates ProseMirror JSON for large headings, paragraphs, and blank line placeholders', () => {
    const markdown = [
      '# Large Fast Path',
      '',
      '<!--vlaina-markdown-blank-line-->',
      '',
      ...Array.from({ length: 1100 }, (_, index) => `Paragraph ${index} ${'plain text '.repeat(90)}`),
    ].join('\n\n');

    expect(markdown.length).toBeGreaterThan(1_000_000);
    const doc = createLargePlainMarkdownDocJSON(markdown);
    expect(doc?.type).toBe('doc');
    expect(doc?.content?.length).toBe(1102);
    expect(doc?.content?.[0]).toEqual({
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: 'Large Fast Path' }],
    });
    expect(doc?.content?.[1]).toEqual({
      type: 'html_block',
      attrs: { value: '<!--vlaina-markdown-blank-line-->' },
    });
    expect(doc?.content?.[2]?.type).toBe('paragraph');
  });

  it('rejects large markdown that needs full markdown parsing', () => {
    const markdown = Array.from(
      { length: 1100 },
      (_, index) => `Paragraph ${index} with **strong** markup ${'plain text '.repeat(90)}`,
    ).join('\n\n');

    expect(markdown.length).toBeGreaterThan(1_000_000);
    expect(createLargePlainMarkdownDocJSON(markdown)).toBeNull();
  });

  it('rejects large markdown with structural list and rule syntax', () => {
    const paragraph = 'plain text '.repeat(120);
    const cases = [
      `- item ${paragraph}`,
      `1. item ${paragraph}`,
      `---`,
    ];

    for (const structuralLine of cases) {
      const markdown = [
        '# Large Structural Document',
        '',
        ...Array.from({ length: 1100 }, (_value, index) => (
          index === 100 ? structuralLine : `Paragraph ${index} ${paragraph}`
        )),
      ].join('\n\n');

      expect(markdown.length).toBeGreaterThan(1_000_000);
      expect(createLargePlainMarkdownDocJSON(markdown)).toBeNull();
    }
  });

  it('normalizes closing atx heading markers on the fast path', () => {
    const markdown = [
      '# Large Fast Path #',
      '',
      ...Array.from({ length: 1100 }, (_, index) => `Paragraph ${index} ${'plain text '.repeat(90)}`),
    ].join('\n\n');

    const doc = createLargePlainMarkdownDocJSON(markdown);

    expect(markdown.length).toBeGreaterThan(1_000_000);
    expect(doc?.content?.[0]).toEqual({
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: 'Large Fast Path' }],
    });
  });
});
