import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import type { EditorView } from '@milkdown/kit/prose/view';
import { CodeBlockNodeView } from './CodeBlockNodeView';

const renderMock = vi.fn();
const unmountMock = vi.fn();

vi.mock('react-dom/client', () => ({
  createRoot: vi.fn(() => ({
    render: renderMock,
    unmount: unmountMock,
  })),
}));

function createMockNode(collapsed = false): ProseNode {
  return {
    attrs: { collapsed, language: 'ts', lineNumbers: true, wrap: false },
    type: { name: 'code_block' },
    nodeSize: 6,
    textContent: 'const a = 1;',
  } as unknown as ProseNode;
}

function createMockNodeWithText(textContent: string, collapsed = false): ProseNode {
  return {
    attrs: { collapsed, language: 'ts', lineNumbers: true, wrap: false },
    type: { name: 'code_block' },
    nodeSize: textContent.length + 2,
    textContent,
  } as unknown as ProseNode;
}

function createMockSelection(from: number, to: number) {
  return {
    from,
    to,
    empty: from === to,
    $from: {},
    $to: {},
    eq: vi.fn(() => false),
  };
}

function createMockView(): EditorView {
  const tr = {
    setSelection: vi.fn(() => tr),
    insertText: vi.fn(() => tr),
    replaceWith: vi.fn(() => tr),
    delete: vi.fn(() => tr),
  };

  return {
    root: document,
    editable: true,
    state: {
      tr,
      selection: createMockSelection(1, 1),
      doc: { resolve: vi.fn(() => ({})) },
      schema: {
        text: vi.fn((value: string) => value),
        nodes: {
          paragraph: {
            createChecked: vi.fn(() => ({})),
          },
        },
      },
    },
    dispatch: vi.fn(),
    focus: vi.fn(),
  } as unknown as EditorView;
}

function getCodeMirror(nodeView: CodeBlockNodeView) {
  return (nodeView as unknown as {
    cm: {
      dispatch: (spec: unknown) => void;
      focus: () => void;
      state: {
        doc: { toString: () => string };
        selection: { main: { anchor: number; head: number } };
      };
    };
  }).cm;
}

