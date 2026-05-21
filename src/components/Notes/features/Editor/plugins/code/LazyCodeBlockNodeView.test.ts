import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import type { EditorView } from '@milkdown/kit/prose/view';
import { LazyCodeBlockNodeView } from './LazyCodeBlockNodeView';

function createMockNode(textContent = 'const a = 1;'): ProseNode {
  return {
    attrs: { language: 'ts', lineNumbers: true, wrap: false },
    type: { name: 'code_block' },
    nodeSize: textContent.length + 2,
    textContent,
  } as unknown as ProseNode;
}

function createMockView(): EditorView {
  return {
    root: document,
    editable: true,
  } as unknown as EditorView;
}

describe('LazyCodeBlockNodeView', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('disconnects the viewport observer when destroyed before loading', () => {
    const disconnect = vi.fn();
    const observe = vi.fn();

    class TestIntersectionObserver {
      observe = observe;
      disconnect = disconnect;
      unobserve = vi.fn();
      takeRecords = vi.fn(() => []);
      root = null;
      rootMargin = '0px';
      thresholds = [];

      constructor() {}
    }

    vi.stubGlobal('IntersectionObserver', TestIntersectionObserver);

    const nodeView = new LazyCodeBlockNodeView(
      createMockNode(),
      createMockView(),
      () => 1
    );

    expect(observe).toHaveBeenCalledWith(nodeView.dom);

    nodeView.destroy();

    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
