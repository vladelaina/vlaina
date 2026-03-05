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
    attrs: { collapsed, language: 'ts' },
    type: { name: 'code_block' },
    nodeSize: 6,
    textContent: 'const a = 1;',
  } as unknown as ProseNode;
}

function createMockView(): EditorView {
  const tr = {
    setSelection: vi.fn(() => tr),
    insertText: vi.fn(() => tr),
  };

  return {
    state: {
      tr,
      selection: { from: 1, to: 1 },
      doc: { resolve: vi.fn(() => ({})) },
    },
    dispatch: vi.fn(),
    focus: vi.fn(),
  } as unknown as EditorView;
}

describe('CodeBlockNodeView', () => {
  beforeEach(() => {
    renderMock.mockClear();
    unmountMock.mockClear();
  });

  it('keeps only header non-editable and does not force root/content contentEditable', () => {
    const nodeView = new CodeBlockNodeView(createMockNode(false), createMockView(), () => 1);

    expect(nodeView.headerDOM.contentEditable).toBe('false');
    expect(nodeView.dom.contentEditable).not.toBe('false');
    expect(nodeView.contentDOM.contentEditable).not.toBe('false');
  });

  it('does not ignore selection mutation', () => {
    const nodeView = new CodeBlockNodeView(createMockNode(false), createMockView(), () => 1);

    const result = nodeView.ignoreMutation({
      type: 'selection',
      target: nodeView.contentDOM,
    });

    expect(result).toBe(false);
  });

  it('does not ignore mutations inside editable content DOM', () => {
    const nodeView = new CodeBlockNodeView(createMockNode(false), createMockView(), () => 1);
    const textNode = document.createTextNode('x');
    nodeView.contentDOM.appendChild(textNode);

    const result = nodeView.ignoreMutation({
      type: 'characterData',
      target: textNode,
    } as unknown as MutationRecord);

    expect(result).toBe(false);
  });

  it('ignores header/UI-only mutations', () => {
    const nodeView = new CodeBlockNodeView(createMockNode(false), createMockView(), () => 1);

    const result = nodeView.ignoreMutation({
      type: 'attributes',
      target: nodeView.headerDOM,
    } as unknown as MutationRecord);

    expect(result).toBe(true);
  });
});
