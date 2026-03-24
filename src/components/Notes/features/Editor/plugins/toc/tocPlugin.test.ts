import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleTocShortcutEnter } from './tocPlugin';
import { isTocShortcutText } from './tocShortcut';

describe('tocShortcut', () => {
  it('matches toc shortcuts case-insensitively after trimming', () => {
    expect(isTocShortcutText('[toc]')).toBe(true);
    expect(isTocShortcutText(' [TOC] ')).toBe(true);
    expect(isTocShortcutText('{:toc}')).toBe(true);
    expect(isTocShortcutText(' {:TOC} ')).toBe(true);
    expect(isTocShortcutText('[toc')).toBe(false);
    expect(isTocShortcutText('{toc}')).toBe(false);
  });
});

function createView() {
  const tr = {
    replaceWith: vi.fn(() => tr),
    scrollIntoView: vi.fn(() => tr),
  };

  const view = {
    state: {
      selection: {
        empty: true,
        $from: {
          depth: 1,
          parentOffset: 5,
          parent: {
            type: { name: 'paragraph' },
            textContent: '[toc]',
            content: { size: 5 },
            nodeSize: 7,
          },
          node: vi.fn((depth: number) => {
            if (depth === 0) {
              return { canReplaceWith: vi.fn(() => true) };
            }
            return null;
          }),
          index: vi.fn(() => 0),
          before: vi.fn(() => 4),
        },
      },
      schema: {
        nodes: {
          toc: {
            create: vi.fn((attrs: unknown) => ({ attrs })),
          },
        },
      },
      tr,
    },
    dispatch: vi.fn(),
  };

  return { view, tr };
}

describe('handleTocShortcutEnter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('converts a standalone [toc] paragraph into a toc node on Enter', () => {
    const { view, tr } = createView();

    expect(handleTocShortcutEnter(view as never)).toBe(true);
    expect(view.state.schema.nodes.toc.create).toHaveBeenCalledWith({ maxLevel: 6 });
    expect(tr.replaceWith).toHaveBeenCalledWith(4, 11, { attrs: { maxLevel: 6 } });
    expect(view.dispatch).toHaveBeenCalledWith(tr);
  });

  it('converts a standalone {:toc} paragraph into a toc node on Enter', () => {
    const { view, tr } = createView();
    view.state.selection.$from.parent.textContent = '{:toc}';
    view.state.selection.$from.parentOffset = 6;
    view.state.selection.$from.parent.content.size = 6;
    view.state.selection.$from.parent.nodeSize = 8;

    expect(handleTocShortcutEnter(view as never)).toBe(true);
    expect(view.state.schema.nodes.toc.create).toHaveBeenCalledWith({ maxLevel: 6 });
    expect(tr.replaceWith).toHaveBeenCalledWith(4, 12, { attrs: { maxLevel: 6 } });
    expect(view.dispatch).toHaveBeenCalledWith(tr);
  });

  it('returns false when the paragraph text is not a toc shortcut', () => {
    const { view } = createView();
    view.state.selection.$from.parent.textContent = '[to]';

    expect(handleTocShortcutEnter(view as never)).toBe(false);
    expect(view.dispatch).not.toHaveBeenCalled();
  });

  it('returns false when the cursor is not at the end of the paragraph', () => {
    const { view } = createView();
    view.state.selection.$from.parentOffset = 2;

    expect(handleTocShortcutEnter(view as never)).toBe(false);
    expect(view.dispatch).not.toHaveBeenCalled();
  });
});
