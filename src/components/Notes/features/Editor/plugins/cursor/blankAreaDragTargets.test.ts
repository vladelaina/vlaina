import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EditorView } from '@milkdown/kit/prose/view';
import {
  clearCurrentEditorBlockPositionSnapshot,
  setCurrentEditorBlockPositionSnapshot,
  type EditorBlockPositionSnapshot,
} from '../../utils/editorBlockPositionCache';
import {
  MAX_BLANK_AREA_TEXT_HIT_CHARS,
  isExternalTextLineGutterNativeSelectionTarget,
  isIgnoredBlankAreaDragBoxTarget,
  isPointInTrailingTextSelectionGutter,
  resolveBlankAreaDragStartZone,
  resolveTextLinePointerHit,
} from './blankAreaDragTargets';

function rect(top: number, bottom: number, left = 100, right = 240): DOMRect {
  return {
    bottom,
    height: bottom - top,
    left,
    right,
    top,
    width: right - left,
    x: left,
    y: top,
    toJSON: () => {},
  } as DOMRect;
}

function createMouseDown(
  target: HTMLElement,
  init: Pick<MouseEventInit, 'clientX' | 'clientY'> = {},
) {
  const event = new MouseEvent('mousedown', {
    bubbles: true,
    cancelable: true,
    clientX: init.clientX ?? 0,
    clientY: init.clientY ?? 0,
  });

  Object.defineProperty(event, 'target', {
    configurable: true,
    value: target,
  });

  return event;
}

function createView() {
  const scrollRoot = document.createElement('div');
  scrollRoot.setAttribute('data-note-scroll-root', 'true');

  const editorWrapper = document.createElement('div');
  editorWrapper.className = 'milkdown-editor';
  editorWrapper.setAttribute('data-note-content-root', 'true');
  scrollRoot.append(editorWrapper);

  const editor = document.createElement('div');
  editorWrapper.append(editor);
  document.body.append(scrollRoot);

  return {
    view: { dom: editor } as unknown as EditorView,
    scrollRoot,
    editorWrapper,
    cleanup: () => scrollRoot.remove(),
  };
}

