import { TextSelection } from '@milkdown/kit/prose/state';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleFrontmatterShortcutEnter } from './frontmatterPlugin';

function createView() {
  const tr = {
    doc: { size: 32 },
    replaceWith: vi.fn(() => tr),
    setSelection: vi.fn(() => tr),
    scrollIntoView: vi.fn(() => tr),
  };

  const frontmatterType = {
    create: vi.fn(() => ({ type: 'frontmatter' })),
  };
  const paragraphType = { name: 'paragraph' };
  const container = {
    canReplaceWith: vi.fn(() => true),
  };

  const view = {
    state: {
      doc: {
        childCount: 1,
        child: vi.fn(() => ({ type: { name: 'paragraph' } })),
      },
      selection: {
        empty: true,
        $from: {
          depth: 1,
          parent: {
            type: paragraphType,
            textContent: '---',
            content: { size: 3 },
            nodeSize: 5,
          },
          parentOffset: 3,
          node: vi.fn((depth: number) => (depth === 0 ? container : { type: paragraphType })),
          index: vi.fn(() => 0),
          before: vi.fn(() => 1),
        },
      },
      schema: {
        nodes: {
          frontmatter: frontmatterType,
          paragraph: paragraphType,
        },
      },
      tr,
    },
    dispatch: vi.fn(),
  };

  return { view, tr, frontmatterType, container };
}

describe('handleFrontmatterShortcutEnter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('converts the leading --- paragraph into a frontmatter block', () => {
    const selectionCreateSpy = vi
      .spyOn(TextSelection, 'create')
      .mockReturnValue({ type: 'selection' } as never);
    const { view, tr, frontmatterType } = createView();

    expect(handleFrontmatterShortcutEnter(view as never)).toBe(true);
    expect(frontmatterType.create).toHaveBeenCalled();
    expect(tr.replaceWith).toHaveBeenCalledWith(1, 6, { type: 'frontmatter' });
    expect(selectionCreateSpy).toHaveBeenCalledWith(tr.doc, 2);
    expect(view.dispatch).toHaveBeenCalledWith(tr);
  });

  it('returns false when the shortcut is not in the first top-level paragraph', () => {
    const { view } = createView();
    view.state.selection.$from.index = vi.fn(() => 1);

    expect(handleFrontmatterShortcutEnter(view as never)).toBe(false);
    expect(view.dispatch).not.toHaveBeenCalled();
  });

  it('returns false when a frontmatter block already exists before the paragraph', () => {
    const { view } = createView();
    view.state.doc = {
      childCount: 2,
      child: vi.fn((index: number) => (index === 0 ? { type: { name: 'frontmatter' } } : { type: { name: 'paragraph' } })),
    } as never;
    view.state.selection.$from.index = vi.fn(() => 1);

    expect(handleFrontmatterShortcutEnter(view as never)).toBe(false);
    expect(view.dispatch).not.toHaveBeenCalled();
  });

  it('returns false when the text is not a frontmatter shortcut', () => {
    const { view } = createView();
    view.state.selection.$from.parent.textContent = '--';

    expect(handleFrontmatterShortcutEnter(view as never)).toBe(false);
    expect(view.dispatch).not.toHaveBeenCalled();
  });
});
