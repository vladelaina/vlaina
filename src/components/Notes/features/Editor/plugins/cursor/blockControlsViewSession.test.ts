import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EditorView } from '@milkdown/kit/prose/view';
import { MAX_COMPOSER_PROGRAMMATIC_INSERT_CHARS } from '@/lib/ui/composerFocusRegistry';
import { BlockControlsViewSession } from './blockControlsViewSession';
import { applyBlockMove, getDraggableBlockRanges, resolveDropTarget } from './blockControlsInteractions';
import { getBlockDragComposerPayload } from './blockDragVisualState';
import { serializeSelectedBlocksToText } from './blockSelectionSerializer';
import {
  clearCurrentEditorBlockPositionSnapshot,
  setCurrentEditorBlockPositionSnapshot,
} from '../../utils/editorBlockPositionCache';

const originalElementsFromPoint = document.elementsFromPoint;

const mocks = vi.hoisted(() => ({
  targetTop: 40,
  setControlsPosition: vi.fn((controls: HTMLElement, target: { rect: DOMRect }) => {
    controls.style.left = `${Math.round(target.rect.left - 44)}px`;
    controls.style.top = `${Math.round(target.rect.top + target.rect.height / 2)}px`;
  }),
}));

vi.mock('./blockSelectionPluginState', () => ({
  getBlockSelectionPluginState: () => ({
    selectedBlocks: [{ from: 1, to: 5 }],
  }),
}));

vi.mock('./blockControlsInteractions', () => ({
  applyBlockMove: vi.fn(() => false),
  canApplyBlockMove: vi.fn(() => true),
  getDraggableBlockRanges: vi.fn(() => [{ from: 1, to: 5 }]),
  resolveBlockTargetByPos: vi.fn(() => ({
    pos: 1,
    isListItem: false,
    rect: {
      x: 80,
      y: mocks.targetTop,
      left: 80,
      top: mocks.targetTop,
      right: 360,
      bottom: mocks.targetTop + 20,
      width: 280,
      height: 20,
      toJSON: () => ({}),
    } as DOMRect,
  })),
  resolveDropTarget: vi.fn(() => null),
  setControlsPosition: mocks.setControlsPosition,
}));

vi.mock('./blockDragPreview', () => ({
  createBlockDragPreview: vi.fn(() => null),
}));

vi.mock('./blockSelectionSerializer', () => ({
  serializeSelectedBlocksToText: vi.fn(() => 'Selected block'),
}));

vi.mock('../../utils/editorViewRegistry', () => ({
  getCurrentMarkdownSerializer: vi.fn(() => null),
}));

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function createView(options: { scrollRoot?: boolean } = {}): EditorView {
  const dom = document.createElement('div');
  if (options.scrollRoot) {
    const scrollRoot = document.createElement('div');
    scrollRoot.setAttribute('data-note-scroll-root', 'true');
    scrollRoot.scrollTop = 20;
    scrollRoot.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 500,
      bottom: 100,
      width: 500,
      height: 100,
      toJSON: () => ({}),
    } as DOMRect);
    scrollRoot.appendChild(dom);
    document.body.appendChild(scrollRoot);
  } else {
    document.body.appendChild(dom);
  }
  return {
    dom,
    state: {
      doc: {
        content: { size: 5 },
      },
    },
  } as unknown as EditorView;
}

function getScrollRoot(): HTMLElement {
  const scrollRoot = document.querySelector<HTMLElement>('[data-note-scroll-root="true"]');
  if (!scrollRoot) throw new Error('Missing scroll root');
  return scrollRoot;
}

