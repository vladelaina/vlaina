import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import type { EditorView } from '@milkdown/kit/prose/view';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import {
  CodeBlockNodeView,
  MAX_LAZY_CODE_BLOCK_LINE_NUMBER_PLACEHOLDER_LINES,
} from './CodeBlockNodeView';

const renderMock = vi.fn();
const unmountMock = vi.fn();
const intersectionObserverInstances: Array<{ rootMargin: string }> = [];

vi.mock('react-dom/client', () => ({
  createRoot: vi.fn(() => ({
    render: renderMock,
    unmount: unmountMock,
  })),
}));

function createMockNode(textContent: string): ProseNode {
  return {
    attrs: { collapsed: false, language: 'txt', lineNumbers: true, wrap: false },
    type: { name: 'code_block' },
    nodeSize: textContent.length + 2,
    textContent,
  } as unknown as ProseNode;
}

function createMockView(): EditorView {
  return {
    root: document,
    editable: true,
    state: {
      selection: { from: 1, to: 1, empty: true },
      doc: { resolve: vi.fn(() => ({})) },
      schema: {
        text: vi.fn((value: string) => value),
      },
      tr: {},
    },
    dispatch: vi.fn(),
    focus: vi.fn(),
  } as unknown as EditorView;
}

function setGlobalLineNumbers(showLineNumbers: boolean) {
  useUnifiedStore.setState((state) => ({
    data: {
      ...state.data,
      settings: {
        ...state.data.settings,
        markdown: {
          ...state.data.settings.markdown,
          codeBlock: {
            ...state.data.settings.markdown.codeBlock,
            showLineNumbers,
          },
        },
      },
    },
  }));
}

describe('CodeBlockNodeView lazy placeholders', () => {
  beforeEach(() => {
    renderMock.mockClear();
    unmountMock.mockClear();
    intersectionObserverInstances.length = 0;
    document.body.innerHTML = '';
    setGlobalLineNumbers(true);
    class TestIntersectionObserver {
      observe = vi.fn();
      disconnect = vi.fn();
      unobserve = vi.fn();
      takeRecords = vi.fn(() => []);
      root = null;
      rootMargin: string;
      thresholds = [];
      constructor(_callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        this.rootMargin = options?.rootMargin ?? '0px';
        intersectionObserverInstances.push(this);
      }
    }
    vi.stubGlobal('IntersectionObserver', TestIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setGlobalLineNumbers(false);
  });

  it('bounds newline-heavy lazy line number placeholders', () => {
    const code = '\n'.repeat(MAX_LAZY_CODE_BLOCK_LINE_NUMBER_PLACEHOLDER_LINES + 100);
    const nodeView = new CodeBlockNodeView(
      createMockNode(code),
      createMockView(),
      () => 1,
      { lazyCodeMirror: true },
    );

    const placeholder = nodeView.dom.querySelector('.code-block-lazy-line-numbers');
    const lines = placeholder?.textContent?.split('\n') ?? [];

    expect(lines).toHaveLength(MAX_LAZY_CODE_BLOCK_LINE_NUMBER_PLACEHOLDER_LINES);
    expect(lines.at(-1)).toBe(String(MAX_LAZY_CODE_BLOCK_LINE_NUMBER_PLACEHOLDER_LINES));
    expect(unmountMock).not.toHaveBeenCalled();

    nodeView.destroy();
  });

  it('keeps lazy CodeMirror preloading close to the viewport', () => {
    const nodeView = new CodeBlockNodeView(
      createMockNode('const value = 1;'),
      createMockView(),
      () => 1,
      { lazyCodeMirror: true },
    );

    expect(intersectionObserverInstances.at(-1)?.rootMargin).toBe('900px 0px');

    nodeView.destroy();
  });
});
