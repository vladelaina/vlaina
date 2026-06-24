import { describe, expect, it, vi } from 'vitest';
import {
  defaultValueCtx,
  Editor,
  editorViewCtx,
} from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { NodeSelection, TextSelection } from '@milkdown/kit/prose/state';
import { handleMermaidFenceEnter } from './mermaidEnterPlugin';
import { mermaidEditorPluginKey } from './mermaidEditorPluginKey';
import { mermaidPlugin } from './index';

function createView(args?: {
  text?: string;
  parentTypeName?: string;
  empty?: boolean;
  parentOffset?: number;
  canReplaceWith?: boolean;
  hasMermaid?: boolean;
  coordsAtPosThrows?: boolean;
  throwOnTextContent?: boolean;
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
  const parent = {
    type: { name: parentTypeName },
    textBetween: vi.fn(() => text),
    get textContent() {
      if (args?.throwOnTextContent) {
        throw new Error('aggregate paragraph textContent should not be read');
      }
      return text;
    },
    content: { size: text.length },
    nodeSize: text.length + 2,
  };
  const view = {
    state: {
      doc: {
        nodeAt: vi.fn(() => ({
          type: { name: 'mermaid' },
        })),
      },
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
          parent,
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

async function flushScheduledEditorOpen() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('mermaidEnterPlugin', () => {
  it('converts a mermaid fence into a diagram block and schedules the editor open', async () => {
    const { view, tr, dispatch, mermaidType } = createView({ throwOnTextContent: true });

    expect(handleMermaidFenceEnter(view as never)).toBe(true);
    expect(view.state.selection.$from.parent.textBetween).toHaveBeenCalledWith(0, 10, '', '');
    expect(mermaidType.create).toHaveBeenCalledWith({ code: '' });
    expect(tr.replaceWith).toHaveBeenCalledWith(4, 16, {
      type: 'mermaid',
      attrs: { code: '' },
    });
    expect(tr.setMeta).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenNthCalledWith(1, tr);

    await flushScheduledEditorOpen();

    expect(tr.setMeta).toHaveBeenCalledWith(mermaidEditorPluginKey, {
      isOpen: true,
      code: '',
      position: { x: 120, y: 208 },
      nodePos: 4,
      openSource: 'new-empty-block',
    });
    expect(tr.setMeta).toHaveBeenCalledWith('addToHistory', false);
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch).toHaveBeenNthCalledWith(2, tr);
  });

  it('moves the cursor after a mermaid block created from the Enter shortcut', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, '');
      })
      .use(commonmark);

    for (const plugin of mermaidPlugin) {
      editor.use(plugin);
    }

    await editor.create();

    try {
      const view = editor.ctx.get(editorViewCtx);
      const text = '```mermaid';
      const paragraph = view.state.schema.nodes.paragraph.create(
        null,
        view.state.schema.text(text)
      );
      view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, paragraph));
      view.dispatch(view.state.tr.setSelection(
        TextSelection.create(view.state.doc, 1 + text.length)
      ));

      expect(handleMermaidFenceEnter(view)).toBe(true);
      expect(view.state.selection).toBeInstanceOf(TextSelection);
      expect(view.state.selection).not.toBeInstanceOf(NodeSelection);
      expect(view.state.doc.child(0).type.name).toBe('mermaid');
      expect(view.state.doc.child(1).type.name).toBe('paragraph');
    } finally {
      await editor.destroy();
    }
  });

  it('supports flow as a diagram fence alias', () => {
    const { view, mermaidType } = createView({ text: '```flow' });

    expect(handleMermaidFenceEnter(view as never)).toBe(true);
    expect(mermaidType.create).toHaveBeenCalledWith({ code: 'flowchart TD\n' });
  });

  it('supports tilde Mermaid fences', async () => {
    const { view, tr, mermaidType } = createView({ text: '~~~sequence' });

    expect(handleMermaidFenceEnter(view as never)).toBe(true);
    expect(mermaidType.create).toHaveBeenCalledWith({ code: 'sequenceDiagram\n' });
    await flushScheduledEditorOpen();
    expect(tr.setMeta).toHaveBeenCalledWith(
      mermaidEditorPluginKey,
      expect.objectContaining({
        code: 'sequenceDiagram\n',
      })
    );
  });

  it('supports Mermaid detector aliases beyond flowcharts', () => {
    for (const text of ['```C4Context', '```requirementDiagram', '```kanban', '```packet-beta', '```venn-beta']) {
      const { view, mermaidType } = createView({ text });

      expect(handleMermaidFenceEnter(view as never), text).toBe(true);
      expect(mermaidType.create).toHaveBeenCalledWith({
        code: expect.any(String),
      });
    }
  });

  it('falls back to a safe popup position when coordinates cannot be resolved', async () => {
    const { view, tr } = createView({ coordsAtPosThrows: true });

    expect(handleMermaidFenceEnter(view as never)).toBe(true);
    await flushScheduledEditorOpen();
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

  it('does not read oversized paragraph text while checking mermaid fences', () => {
    const { view, dispatch } = createView({
      text: 'x'.repeat(129),
      throwOnTextContent: true,
    });

    expect(handleMermaidFenceEnter(view as never)).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('does not convert four-space indented Mermaid fences', () => {
    const { view, dispatch, mermaidType } = createView({ text: '    ```mermaid' });

    expect(handleMermaidFenceEnter(view as never)).toBe(false);
    expect(mermaidType.create).not.toHaveBeenCalled();
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
