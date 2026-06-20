import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNotesOutline } from './useNotesOutline';
import type { EditorBlockPositionSnapshot } from '@/components/Notes/features/Editor/utils/editorBlockPositionCache';

const hoisted = vi.hoisted(() => ({
  currentSnapshot: null as EditorBlockPositionSnapshot | null,
}));

vi.mock('@/components/Notes/features/Editor/utils/editorBlockPositionCache', () => ({
  getCurrentEditorBlockPositionSnapshot: () => hoisted.currentSnapshot,
  subscribeCurrentEditorBlockPositionSnapshot: vi.fn(() => vi.fn()),
}));

function createRect(top: number, bottom = top + 24): DOMRect {
  return {
    x: 0,
    y: top,
    top,
    left: 0,
    bottom,
    right: 320,
    width: 320,
    height: bottom - top,
    toJSON: () => ({}),
  } as DOMRect;
}

function createOutlineSnapshot() {
  const scrollRoot = document.createElement('div');
  const editorRoot = document.createElement('div');
  const headingElement = document.createElement('h2');
  const scrollTo = vi.fn();
  const doc = {};
  const view = {
    dom: editorRoot,
    state: { doc },
  };

  headingElement.textContent = 'Target';
  editorRoot.append(headingElement);
  scrollRoot.append(editorRoot);
  document.body.append(scrollRoot);

  Object.defineProperty(scrollRoot, 'scrollTop', {
    configurable: true,
    value: 80,
  });
  scrollRoot.scrollTo = scrollTo;
  scrollRoot.getBoundingClientRect = vi.fn(() => createRect(40, 640));
  headingElement.getBoundingClientRect = vi.fn(() => createRect(260, 292));
  editorRoot.focus = vi.fn();

  hoisted.currentSnapshot = {
    version: 1,
    view,
    doc,
    editorRoot,
    scrollRoot,
    scrollLeft: 0,
    scrollTop: 80,
    geometryValidationScrollLeft: 0,
    geometryValidationScrollTop: 80,
    blocks: [],
    blockIndex: new Map(),
    headings: [{
      id: 'target-heading',
      level: 2,
      text: 'Target',
      from: 1,
      to: 8,
      element: headingElement,
      top: 300,
      bottom: 332,
    }],
  } as unknown as EditorBlockPositionSnapshot;

  return { scrollTo };
}

describe('useNotesOutline', () => {
  beforeEach(() => {
    hoisted.currentSnapshot = null;
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
  });

  it('jumps to outline headings without smooth scrolling by default', () => {
    const { scrollTo } = createOutlineSnapshot();
    const { result } = renderHook(() => useNotesOutline(true));

    act(() => {
      result.current.jumpToHeading('target-heading');
    });

    expect(scrollTo).toHaveBeenCalledWith({
      top: 228,
      behavior: 'auto',
    });
  });
});
