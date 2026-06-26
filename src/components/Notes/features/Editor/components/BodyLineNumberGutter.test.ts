import { act, cleanup, render } from '@testing-library/react';
import { createElement, type RefObject } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  BodyLineNumberGutter,
} from './BodyLineNumberGutter';
import {
  collectBodyLineNumberTargets,
  MAX_BODY_LINE_NUMBER_PRECISE_TEXT_ANCHOR_TARGETS,
  MAX_BODY_LINE_NUMBER_TARGETS,
  resolveBodyLineNumberLabels,
} from '../utils/bodyLineNumberLayout';

function setRect(element: HTMLElement, rect: Partial<DOMRect>) {
  element.getBoundingClientRect = () => ({
    x: rect.left ?? 0,
    y: rect.top ?? 0,
    width: rect.width ?? 0,
    height: rect.height ?? 0,
    top: rect.top ?? 0,
    right: rect.right ?? 0,
    bottom: rect.bottom ?? 0,
    left: rect.left ?? 0,
    toJSON: () => ({}),
  } as DOMRect);
}

function createRect(rect: Partial<DOMRect>): DOMRect {
  return {
    x: rect.left ?? 0,
    y: rect.top ?? 0,
    width: rect.width ?? 0,
    height: rect.height ?? 0,
    top: rect.top ?? 0,
    right: rect.right ?? 0,
    bottom: rect.bottom ?? 0,
    left: rect.left ?? 0,
    toJSON: () => ({}),
  } as DOMRect;
}

function createRectList(rects: DOMRect[]): DOMRectList {
  const rectList = {
    length: rects.length,
    item: (index: number) => rects[index] ?? null,
  } as DOMRectList & Record<number, DOMRect>;
  rects.forEach((rect, index) => {
    rectList[index] = rect;
  });
  return rectList;
}

function mockTextRects(rectsByText: Record<string, Partial<DOMRect>>) {
  let selectedNode: Node | null = null;
  return vi.spyOn(document, 'createRange').mockImplementation(() => ({
    selectNodeContents: vi.fn((node: Node) => {
      selectedNode = node;
    }),
    getClientRects: vi.fn(() => {
      const text = selectedNode?.textContent ?? '';
      const rect = rectsByText[text];
      return createRectList(rect ? [createRect(rect)] : []);
    }),
    detach: vi.fn(),
  } as unknown as Range));
}

