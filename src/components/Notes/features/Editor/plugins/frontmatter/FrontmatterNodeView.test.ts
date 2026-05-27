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
      dispatch: (spec: unknown) => void;
      state: {
        selection: { main: { anchor: number; head: number } };
      };
    };
  }).cm;
}

function getPendingMeasureFrame(nodeView: FrontmatterNodeView) {
  return (nodeView as unknown as { pendingMeasureFrame: number | null }).pendingMeasureFrame;
}

function clearPendingMeasureFrame(nodeView: FrontmatterNodeView) {
  (nodeView as unknown as { pendingMeasureFrame: number | null }).pendingMeasureFrame = null;
}

describe('FrontmatterNodeView', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('does not re-dispatch or schedule measurement for unchanged content', () => {
    const node = createMockNode('title: note');
    const nodeView = new FrontmatterNodeView(node, createMockView(), () => 0);
    const cm = getCodeMirror(nodeView);
    const dispatchSpy = vi.spyOn(cm, 'dispatch');
    clearPendingMeasureFrame(nodeView);

    nodeView.update(node);

    expect(dispatchSpy).not.toHaveBeenCalled();
    expect(getPendingMeasureFrame(nodeView)).toBeNull();
    nodeView.destroy();
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

  it('lets block-level clipboard events, delete keys, and legacy shortcut keys reach ProseMirror while selected', () => {
    const node = createMockNode('title: note');
    const view = createMockView({ from: 1, to: node.textContent.length + 1 });
    const nodeView = new FrontmatterNodeView(node, view, () => 0);
    const insideTarget = nodeView.dom.querySelector('.frontmatter-block-editor') as HTMLElement;

    nodeView.dom.classList.add('vlaina-block-selected');

    const copy = new Event('copy', { bubbles: true, cancelable: true });
    Object.defineProperty(copy, 'target', { value: insideTarget });
    const cut = new Event('cut', { bubbles: true, cancelable: true });
    Object.defineProperty(cut, 'target', { value: insideTarget });
    const paste = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(paste, 'target', { value: insideTarget });
    const backspace = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true });
    Object.defineProperty(backspace, 'target', { value: insideTarget });
    const ctrlInsert = new KeyboardEvent('keydown', { key: 'Insert', ctrlKey: true, bubbles: true, cancelable: true });
    Object.defineProperty(ctrlInsert, 'target', { value: insideTarget });
    const shiftInsert = new KeyboardEvent('keydown', { key: 'Insert', shiftKey: true, bubbles: true, cancelable: true });
    Object.defineProperty(shiftInsert, 'target', { value: insideTarget });

    expect(nodeView.stopEvent(copy)).toBe(false);
    expect(nodeView.stopEvent(cut)).toBe(false);
    expect(nodeView.stopEvent(paste)).toBe(false);
    expect(nodeView.stopEvent(backspace)).toBe(false);
    expect(nodeView.stopEvent(ctrlInsert)).toBe(false);
    expect(nodeView.stopEvent(shiftInsert)).toBe(false);

    nodeView.destroy();
  });
});
