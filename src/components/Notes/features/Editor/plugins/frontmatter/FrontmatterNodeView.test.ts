import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import type { EditorView } from '@milkdown/kit/prose/view';
import { FrontmatterNodeView } from './FrontmatterNodeView';

function createMockNode(textContent = 'title: note'): ProseNode {
  return {
    type: { name: 'frontmatter' },
    nodeSize: textContent.length + 2,
    textContent,
  } as unknown as ProseNode;
}

function createMockView(selection = { from: 1, to: 1 }): EditorView {
  return {
    root: document,
    editable: true,
    state: {
      tr: {},
      selection,
      doc: { resolve: vi.fn(() => ({})) },
      schema: {
        text: vi.fn((value: string) => value),
        nodes: {
          paragraph: {
            create: vi.fn(() => ({})),
          },
        },
      },
    },
    dispatch: vi.fn(),
    focus: vi.fn(),
  } as unknown as EditorView;
}

function getCodeMirror(nodeView: FrontmatterNodeView) {
  return (nodeView as unknown as {
    cm: {
      state: {
        selection: { main: { anchor: number; head: number } };
      };
    };
  }).cm;
}

describe('FrontmatterNodeView', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('mirrors an outer ProseMirror selection into the embedded editor', () => {
    const node = createMockNode('title: note');
    const view = createMockView({ from: 1, to: node.textContent.length + 1 });
    const nodeView = new FrontmatterNodeView(node, view, () => 0);
    const cm = getCodeMirror(nodeView);

    nodeView.update(node);

    expect(nodeView.dom.dataset.pmSelected).toBe('true');
    expect(cm.state.selection.main.anchor).toBe(0);
    expect(cm.state.selection.main.head).toBe(node.textContent.length);

    nodeView.destroy();
  });

  it('syncs outer selection changes after document selectionchange', async () => {
    const node = createMockNode('title: note');
    const selection = { from: 1, to: 1 };
    const view = createMockView(selection);
    const nodeView = new FrontmatterNodeView(node, view, () => 0);
    const cm = getCodeMirror(nodeView);

    selection.from = 1;
    selection.to = node.textContent.length + 1;
    document.dispatchEvent(new Event('selectionchange'));
    await new Promise((resolve) => requestAnimationFrame(resolve));

    expect(nodeView.dom.dataset.pmSelected).toBe('true');
    expect(cm.state.selection.main.anchor).toBe(0);
    expect(cm.state.selection.main.head).toBe(node.textContent.length);

    nodeView.destroy();
  });
});