describe('BodyLineNumberGutter', () => {
  it('collects body targets without code blocks or frontmatter blocks', () => {
    const editorRoot = document.createElement('div');
    editorRoot.className = 'ProseMirror';
    editorRoot.innerHTML = [
      '<div class="frontmatter-block-container"></div>',
      '<h1 id="heading">Title</h1>',
      '<div class="code-block-container"></div>',
      '<ul><li id="one">One</li><li id="two">Two</li></ul>',
      '<p id="paragraph">Text</p>',
    ].join('');

    expect(collectBodyLineNumberTargets(editorRoot).map((item) => item.id)).toEqual([
      'heading',
      'one',
      'two',
      'paragraph',
    ]);
  });

  it('collects body targets without internal blank line placeholders', () => {
    const editorRoot = document.createElement('div');
    editorRoot.className = 'ProseMirror';
    editorRoot.innerHTML = [
      '<h1 id="heading">Title</h1>',
      '<div id="blank-html" data-type="html-block" data-value="<!--vlaina-markdown-blank-line-->"></div>',
      '<p id="blank-paragraph" class="editor-editable-markdown-blank-line"></p>',
      '<p id="empty-paragraph" class="editor-empty-paragraph"></p>',
      '<p id="paragraph">Text</p>',
    ].join('');

    expect(collectBodyLineNumberTargets(editorRoot).map((item) => item.id)).toEqual([
      'heading',
      'paragraph',
    ]);
  });

  it('collects body targets without materializing child lists', () => {
    const editorRoot = document.createElement('div');
    editorRoot.className = 'ProseMirror';
    const list = document.createElement('ul');
    for (let index = 0; index < MAX_BODY_LINE_NUMBER_TARGETS + 8; index += 1) {
      const item = document.createElement('li');
      item.id = `item-${index}`;
      list.appendChild(item);
    }
    editorRoot.appendChild(list);
    const arrayFromSpy = vi.spyOn(Array, 'from');
    const querySelectorAllSpy = vi.spyOn(Element.prototype, 'querySelectorAll');

    try {
      const targets = collectBodyLineNumberTargets(editorRoot);

      expect(targets).toHaveLength(MAX_BODY_LINE_NUMBER_TARGETS);
      expect(targets[0]?.id).toBe('item-0');
      expect(targets.at(-1)?.id).toBe(`item-${MAX_BODY_LINE_NUMBER_TARGETS - 1}`);
      expect(arrayFromSpy).not.toHaveBeenCalled();
      expect(querySelectorAllSpy).not.toHaveBeenCalled();
    } finally {
      arrayFromSpy.mockRestore();
      querySelectorAllSpy.mockRestore();
    }
  });

  it('resolves labels in an independent gutter before the editor content', () => {
    const shell = document.createElement('div');
    const editorRoot = document.createElement('div');
    const heading = document.createElement('h1');
    const paragraph = document.createElement('p');

    editorRoot.className = 'ProseMirror';
    shell.appendChild(editorRoot);
    editorRoot.append(heading, paragraph);

    setRect(shell, { left: 10, top: 20 });
    setRect(editorRoot, { left: 106, top: 20 });
    setRect(heading, { left: 106, top: 40, height: 32 });
    setRect(paragraph, { left: 106, top: 80, height: 24 });

    const labels = resolveBodyLineNumberLabels(shell, '# Title\n\nBody');

    expect(labels).toEqual([
      { lineNumber: 1, left: 38, top: 36 },
      { lineNumber: 3, left: 38, top: 72 },
    ]);
  });

  it('keeps internal blank line placeholders from shifting following labels', () => {
    const shell = document.createElement('div');
    const editorRoot = document.createElement('div');
    const heading = document.createElement('h1');
    const blank = document.createElement('div');
    const paragraph = document.createElement('p');

    editorRoot.className = 'ProseMirror';
    heading.textContent = 'Title';
    blank.dataset.type = 'html-block';
    blank.dataset.value = '<!--vlaina-markdown-blank-line-->';
    paragraph.textContent = 'Body';
    shell.appendChild(editorRoot);
    editorRoot.append(heading, blank, paragraph);

    setRect(shell, { left: 10, top: 20 });
    setRect(editorRoot, { left: 106, top: 20 });
    setRect(heading, { left: 106, top: 40, height: 32 });
    setRect(blank, { left: 106, top: 76, height: 16 });
    setRect(paragraph, { left: 106, top: 96, height: 24 });

    const labels = resolveBodyLineNumberLabels(
      shell,
      ['# Title', '<!--vlaina-markdown-blank-line-->', 'Body'].join('\n')
    );

    expect(labels).toEqual([
      { lineNumber: 1, left: 38, top: 36 },
      { lineNumber: 3, left: 38, top: 88 },
    ]);
  });

  it('aligns labels to the first rendered text line instead of the block center', () => {
    const shell = document.createElement('div');
    const editorRoot = document.createElement('div');
    const paragraph = document.createElement('p');
    const restoreCreateRange = mockTextRects({
      'First visual line': { left: 120, top: 44, width: 160, height: 16 },
    });

    editorRoot.className = 'ProseMirror';
    paragraph.textContent = 'First visual line';
    shell.appendChild(editorRoot);
    editorRoot.appendChild(paragraph);

    setRect(shell, { left: 10, top: 20 });
    setRect(editorRoot, { left: 106, top: 20 });
    setRect(paragraph, { left: 106, top: 40, height: 96 });

    try {
      const labels = resolveBodyLineNumberLabels(shell, 'First visual line');

      expect(labels).toEqual([{ lineNumber: 1, left: 38, top: 32 }]);
    } finally {
      restoreCreateRange.mockRestore();
    }
  });

  it('aligns nested list labels to each item text line', () => {
    const shell = document.createElement('div');
    const editorRoot = document.createElement('div');
    const list = document.createElement('ul');
    const parent = document.createElement('li');
    const nestedList = document.createElement('ul');
    const nested = document.createElement('li');
    const next = document.createElement('li');
    const restoreCreateRange = mockTextRects({
      'Parent item': { left: 120, top: 44, width: 120, height: 16 },
      'Nested item': { left: 140, top: 92, width: 120, height: 16 },
      'Next item': { left: 120, top: 128, width: 120, height: 16 },
    });

    editorRoot.className = 'ProseMirror';
    parent.append('Parent item');
    nested.append('Nested item');
    next.append('Next item');
    nestedList.appendChild(nested);
    parent.appendChild(nestedList);
    list.append(parent, next);
    shell.appendChild(editorRoot);
    editorRoot.appendChild(list);

    setRect(shell, { left: 10, top: 20 });
    setRect(editorRoot, { left: 106, top: 20 });
    setRect(parent, { left: 106, top: 40, height: 80 });
    setRect(nested, { left: 126, top: 88, height: 24 });
    setRect(next, { left: 106, top: 124, height: 24 });

    try {
      const labels = resolveBodyLineNumberLabels(
        shell,
        ['- Parent item', '  - Nested item', '- Next item'].join('\n')
      );

      expect(labels).toEqual([
        { lineNumber: 1, left: 38, top: 32 },
        { lineNumber: 2, left: 38, top: 80 },
        { lineNumber: 3, left: 38, top: 116 },
      ]);
    } finally {
      restoreCreateRange.mockRestore();
    }
  });

  it('skips per-text range measurement for large body line number sets', () => {
    const shell = document.createElement('div');
    const editorRoot = document.createElement('div');
    const paragraphCount = MAX_BODY_LINE_NUMBER_PRECISE_TEXT_ANCHOR_TARGETS + 1;
    const markdownLines: string[] = [];
    const createRangeSpy = vi.spyOn(document, 'createRange').mockImplementation(() => {
      throw new Error('Large body line number sets should use block geometry only');
    });

    editorRoot.className = 'ProseMirror';
    shell.appendChild(editorRoot);
    setRect(shell, { left: 10, top: 20 });
    setRect(editorRoot, { left: 106, top: 20 });

    for (let index = 0; index < paragraphCount; index += 1) {
      const paragraph = document.createElement('p');
      paragraph.textContent = `Line ${index}`;
      editorRoot.appendChild(paragraph);
      setRect(paragraph, { left: 106, top: 40 + index * 24, height: 24 });
      markdownLines.push(`Line ${index}`);
    }

    try {
      const labels = resolveBodyLineNumberLabels(shell, markdownLines.join('\n\n'));

      expect(labels).toHaveLength(paragraphCount);
      expect(labels[0]).toEqual({ lineNumber: 1, left: 38, top: 32 });
      expect(labels.at(-1)).toEqual({
        lineNumber: paragraphCount * 2 - 1,
        left: 38,
        top: 32 + (paragraphCount - 1) * 24,
      });
      expect(createRangeSpy).not.toHaveBeenCalled();
    } finally {
      createRangeSpy.mockRestore();
    }
  });

  it('hides labels for selected blocks without shifting source line numbers', () => {
    const shell = document.createElement('div');
    const editorRoot = document.createElement('div');
    const first = document.createElement('p');
    const selected = document.createElement('p');
    const third = document.createElement('p');

    editorRoot.className = 'ProseMirror';
    selected.className = 'editor-block-selected';
    shell.appendChild(editorRoot);
    editorRoot.append(first, selected, third);

    setRect(shell, { left: 10, top: 20 });
    setRect(editorRoot, { left: 106, top: 20 });
    setRect(first, { left: 106, top: 40, height: 24 });
    setRect(selected, { left: 106, top: 72, height: 24 });
    setRect(third, { left: 106, top: 104, height: 24 });

    const labels = resolveBodyLineNumberLabels(shell, 'First\n\nSelected\n\nThird');

    expect(labels).toEqual([
      { lineNumber: 1, left: 38, top: 32 },
      { lineNumber: 5, left: 38, top: 96 },
    ]);
  });

  it('hides list item labels when a selected child paragraph carries the block selection class', () => {
    const shell = document.createElement('div');
    const editorRoot = document.createElement('div');
    const list = document.createElement('ul');
    const first = document.createElement('li');
    const second = document.createElement('li');
    const selectedParagraph = document.createElement('p');

    editorRoot.className = 'ProseMirror';
    selectedParagraph.className = 'editor-block-selected';
    second.appendChild(selectedParagraph);
    list.append(first, second);
    shell.appendChild(editorRoot);
    editorRoot.appendChild(list);

    setRect(shell, { left: 10, top: 20 });
    setRect(editorRoot, { left: 106, top: 20 });
    setRect(first, { left: 106, top: 40, height: 24 });
    setRect(second, { left: 106, top: 72, height: 24 });
    const firstQuerySelectorSpy = vi.spyOn(first, 'querySelector').mockImplementation(() => {
      throw new Error('Line number labels should not scan each target subtree');
    });
    const secondQuerySelectorSpy = vi.spyOn(second, 'querySelector').mockImplementation(() => {
      throw new Error('Line number labels should not scan each target subtree');
    });

    try {
      const labels = resolveBodyLineNumberLabels(shell, '- First\n- Second');

      expect(labels).toEqual([{ lineNumber: 1, left: 38, top: 32 }]);
      expect(firstQuerySelectorSpy).not.toHaveBeenCalled();
      expect(secondQuerySelectorSpy).not.toHaveBeenCalled();
    } finally {
      firstQuerySelectorSpy.mockRestore();
      secondQuerySelectorSpy.mockRestore();
    }
  });

  it('defers expensive label refreshes while block selection is pending', () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(performance.now()), 0)
    );
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      window.clearTimeout(id);
    });

    let resizeCallback: ResizeObserverCallback = () => {};
    class TestResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }

      observe = vi.fn();
      disconnect = vi.fn();
    }

    class TestMutationObserver {
      constructor(_callback: MutationCallback) {}

      observe = vi.fn();
      disconnect = vi.fn();
    }

    vi.stubGlobal('ResizeObserver', TestResizeObserver);
    vi.stubGlobal('MutationObserver', TestMutationObserver);

    const shell = document.createElement('div');
    const editorRoot = document.createElement('div');
    const paragraph = document.createElement('p');
    const shellRef = { current: shell } as RefObject<HTMLDivElement | null>;

    editorRoot.className = 'ProseMirror editor-block-selection-pending';
    paragraph.textContent = 'Body';
    shell.appendChild(editorRoot);
    editorRoot.appendChild(paragraph);
    setRect(shell, { left: 10, top: 20 });
    setRect(editorRoot, { left: 106, top: 20 });
    setRect(paragraph, { left: 106, top: 40, height: 24 });

    try {
      const { container } = render(createElement(BodyLineNumberGutter, {
        markdown: 'Body',
        revision: 1,
        shellRef,
      }));

      act(() => {
        vi.advanceTimersByTime(0);
      });
      expect(container.querySelectorAll('.body-line-number')).toHaveLength(0);

      act(() => {
        resizeCallback([], {} as ResizeObserver);
        vi.advanceTimersByTime(0);
      });
      expect(container.querySelectorAll('.body-line-number')).toHaveLength(0);

      editorRoot.classList.remove('editor-block-selection-pending');
      act(() => {
        vi.advanceTimersByTime(80);
        vi.runOnlyPendingTimers();
      });

      expect(Array.from(container.querySelectorAll('.body-line-number')).map((node) => node.textContent)).toEqual(['1']);
    } finally {
      cleanup();
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });

  it('defers expensive label refreshes while block dragging is active', () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(performance.now()), 0)
    );
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      window.clearTimeout(id);
    });

    let resizeCallback: ResizeObserverCallback = () => {};
    class TestResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }

      observe = vi.fn();
      disconnect = vi.fn();
    }

    class TestMutationObserver {
      constructor(_callback: MutationCallback) {}

      observe = vi.fn();
      disconnect = vi.fn();
    }

    vi.stubGlobal('ResizeObserver', TestResizeObserver);
    vi.stubGlobal('MutationObserver', TestMutationObserver);

    const shell = document.createElement('div');
    const editorRoot = document.createElement('div');
    const paragraph = document.createElement('p');
    const shellRef = { current: shell } as RefObject<HTMLDivElement | null>;

    document.body.classList.add('editor-block-drag-active');
    editorRoot.className = 'ProseMirror';
    paragraph.textContent = 'Body';
    shell.appendChild(editorRoot);
    editorRoot.appendChild(paragraph);
    setRect(shell, { left: 10, top: 20 });
    setRect(editorRoot, { left: 106, top: 20 });
    setRect(paragraph, { left: 106, top: 40, height: 24 });

    try {
      const { container } = render(createElement(BodyLineNumberGutter, {
        markdown: 'Body',
        revision: 1,
        shellRef,
      }));

      act(() => {
        vi.advanceTimersByTime(0);
      });
      expect(container.querySelectorAll('.body-line-number')).toHaveLength(0);

      act(() => {
        resizeCallback([], {} as ResizeObserver);
        vi.advanceTimersByTime(0);
      });
      expect(container.querySelectorAll('.body-line-number')).toHaveLength(0);

      document.body.classList.remove('editor-block-drag-active');
      act(() => {
        vi.advanceTimersByTime(80);
        vi.runOnlyPendingTimers();
      });

      expect(Array.from(container.querySelectorAll('.body-line-number')).map((node) => node.textContent)).toEqual(['1']);
    } finally {
      document.body.classList.remove('editor-block-drag-active');
      cleanup();
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });

  it('defers expensive label refreshes while pointer interaction is active', () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(performance.now()), 0)
    );
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      window.clearTimeout(id);
    });

    class TestResizeObserver {
      constructor(_callback: ResizeObserverCallback) {}

      observe = vi.fn();
      disconnect = vi.fn();
    }

    class TestMutationObserver {
      constructor(_callback: MutationCallback) {}

      observe = vi.fn();
      disconnect = vi.fn();
    }

    vi.stubGlobal('ResizeObserver', TestResizeObserver);
    vi.stubGlobal('MutationObserver', TestMutationObserver);

    const shell = document.createElement('div');
    const editorRoot = document.createElement('div');
    const paragraph = document.createElement('p');
    const shellRef = { current: shell } as RefObject<HTMLDivElement | null>;

    editorRoot.className = 'ProseMirror';
    paragraph.textContent = 'Body';
    shell.appendChild(editorRoot);
    editorRoot.appendChild(paragraph);
    setRect(shell, { left: 10, top: 20 });
    setRect(editorRoot, { left: 106, top: 20 });
    setRect(paragraph, { left: 106, top: 40, height: 24 });

    try {
      const { container } = render(createElement(BodyLineNumberGutter, {
        markdown: 'Body',
        revision: 1,
        shellRef,
      }));

      window.dispatchEvent(new Event('pointerdown'));
      act(() => {
        vi.advanceTimersByTime(0);
      });
      expect(container.querySelectorAll('.body-line-number')).toHaveLength(0);

      window.dispatchEvent(new Event('pointerup'));
      act(() => {
        vi.advanceTimersByTime(80);
        vi.runOnlyPendingTimers();
      });

      expect(Array.from(container.querySelectorAll('.body-line-number')).map((node) => node.textContent)).toEqual(['1']);
    } finally {
      window.dispatchEvent(new Event('pointerup'));
      cleanup();
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });

  it('recovers deferred label refreshes when pointer end events are lost', () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(performance.now()), 0)
    );
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      window.clearTimeout(id);
    });

    class TestResizeObserver {
      constructor(_callback: ResizeObserverCallback) {}

      observe = vi.fn();
      disconnect = vi.fn();
    }

    class TestMutationObserver {
      constructor(_callback: MutationCallback) {}

      observe = vi.fn();
      disconnect = vi.fn();
    }

    vi.stubGlobal('ResizeObserver', TestResizeObserver);
    vi.stubGlobal('MutationObserver', TestMutationObserver);

    const shell = document.createElement('div');
    const editorRoot = document.createElement('div');
    const paragraph = document.createElement('p');
    const shellRef = { current: shell } as RefObject<HTMLDivElement | null>;

    editorRoot.className = 'ProseMirror';
    paragraph.textContent = 'Body';
    shell.appendChild(editorRoot);
    editorRoot.appendChild(paragraph);
    setRect(shell, { left: 10, top: 20 });
    setRect(editorRoot, { left: 106, top: 20 });
    setRect(paragraph, { left: 106, top: 40, height: 24 });

    try {
      const { container } = render(createElement(BodyLineNumberGutter, {
        markdown: 'Body',
        revision: 1,
        shellRef,
      }));

      window.dispatchEvent(new Event('pointerdown'));
      act(() => {
        vi.advanceTimersByTime(0);
      });
      expect(container.querySelectorAll('.body-line-number')).toHaveLength(0);

      act(() => {
        vi.advanceTimersByTime(10_000);
        vi.runOnlyPendingTimers();
      });

      expect(Array.from(container.querySelectorAll('.body-line-number')).map((node) => node.textContent)).toEqual(['1']);
    } finally {
      window.dispatchEvent(new Event('pointerup'));
      cleanup();
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });
});
