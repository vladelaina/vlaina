import { describe, expect, it, vi } from 'vitest';
import { handleMathBlockShortcutEnter } from './mathBlockEnterPlugin';
import { mathClickPluginKey } from './mathClickPlugin';

function createView(args?: {
  text?: string;
  parentTypeName?: string;
  empty?: boolean;
  parentOffset?: number;
  canReplaceWith?: boolean;
  hasMathBlock?: boolean;
  coordsAtPosThrows?: boolean;
}) {
  const text = args?.text ?? '$$';
  const parentTypeName = args?.parentTypeName ?? 'paragraph';
  const empty = args?.empty ?? true;
  const parentOffset = args?.parentOffset ?? text.length;
  const canReplaceWith = args?.canReplaceWith ?? true;
  const hasMathBlock = args?.hasMathBlock ?? true;
  const tr = {
    replaceWith: vi.fn(() => tr),
    setMeta: vi.fn(() => tr),
    scrollIntoView: vi.fn(() => tr),
  };
  const mathBlockType = {
    create: vi.fn((attrs: { latex: string }) => ({ type: 'math_block', attrs })),
  };
  const dispatch = vi.fn();
  const view = {
    state: {
      selection: {
        empty,
        from: 8,
        $from: {
          depth: 1,
          parentOffset,
          before: vi.fn(() => 4),
          index: vi.fn(() => 0),
          node: vi.fn(() => ({
            canReplaceWith: vi.fn(() => canReplaceWith),
          })),
          parent: {
            type: { name: parentTypeName },
            textContent: text,
            content: { size: text.length },
            nodeSize: text.length + 2,
          },
        },
      },
      schema: {
        nodes: {
          math_block: hasMathBlock ? mathBlockType : undefined,
        },
      },
      tr,
    },
    dispatch,
    coordsAtPos: args?.coordsAtPosThrows
      ? vi.fn(() => {
          throw new Error('coords');
        })
      : vi.fn(() => ({
          left: 120,
          bottom: 200,
        })),
  };

  return {
    view,
    tr,
    dispatch,
    mathBlockType,
  };
}

describe('mathBlockEnterPlugin', () => {
  it('converts a shortcut-only paragraph into a math block and opens the editor', () => {
    const { view, tr, dispatch, mathBlockType } = createView({ text: '￥￥' });

    expect(handleMathBlockShortcutEnter(view as never)).toBe(true);
    expect(mathBlockType.create).toHaveBeenCalledWith({ latex: '' });
    expect(tr.replaceWith).toHaveBeenCalledWith(4, 8, {
      type: 'math_block',
      attrs: { latex: '' },
    });
    expect(tr.setMeta).toHaveBeenCalledWith(mathClickPluginKey, {
      isOpen: true,
      latex: '',
      displayMode: true,
      position: { x: 120, y: 208 },
      nodePos: 4,
      removeIfCancelledEmpty: true,
    });
    expect(dispatch).toHaveBeenCalledWith(tr);
  });

  it('falls back to a safe popup position when coordinates cannot be resolved', () => {
    const { view, tr } = createView({ coordsAtPosThrows: true });

    expect(handleMathBlockShortcutEnter(view as never)).toBe(true);
    expect(tr.setMeta).toHaveBeenCalledWith(
      mathClickPluginKey,
      expect.objectContaining({
        position: { x: 16, y: 16 },
      })
    );
  });

  it('does not convert when the paragraph contains more than the shortcut marker', () => {
    const { view, dispatch } = createView({ text: '$$x' });

    expect(handleMathBlockShortcutEnter(view as never)).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('does not convert when the cursor is not at the end of the paragraph', () => {
    const { view, dispatch } = createView({ parentOffset: 1 });

    expect(handleMathBlockShortcutEnter(view as never)).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('does not convert when the current node is not a paragraph', () => {
    const { view, dispatch } = createView({ parentTypeName: 'heading' });

    expect(handleMathBlockShortcutEnter(view as never)).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('does not convert when the selection is not collapsed', () => {
    const { view, dispatch } = createView({ empty: false });

    expect(handleMathBlockShortcutEnter(view as never)).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('does not convert when the schema cannot create a math block', () => {
    const { view, dispatch } = createView({ hasMathBlock: false });

    expect(handleMathBlockShortcutEnter(view as never)).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('does not convert when the surrounding container rejects a math block replacement', () => {
    const { view, dispatch } = createView({ canReplaceWith: false });

    expect(handleMathBlockShortcutEnter(view as never)).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });
});
