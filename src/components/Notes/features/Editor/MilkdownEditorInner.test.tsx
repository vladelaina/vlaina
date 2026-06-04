import { describe, expect, it, vi } from 'vitest';
import { editorViewCtx, parserCtx } from '@milkdown/kit/core';
import { replaceEditorMarkdown } from './MilkdownEditorInner';

function createContext(parser: (markdown: string) => unknown) {
  const dispatch = vi.fn();
  const replace = vi.fn(() => ({ step: 'replace' }));
  const view = {
    dispatch,
    state: {
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

  return { ctx, dispatch, replace, view };
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
});
