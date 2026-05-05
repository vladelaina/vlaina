import { describe, expect, it, vi } from 'vitest';
import { handleMermaidFenceEnter } from './mermaidEnterPlugin';
import { mermaidEditorPluginKey } from './mermaidEditorPluginKey';

function createView(args?: {
  text?: string;
  parentTypeName?: string;
  empty?: boolean;
  parentOffset?: number;
  canReplaceWith?: boolean;
  hasMermaid?: boolean;
  coordsAtPosThrows?: boolean;
}) {
  const text = args?.text ?? '```mermaid';
  const parentTypeName = args?.parentTypeName ?? 'paragraph';
  const empty = args?.empty ?? true;
  const parentOffset = args?.parentOffset ?? text.length;
  const canReplaceWith = args?.canReplaceWith ?? true;
  const hasMermaid = args?.hasMermaid ?? true;
  const tr = {
    replaceWith: vi.fn(() => tr),
    setMeta: vi.fn(() => tr),
    scrollIntoView: vi.fn(() => tr),
  };
  const mermaidType = {
    create: vi.fn((attrs: { code: string }) => ({ type: 'mermaid', attrs })),
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
          mermaid: hasMermaid ? mermaidType : undefined,
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
    mermaidType,
  };
}

describe('mermaidEnterPlugin', () => {
  it('converts a mermaid fence into a diagram block and opens the editor', () => {
    const { view, tr, dispatch, mermaidType } = createView();

    expect(handleMermaidFenceEnter(view as never)).toBe(true);
    expect(mermaidType.create).toHaveBeenCalledWith({ code: '' });
    expect(tr.replaceWith).toHaveBeenCalledWith(4, 16, {
      type: 'mermaid',
      attrs: { code: '' },
    });
    expect(tr.setMeta).toHaveBeenCalledWith(mermaidEditorPluginKey, {
      isOpen: true,
      code: '',
      position: { x: 120, y: 208 },
      nodePos: 4,
      openSource: 'new-empty-block',
    });
    expect(dispatch).toHaveBeenCalledWith(tr);
  });

  it('supports flow as a diagram fence alias', () => {
    const { view, mermaidType } = createView({ text: '```flow' });

    expect(handleMermaidFenceEnter(view as never)).toBe(true);
    expect(mermaidType.create).toHaveBeenCalledWith({ code: '' });
  });

  it('supports Mermaid detector aliases beyond flowcharts', () => {
    for (const text of ['```C4Context', '```requirementDiagram', '```kanban', '```packet-beta', '```venn-beta']) {
      const { view, mermaidType } = createView({ text });

      expect(handleMermaidFenceEnter(view as never), text).toBe(true);
      expect(mermaidType.create).toHaveBeenCalledWith({ code: '' });
    }
  });

  it('falls back to a safe popup position when coordinates cannot be resolved', () => {
    const { view, tr } = createView({ coordsAtPosThrows: true });

    expect(handleMermaidFenceEnter(view as never)).toBe(true);
    expect(tr.setMeta).toHaveBeenCalledWith(
      mermaidEditorPluginKey,
      expect.objectContaining({
        position: { x: 16, y: 16 },
      })
    );
  });

  it('does not convert normal code fences', () => {
    const { view, dispatch } = createView({ text: '```ts' });

    expect(handleMermaidFenceEnter(view as never)).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('does not convert when the cursor is not at the end of the paragraph', () => {
    const { view, dispatch } = createView({ parentOffset: 1 });

    expect(handleMermaidFenceEnter(view as never)).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('does not convert when the current node is not a paragraph', () => {
    const { view, dispatch } = createView({ parentTypeName: 'heading' });

    expect(handleMermaidFenceEnter(view as never)).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('does not convert when the selection is not collapsed', () => {
    const { view, dispatch } = createView({ empty: false });

    expect(handleMermaidFenceEnter(view as never)).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('does not convert when the schema cannot create a mermaid block', () => {
    const { view, dispatch } = createView({ hasMermaid: false });

    expect(handleMermaidFenceEnter(view as never)).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('does not convert when the surrounding container rejects a mermaid block replacement', () => {
    const { view, dispatch } = createView({ canReplaceWith: false });

    expect(handleMermaidFenceEnter(view as never)).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });
});