describe('BlockControlsViewSession', () => {
  afterEach(() => {
    clearCurrentEditorBlockPositionSnapshot();
    vi.mocked(applyBlockMove).mockClear();
    vi.mocked(getDraggableBlockRanges).mockClear();
    vi.mocked(getDraggableBlockRanges).mockReturnValue([{ from: 1, to: 5 }]);
    vi.mocked(resolveDropTarget).mockReset();
    vi.mocked(resolveDropTarget).mockReturnValue(null);
    vi.mocked(serializeSelectedBlocksToText).mockClear();
    vi.mocked(serializeSelectedBlocksToText).mockReturnValue('Selected block');
    document.body.innerHTML = '';
    document.elementsFromPoint = originalElementsFromPoint;
    mocks.targetTop = 40;
    mocks.setControlsPosition.mockClear();
  });

  it('refreshes the visible handle when the block position snapshot changes without pointer movement', async () => {
    const view = createView();
    const session = new BlockControlsViewSession(view);

    try {
      document.dispatchEvent(new MouseEvent('mousemove', { clientY: 50, bubbles: true }));
      await nextFrame();

      const controls = document.querySelector<HTMLElement>('.editor-block-controls');
      expect(controls?.style.top).toBe('50px');

      mocks.targetTop = 54;
      setCurrentEditorBlockPositionSnapshot({
        version: 1,
        view,
        doc: view.state.doc,
        editorRoot: view.dom,
        scrollRoot: null,
        scrollLeft: 0,
        scrollTop: 0,
        blocks: [],
        headings: [],
      });
      await nextFrame();

      expect(controls?.style.top).toBe('64px');
      expect(mocks.setControlsPosition).toHaveBeenCalledTimes(2);
    } finally {
      session.destroy();
    }
  });

  it('hides the handle when the pointer leaves the current note scroll root', async () => {
    const view = createView({ scrollRoot: true });
    const session = new BlockControlsViewSession(view);

    try {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 20, clientY: 50, bubbles: true }));
      await nextFrame();

      const controls = document.querySelector<HTMLElement>('.editor-block-controls');
      expect(controls?.classList.contains('visible')).toBe(true);

      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 20, clientY: 140, bubbles: true }));
      await nextFrame();

      expect(controls?.classList.contains('visible')).toBe(false);
    } finally {
      session.destroy();
    }
  });

  it('does not snap the handle to the nearest selected block when the pointer is far away', async () => {
    const view = createView({ scrollRoot: true });
    const session = new BlockControlsViewSession(view);

    try {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 20, clientY: 95, bubbles: true }));
      await nextFrame();

      const controls = document.querySelector<HTMLElement>('.editor-block-controls');
      expect(controls?.classList.contains('visible')).toBe(false);
    } finally {
      session.destroy();
    }
  });

  it('hides the visible handle when the window loses focus', async () => {
    const view = createView({ scrollRoot: true });
    const session = new BlockControlsViewSession(view);

    try {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 20, clientY: 50, bubbles: true }));
      await nextFrame();

      const controls = document.querySelector<HTMLElement>('.editor-block-controls');
      expect(controls?.classList.contains('visible')).toBe(true);

      window.dispatchEvent(new Event('blur'));
      await nextFrame();

      expect(controls?.classList.contains('visible')).toBe(false);
    } finally {
      session.destroy();
    }
  });

  it('does not move dragged blocks when the mouse is released over the notes chat drop target', () => {
    const view = createView();
    const session = new BlockControlsViewSession(view);
    const dropTarget = document.createElement('div');
    dropTarget.setAttribute('data-notes-block-drop-target', 'true');
    document.body.appendChild(dropTarget);

    vi.mocked(resolveDropTarget).mockReturnValue({
      insertPos: 5,
      lineLeft: 80,
      lineY: 100,
      lineWidth: 280,
    });
    document.elementsFromPoint = vi.fn(() => [dropTarget]);

    try {
      document
        .querySelector<HTMLElement>('.editor-block-control-handle')
        ?.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 20, clientY: 20, bubbles: true }));
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 40, clientY: 120, buttons: 1, bubbles: true }));
      document.dispatchEvent(new MouseEvent('mouseup', { clientX: 40, clientY: 120, bubbles: true }));

      expect(applyBlockMove).not.toHaveBeenCalled();
    } finally {
      session.destroy();
    }
  });

  it('does not reshow the handle at the drag start position after dropping outside the note viewport', async () => {
    const view = createView({ scrollRoot: true });
    const session = new BlockControlsViewSession(view);

    vi.mocked(resolveDropTarget).mockReturnValue({
      insertPos: 5,
      lineLeft: 80,
      lineY: 100,
      lineWidth: 280,
    });

    try {
      document
        .querySelector<HTMLElement>('.editor-block-control-handle')
        ?.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 20, clientY: 50, bubbles: true }));
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 40, clientY: 140, buttons: 1, bubbles: true }));
      document.dispatchEvent(new MouseEvent('mouseup', { clientX: 40, clientY: 140, bubbles: true }));
      await nextFrame();

      const controls = document.querySelector<HTMLElement>('.editor-block-controls');
      expect(controls?.classList.contains('visible')).toBe(false);
    } finally {
      session.destroy();
    }
  });

  it('hides the handle after canceling a block drag with Escape', async () => {
    const view = createView({ scrollRoot: true });
    const session = new BlockControlsViewSession(view);

    try {
      document
        .querySelector<HTMLElement>('.editor-block-control-handle')
        ?.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 20, clientY: 50, bubbles: true }));
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 40, clientY: 60, buttons: 1, bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await nextFrame();

      const controls = document.querySelector<HTMLElement>('.editor-block-controls');
      expect(controls?.classList.contains('visible')).toBe(false);
    } finally {
      session.destroy();
    }
  });

  it('hides the editor drop indicator while dragged blocks are over the notes chat drop target', () => {
    const view = createView();
    const session = new BlockControlsViewSession(view);
    const dropTarget = document.createElement('div');
    dropTarget.setAttribute('data-notes-block-drop-target', 'true');
    document.body.appendChild(dropTarget);

    vi.mocked(resolveDropTarget).mockReturnValue({
      insertPos: 5,
      lineLeft: 80,
      lineY: 100,
      lineWidth: 280,
    });

    try {
      document
        .querySelector<HTMLElement>('.editor-block-control-handle')
        ?.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 20, clientY: 20, bubbles: true }));

      document.elementsFromPoint = vi.fn(() => []);
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 40, clientY: 120, buttons: 1, bubbles: true }));
      const indicator = document.querySelector<HTMLElement>('.editor-block-drop-indicator');
      expect(indicator?.classList.contains('visible')).toBe(true);

      document.elementsFromPoint = vi.fn(() => [dropTarget]);
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 500, clientY: 120, buttons: 1, bubbles: true }));

      expect(indicator?.classList.contains('visible')).toBe(false);
    } finally {
      session.destroy();
    }
  });

  it('does not serialize oversized dragged block selections for chat drop payloads', () => {
    const view = createView();
    const session = new BlockControlsViewSession(view);
    vi.mocked(getDraggableBlockRanges).mockReturnValue([
      { from: 1, to: MAX_COMPOSER_PROGRAMMATIC_INSERT_CHARS + 2 },
    ]);

    try {
      document
        .querySelector<HTMLElement>('.editor-block-control-handle')
        ?.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 20, clientY: 20, bubbles: true }));

      expect(serializeSelectedBlocksToText).not.toHaveBeenCalled();
      expect(getBlockDragComposerPayload()).toBeNull();
    } finally {
      session.destroy();
    }
  });

  it('auto-scrolls the note viewport while dragging selected blocks near the edge', async () => {
    const view = createView({ scrollRoot: true });
    const session = new BlockControlsViewSession(view);
    const scrollRoot = getScrollRoot();

    vi.mocked(resolveDropTarget).mockReturnValue({
      insertPos: 5,
      lineLeft: 80,
      lineY: 100,
      lineWidth: 280,
    });

    try {
      document
        .querySelector<HTMLElement>('.editor-block-control-handle')
        ?.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 20, clientY: 20, bubbles: true }));
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 40, clientY: 95, buttons: 1, bubbles: true }));
      vi.mocked(resolveDropTarget).mockClear();

      await nextFrame();

      expect(scrollRoot.scrollTop).toBeGreaterThan(20);
      expect(resolveDropTarget).toHaveBeenCalledWith(view, 40, 95);
    } finally {
      session.destroy();
    }
  });
});