describe('CodeBlockNodeView', () => {
  beforeEach(() => {
    renderMock.mockClear();
    unmountMock.mockClear();
    document.body.innerHTML = '';
  });

  it('keeps header controls non-editable and does not expose a ProseMirror contentDOM', () => {
    const nodeView = new CodeBlockNodeView(createMockNode(false), createMockView(), () => 1);

    expect(nodeView.headerDOM.contentEditable).toBe('false');
    expect(nodeView.dom.contentEditable).not.toBe('false');
    expect(nodeView.contentDOM).toBeUndefined();
  });

  it('does not ignore selection mutation', () => {
    const nodeView = new CodeBlockNodeView(createMockNode(false), createMockView(), () => 1);

    const result = nodeView.ignoreMutation({
      type: 'selection',
      target: nodeView.dom,
    });

    expect(result).toBe(false);
  });

  it('ignores code editor DOM mutations', () => {
    const nodeView = new CodeBlockNodeView(createMockNode(false), createMockView(), () => 1);
    const host = nodeView.dom.querySelector('.code-block-editable');
    const textNode = document.createTextNode('x');
    host?.appendChild(textNode);

    const result = nodeView.ignoreMutation({
      type: 'characterData',
      target: textNode,
    } as unknown as MutationRecord);

    expect(result).toBe(true);
  });

  it('ignores header/UI-only mutations', () => {
    const nodeView = new CodeBlockNodeView(createMockNode(false), createMockView(), () => 1);

    const result = nodeView.ignoreMutation({
      type: 'attributes',
      target: nodeView.headerDOM,
    } as unknown as MutationRecord);

    expect(result).toBe(true);
  });

  it('normalizes external CRLF content before syncing it into CodeMirror', () => {
    const nodeView = new CodeBlockNodeView(
      createMockNodeWithText('const a = 1;\nconst b = 2;'),
      createMockView(),
      () => 1
    );
    const cm = getCodeMirror(nodeView);

    cm.dispatch({
      selection: {
        anchor: 8,
        head: 8,
      },
    });

    nodeView.update(createMockNodeWithText('const a = 1;\r\nconst b = 2;'));

    expect(cm.state.doc.toString()).toBe('const a = 1;\nconst b = 2;');
    expect(cm.state.selection.main.anchor).toBe(8);
  });

  it('returns false when asked to update with a different node type', () => {
    const nodeView = new CodeBlockNodeView(createMockNode(false), createMockView(), () => 1);

    expect(
      nodeView.update({
        ...createMockNode(false),
        type: { name: 'paragraph' },
      } as unknown as ProseNode)
    ).toBe(false);
  });

  it('stops events originating inside the node view and ignores outside events', () => {
    const nodeView = new CodeBlockNodeView(createMockNode(false), createMockView(), () => 1);
    const insideTarget = nodeView.dom.querySelector('.code-block-editable') as HTMLElement;
    const outsideTarget = document.createElement('div');

    expect(nodeView.stopEvent({ target: insideTarget } as unknown as Event)).toBe(true);
    expect(nodeView.stopEvent({ target: outsideTarget } as unknown as Event)).toBe(false);
  });

  it('lets block-level delete shortcuts reach ProseMirror while the code block is selected', () => {
    const nodeView = new CodeBlockNodeView(createMockNode(false), createMockView(), () => 1);
    const insideTarget = nodeView.dom.querySelector('.code-block-editable') as HTMLElement;
    nodeView.dom.classList.add('vlaina-block-selected');

    const backspace = new KeyboardEvent('keydown', {
      key: 'Backspace',
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(backspace, 'target', {
      value: insideTarget,
    });

    expect(nodeView.stopEvent(backspace)).toBe(false);
  });

  it('focuses and decorates the code block when selected, then removes the decoration when deselected', () => {
    const nodeView = new CodeBlockNodeView(createMockNode(false), createMockView(), () => 1);
    const cm = getCodeMirror(nodeView);
    const focusSpy = vi.spyOn(cm, 'focus');

    nodeView.selectNode();
    expect(nodeView.dom.classList.contains('ProseMirror-selectednode')).toBe(true);
    expect(focusSpy).toHaveBeenCalledTimes(1);

    nodeView.deselectNode();
    expect(nodeView.dom.classList.contains('ProseMirror-selectednode')).toBe(false);
  });

  it('does not apply a CodeMirror selection when the block is collapsed', () => {
    const nodeView = new CodeBlockNodeView(createMockNode(true), createMockView(), () => 1);
    const cm = getCodeMirror(nodeView);
    const dispatchSpy = vi.spyOn(cm, 'dispatch');

    nodeView.setSelection(2, 4);

    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it('syncs ProseMirror selections into CodeMirror when the block is expanded', () => {
    const nodeView = new CodeBlockNodeView(createMockNode(false), createMockView(), () => 1);
    const cm = getCodeMirror(nodeView);
    document.body.appendChild(nodeView.dom);

    nodeView.setSelection(2, 4);

    expect(cm.state.selection.main.anchor).toBe(2);
    expect(cm.state.selection.main.head).toBe(4);
    nodeView.destroy();
  });

  it('maps raw ProseMirror CRLF offsets into normalized CodeMirror selections', () => {
    const nodeView = new CodeBlockNodeView(
      createMockNodeWithText('a\r\nb\r\ncd'),
      createMockView(),
      () => 1
    );
    const cm = getCodeMirror(nodeView);
    document.body.appendChild(nodeView.dom);

    expect(() => nodeView.setSelection(8, 8)).not.toThrow();
    expect(cm.state.selection.main.anchor).toBe(6);
    expect(cm.state.selection.main.head).toBe(6);
    nodeView.destroy();
  });

  it('mirrors an outer ProseMirror selection into the embedded editor', () => {
    const node = createMockNodeWithText('const a = 1;');
    const view = createMockView();
    view.state.selection = createMockSelection(1, node.textContent.length + 1) as never;
    const nodeView = new CodeBlockNodeView(node, view, () => 0);
    const cm = getCodeMirror(nodeView);

    nodeView.update(node);

    expect(nodeView.dom.dataset.pmSelected).toBe('true');
    expect(cm.state.selection.main.anchor).toBe(0);
    expect(cm.state.selection.main.head).toBe(node.textContent.length);

    nodeView.destroy();
  });

  it('syncs outer selection changes after document selectionchange', async () => {
    const node = createMockNodeWithText('const a = 1;');
    const view = createMockView();
    const selection = view.state.selection as { from: number; to: number };
    const nodeView = new CodeBlockNodeView(node, view, () => 0);
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
