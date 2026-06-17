import { act, cleanup, render } from '@testing-library/react';
import { createElement, type RefObject } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  BodyLineNumberGutter,
  collectBodyLineNumberTargets,
  MAX_BODY_LINE_NUMBER_TARGETS,
  resolveBodyLineNumberLabels,
} from './BodyLineNumberGutter';

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
});
