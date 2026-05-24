import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EditorView } from '@milkdown/kit/prose/view';
import { BlockControlsViewSession } from './blockControlsViewSession';
import { applyBlockMove, resolveDropTarget } from './blockControlsInteractions';
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

function createView(): EditorView {
  const dom = document.createElement('div');
  document.body.appendChild(dom);
  return {
    dom,
    state: {
      doc: {
        content: { size: 5 },
      },
    },
  } as unknown as EditorView;
}

describe('BlockControlsViewSession', () => {
  afterEach(() => {
    clearCurrentEditorBlockPositionSnapshot();
    vi.mocked(applyBlockMove).mockClear();
    vi.mocked(resolveDropTarget).mockReset();
    vi.mocked(resolveDropTarget).mockReturnValue(null);
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

      const controls = document.querySelector<HTMLElement>('.vlaina-block-controls');
      expect(controls?.style.top).toBe('50px');

      mocks.targetTop = 120;
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

      expect(controls?.style.top).toBe('130px');
      expect(mocks.setControlsPosition).toHaveBeenCalledTimes(2);
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
        .querySelector<HTMLElement>('.vlaina-block-control-handle')
        ?.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 20, clientY: 20, bubbles: true }));
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 40, clientY: 120, buttons: 1, bubbles: true }));
      document.dispatchEvent(new MouseEvent('mouseup', { clientX: 40, clientY: 120, bubbles: true }));

      expect(applyBlockMove).not.toHaveBeenCalled();
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
        .querySelector<HTMLElement>('.vlaina-block-control-handle')
        ?.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 20, clientY: 20, bubbles: true }));

      document.elementsFromPoint = vi.fn(() => []);
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 40, clientY: 120, buttons: 1, bubbles: true }));
      const indicator = document.querySelector<HTMLElement>('.vlaina-block-drop-indicator');
      expect(indicator?.classList.contains('visible')).toBe(true);

      document.elementsFromPoint = vi.fn(() => [dropTarget]);
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 500, clientY: 120, buttons: 1, bubbles: true }));

      expect(indicator?.classList.contains('visible')).toBe(false);
    } finally {
      session.destroy();
    }
  });
});
