import { describe, expect, it } from 'vitest';
import type { EditorView } from '@milkdown/kit/prose/view';
import { resolveBlankAreaDragStartZone } from './blankAreaDragTargets';

function createMouseDown(target: HTMLElement) {
  const event = new MouseEvent('mousedown', {
    bubbles: true,
    cancelable: true,
    clientY: 0,
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

  const editor = document.createElement('div');
  scrollRoot.append(editor);
  document.body.append(scrollRoot);

  return {
    view: { dom: editor } as unknown as EditorView,
    cleanup: () => scrollRoot.remove(),
  };
}

describe('blankAreaDragTargets', () => {
  it('allows horizontal blank space inside the editor root to start blank-area selection', () => {
    const { view, cleanup } = createView();

    try {
      expect(resolveBlankAreaDragStartZone(view, createMouseDown(view.dom))).toBe('outside-editor');
    } finally {
      cleanup();
    }
  });

  it('does not treat content inside the editor as blank editor root space', () => {
    const { view, cleanup } = createView();
    const paragraph = document.createElement('p');
    view.dom.append(paragraph);

    try {
      expect(resolveBlankAreaDragStartZone(view, createMouseDown(paragraph))).toBeNull();
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