describe('blankAreaDragTargets', () => {
  afterEach(() => {
    clearCurrentEditorBlockPositionSnapshot();
  });

  it('treats the small area after line text as text-selection space', () => {
    const lineRect = {
      left: 100,
      right: 240,
      top: 40,
      bottom: 60,
      width: 140,
      height: 20,
    };

    expect(isPointInTrailingTextSelectionGutter(lineRect, 250, 50)).toBe(true);
    expect(isPointInTrailingTextSelectionGutter(lineRect, 225, 50)).toBe(true);
    expect(isPointInTrailingTextSelectionGutter(lineRect, 210, 50)).toBe(false);
    expect(isPointInTrailingTextSelectionGutter(lineRect, 310, 50)).toBe(false);
    expect(isPointInTrailingTextSelectionGutter(lineRect, 250, 90)).toBe(false);
  });

  it('ignores cover targets for document-level blank-area drag handling', () => {
    const coverRegion = document.createElement('div');
    coverRegion.setAttribute('data-note-cover-region', 'true');
    const coverChild = document.createElement('button');
    coverRegion.append(coverChild);
    document.body.append(coverRegion);

    try {
      expect(isIgnoredBlankAreaDragBoxTarget(coverRegion)).toBe(true);
      expect(isIgnoredBlankAreaDragBoxTarget(coverChild)).toBe(true);
    } finally {
      coverRegion.remove();
    }
  });

  it('ignores explicit non-editor chrome for document-level blank-area drag handling', () => {
    const chrome = document.createElement('div');
    chrome.setAttribute('data-no-editor-drag-box', 'true');
    const child = document.createElement('span');
    chrome.append(child);
    document.body.append(chrome);

    try {
      expect(isIgnoredBlankAreaDragBoxTarget(chrome)).toBe(true);
      expect(isIgnoredBlankAreaDragBoxTarget(child)).toBe(true);
    } finally {
      chrome.remove();
    }
  });

  it('does not start block selection from note header chrome in the editor scroll root', () => {
    const { view, scrollRoot, editorWrapper, cleanup } = createView();
    const header = document.createElement('div');
    const headerChild = document.createElement('span');
    header.append(headerChild);
    scrollRoot.insertBefore(header, editorWrapper);

    try {
      expect(resolveBlankAreaDragStartZone(
        view,
        createMouseDown(headerChild, { clientX: 120, clientY: 24 }),
      )).toBeNull();
    } finally {
      cleanup();
    }
  });

  it('skips text line hit measurement for oversized roots without reading aggregate text', () => {
    const root = document.createElement('p');
    root.append(document.createTextNode('a'.repeat(MAX_BLANK_AREA_TEXT_HIT_CHARS + 1)));
    const createRangeSpy = vi.spyOn(document, 'createRange');
    Object.defineProperty(root, 'textContent', {
      configurable: true,
      get() {
        throw new Error('aggregate textContent should not be read');
      },
    });

    expect(resolveTextLinePointerHit(root, 0, 0)).toEqual({ type: 'measurement-limit' });
    expect(createRangeSpy).not.toHaveBeenCalled();

    createRangeSpy.mockRestore();
  });

  it('does not start block selection from the editor root near a text line end', () => {
    const { view, cleanup } = createView();
    const paragraph = document.createElement('p');
    paragraph.textContent = 'Selectable text';
    paragraph.getBoundingClientRect = () => ({
      left: 100,
      right: 240,
      top: 40,
      bottom: 60,
      width: 140,
      height: 20,
      x: 100,
      y: 40,
      toJSON: () => {},
    });
    view.dom.append(paragraph);

    const originalCreateRange = document.createRange;
    document.createRange = () => ({
      selectNodeContents: () => {},
      getClientRects: () => [{
        left: 100,
        right: 240,
        top: 40,
        bottom: 60,
        width: 140,
        height: 20,
      }],
      detach: () => {},
    } as unknown as Range);

    try {
      expect(resolveBlankAreaDragStartZone(
        view,
        createMouseDown(view.dom, { clientX: 250, clientY: 50 }),
      )).toBeNull();
    } finally {
      document.createRange = originalCreateRange;
      cleanup();
    }
  });

  it('allows the right blank area on the editor root to start block selection', () => {
    const { view, cleanup } = createView();
    const paragraph = document.createElement('p');
    paragraph.textContent = 'Selectable text';
    paragraph.getBoundingClientRect = () => ({
      left: 100,
      right: 240,
      top: 40,
      bottom: 60,
      width: 140,
      height: 20,
      x: 100,
      y: 40,
      toJSON: () => {},
    });
    view.dom.append(paragraph);

    const originalCreateRange = document.createRange;
    document.createRange = () => ({
      selectNodeContents: () => {},
      getClientRects: () => [{
        left: 100,
        right: 240,
        top: 40,
        bottom: 60,
        width: 140,
        height: 20,
      }],
      detach: () => {},
    } as unknown as Range);

    try {
      expect(resolveBlankAreaDragStartZone(
        view,
        createMouseDown(view.dom, { clientX: 330, clientY: 50 }),
      )).toBe('outside-editor');
    } finally {
      document.createRange = originalCreateRange;
      cleanup();
    }
  });

  it('does not start block selection from the editor root near a text line start', () => {
    const { view, cleanup } = createView();
    const paragraph = document.createElement('p');
    paragraph.textContent = 'Selectable text';
    view.dom.append(paragraph);

    const originalCreateRange = document.createRange;
    document.createRange = () => ({
      selectNodeContents: () => {},
      getClientRects: () => [{
        left: 100,
        right: 240,
        top: 40,
        bottom: 60,
        width: 140,
        height: 20,
      }],
      detach: () => {},
    } as unknown as Range);

    try {
      expect(resolveBlankAreaDragStartZone(
        view,
        createMouseDown(view.dom, { clientX: 90, clientY: 50 }),
      )).toBeNull();
    } finally {
      document.createRange = originalCreateRange;
      cleanup();
    }
  });

  it('does not start block selection from the editor wrapper near a text line end', () => {
    const { view, editorWrapper, cleanup } = createView();
    const paragraph = document.createElement('p');
    paragraph.textContent = 'Selectable text';
    paragraph.getBoundingClientRect = () => ({
      left: 100,
      right: 240,
      top: 40,
      bottom: 60,
      width: 140,
      height: 20,
      x: 100,
      y: 40,
      toJSON: () => {},
    });
    view.dom.append(paragraph);

    const originalCreateRange = document.createRange;
    document.createRange = () => ({
      selectNodeContents: () => {},
      getClientRects: () => [{
        left: 100,
        right: 240,
        top: 40,
        bottom: 60,
        width: 140,
        height: 20,
      }],
      detach: () => {},
    } as unknown as Range);

    try {
      expect(resolveBlankAreaDragStartZone(
        view,
        createMouseDown(editorWrapper, { clientX: 250, clientY: 50 }),
      )).toBeNull();
    } finally {
      document.createRange = originalCreateRange;
      cleanup();
    }
  });

  it('allows editor content shell blank space to start block selection', () => {
    const { view, editorWrapper, cleanup } = createView();
    const paragraph = document.createElement('p');
    paragraph.textContent = 'Selectable text';
    view.dom.append(paragraph);

    const originalCreateRange = document.createRange;
    document.createRange = () => ({
      selectNodeContents: () => {},
      getClientRects: () => [{
        left: 100,
        right: 240,
        top: 40,
        bottom: 60,
        width: 140,
        height: 20,
      }],
      detach: () => {},
    } as unknown as Range);

    try {
      expect(resolveBlankAreaDragStartZone(
        view,
        createMouseDown(editorWrapper, { clientX: 330, clientY: 50 }),
      )).toBe('outside-editor');
    } finally {
      document.createRange = originalCreateRange;
      cleanup();
    }
  });

  it('allows the editor scroll root itself to start blank-area selection', () => {
    const { view, scrollRoot, cleanup } = createView();

    try {
      expect(resolveBlankAreaDragStartZone(
        view,
        createMouseDown(scrollRoot, { clientX: 120, clientY: 240 }),
      )).toBe('outside-editor');
    } finally {
      cleanup();
    }
  });

  it('identifies external text-line gutters for whitespace native-selection cleanup', () => {
    const { view, editorWrapper, cleanup } = createView();
    const paragraph = document.createElement('p');
    paragraph.textContent = 'Selectable text';
    view.dom.append(paragraph);

    const originalCreateRange = document.createRange;
    document.createRange = () => ({
      selectNodeContents: () => {},
      getClientRects: () => [{
        left: 100,
        right: 240,
        top: 40,
        bottom: 60,
        width: 140,
        height: 20,
      }],
      detach: () => {},
    } as unknown as Range);

    try {
      expect(isExternalTextLineGutterNativeSelectionTarget(
        view,
        createMouseDown(editorWrapper, { clientX: 250, clientY: 50 }),
      )).toBe(true);
      expect(isExternalTextLineGutterNativeSelectionTarget(
        view,
        createMouseDown(editorWrapper, { clientX: 90, clientY: 50 }),
      )).toBe(true);
      expect(isExternalTextLineGutterNativeSelectionTarget(
        view,
        createMouseDown(editorWrapper, { clientX: 150, clientY: 50 }),
      )).toBe(false);
    } finally {
      document.createRange = originalCreateRange;
      cleanup();
    }
  });

  it('refreshes an empty block-position snapshot before measuring an external text-line hit', () => {
    const { view, editorWrapper, cleanup } = createView();
    const paragraph = document.createElement('p');
    paragraph.textContent = `${'x'.repeat(MAX_BLANK_AREA_TEXT_HIT_CHARS + 1)}\nVisible line`;
    paragraph.getBoundingClientRect = () => rect(40, 60);
    view.dom.append(paragraph);

    const paragraphNode = { type: { name: 'paragraph' }, nodeSize: 12 };
    const doc = {
      childCount: 1,
      content: { size: 12 },
      forEach(callback: (node: typeof paragraphNode, offset: number) => void) {
        callback(paragraphNode, 0);
      },
      resolve() {
        return {
          parent: { type: { name: 'doc' } },
          nodeAfter: paragraphNode,
          index: () => 0,
          posAtIndex: () => 0,
        };
      },
    };
    Object.assign(view, {
      state: { doc },
      domAtPos() {
        throw new Error('not needed');
      },
      nodeDOM() {
        return paragraph;
      },
    });
    setCurrentEditorBlockPositionSnapshot({
      version: 1,
      view,
      doc,
      editorRoot: view.dom,
      scrollRoot: view.dom.closest('[data-note-scroll-root="true"]') as HTMLElement,
      scrollLeft: 0,
      scrollTop: 0,
      blocks: [],
      blockIndex: new Map(),
      headings: [],
    } as unknown as EditorBlockPositionSnapshot);

    const originalCreateRange = document.createRange;
    document.createRange = () => ({
      selectNodeContents: () => {},
      getClientRects: () => [rect(40, 60)],
      detach: () => {},
    } as unknown as Range);

    try {
      expect(resolveBlankAreaDragStartZone(
        view,
        createMouseDown(editorWrapper, { clientX: 250, clientY: 50 }),
      )).toBeNull();
    } finally {
      document.createRange = originalCreateRange;
      cleanup();
    }
  });

  it('does not start block selection when pressing on actual text inside a full-width block', () => {
    const { view, cleanup } = createView();
    const paragraph = document.createElement('p');
    paragraph.textContent = 'Selectable text';
    view.dom.append(paragraph);

    const originalCreateRange = document.createRange;
    document.createRange = () => ({
      selectNodeContents: () => {},
      getClientRects: () => [{
        left: 100,
        right: 240,
        top: 40,
        bottom: 60,
        width: 140,
        height: 20,
      }],
      detach: () => {},
    } as unknown as Range);

    try {
      expect(resolveBlankAreaDragStartZone(
        view,
        createMouseDown(paragraph, { clientX: 150, clientY: 50 }),
      )).toBeNull();
    } finally {
      document.createRange = originalCreateRange;
      cleanup();
    }
  });

  it('allows right blank area inside a non-empty full-width text block to start block selection', () => {
    const { view, cleanup } = createView();
    const paragraph = document.createElement('p');
    paragraph.textContent = 'Selectable text';
    view.dom.append(paragraph);

    const originalCreateRange = document.createRange;
    document.createRange = () => ({
      selectNodeContents: () => {},
      getClientRects: () => [{
        left: 100,
        right: 240,
        top: 40,
        bottom: 60,
        width: 140,
        height: 20,
      }],
      detach: () => {},
    } as unknown as Range);

    try {
      expect(resolveBlankAreaDragStartZone(
        view,
        createMouseDown(paragraph, { clientX: 330, clientY: 50 }),
      )).toBe('outside-editor');
    } finally {
      document.createRange = originalCreateRange;
      cleanup();
    }
  });

  it('does not start block selection from blank space inside structured table content', () => {
    const { view, cleanup } = createView();
    const table = document.createElement('table');
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    const paragraph = document.createElement('p');
    paragraph.textContent = 'Cell text';
    cell.append(paragraph);
    row.append(cell);
    table.append(row);
    view.dom.append(table);

    const originalCreateRange = document.createRange;
    document.createRange = () => ({
      selectNodeContents: () => {},
      getClientRects: () => [{
        left: 100,
        right: 180,
        top: 40,
        bottom: 60,
        width: 80,
        height: 20,
      }],
      detach: () => {},
    } as unknown as Range);

    try {
      expect(resolveBlankAreaDragStartZone(
        view,
        createMouseDown(paragraph, { clientX: 330, clientY: 50 }),
      )).toBeNull();
    } finally {
      document.createRange = originalCreateRange;
      cleanup();
    }
  });

  it('does not start block selection from blank space inside code block content', () => {
    const { view, cleanup } = createView();
    const pre = document.createElement('pre');
    const code = document.createElement('code');
    code.textContent = 'const value = 1;';
    pre.append(code);
    view.dom.append(pre);

    const originalCreateRange = document.createRange;
    document.createRange = () => ({
      selectNodeContents: () => {},
      getClientRects: () => [{
        left: 100,
        right: 220,
        top: 40,
        bottom: 60,
        width: 120,
        height: 20,
      }],
      detach: () => {},
    } as unknown as Range);

    try {
      expect(resolveBlankAreaDragStartZone(
        view,
        createMouseDown(code, { clientX: 330, clientY: 50 }),
      )).toBeNull();
    } finally {
      document.createRange = originalCreateRange;
      cleanup();
    }
  });

  it('allows horizontal blank space inside the editor root to start blank-area selection', () => {
    const { view, cleanup } = createView();

    try {
      expect(resolveBlankAreaDragStartZone(view, createMouseDown(view.dom))).toBe('outside-editor');
    } finally {
      cleanup();
    }
  });

  it('lets empty full-width text blocks use native caret placement', () => {
    const { view, cleanup } = createView();
    const paragraph = document.createElement('p');
    view.dom.append(paragraph);

    try {
      expect(resolveBlankAreaDragStartZone(view, createMouseDown(paragraph))).toBeNull();
    } finally {
      cleanup();
    }
  });

  it('lets editable zero-width blank line paragraphs use native caret placement', () => {
    const { view, cleanup } = createView();
    const paragraph = document.createElement('p');
    paragraph.textContent = '\u200B';
    view.dom.append(paragraph);

    try {
      expect(resolveBlankAreaDragStartZone(view, createMouseDown(paragraph))).toBeNull();
    } finally {
      cleanup();
    }
  });

  it('routes markdown blank line placeholder blocks through blank-area click handling', () => {
    const { view, cleanup } = createView();
    const blankLine = document.createElement('div');
    blankLine.setAttribute('data-type', 'html-block');
    blankLine.setAttribute('data-value', '<!--vlaina-markdown-blank-line-->');
    view.dom.append(blankLine);

    try {
      expect(resolveBlankAreaDragStartZone(view, createMouseDown(blankLine))).toBe('outside-editor');
    } finally {
      cleanup();
    }
  });

  it('allows the normal notes sidebar blank scroll root to start block selection', () => {
    const { view, cleanup } = createView();
    const sidebarScrollRoot = document.createElement('div');
    sidebarScrollRoot.setAttribute('data-notes-sidebar-scroll-root', 'true');
    document.body.append(sidebarScrollRoot);

    try {
      expect(resolveBlankAreaDragStartZone(view, createMouseDown(sidebarScrollRoot))).toBe('outside-editor');
    } finally {
      sidebarScrollRoot.remove();
      cleanup();
    }
  });

  it('allows the empty-workspace notes sidebar blank area to start block selection', () => {
    const { view, cleanup } = createView();
    const sidebarScrollRoot = document.createElement('div');
    sidebarScrollRoot.setAttribute('data-notes-sidebar-scroll-root', 'true');
    const blankArea = document.createElement('div');
    blankArea.setAttribute('data-notes-sidebar-blank-drag-root', 'true');
    sidebarScrollRoot.append(blankArea);
    document.body.append(sidebarScrollRoot);

    try {
      expect(resolveBlankAreaDragStartZone(view, createMouseDown(blankArea))).toBe('outside-editor');
    } finally {
      sidebarScrollRoot.remove();
      cleanup();
    }
  });

  it('ignores interactive controls inside the empty-workspace notes sidebar blank area', () => {
    const { view, cleanup } = createView();
    const sidebarScrollRoot = document.createElement('div');
    sidebarScrollRoot.setAttribute('data-notes-sidebar-scroll-root', 'true');
    const blankArea = document.createElement('div');
    blankArea.setAttribute('data-notes-sidebar-blank-drag-root', 'true');
    const button = document.createElement('button');
    blankArea.append(button);
    sidebarScrollRoot.append(blankArea);
    document.body.append(sidebarScrollRoot);

    try {
      expect(resolveBlankAreaDragStartZone(view, createMouseDown(button))).toBeNull();
    } finally {
      sidebarScrollRoot.remove();
      cleanup();
    }
  });
});
