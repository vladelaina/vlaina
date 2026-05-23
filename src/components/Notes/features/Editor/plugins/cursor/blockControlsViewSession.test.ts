import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EditorView } from '@milkdown/kit/prose/view';
import { BlockControlsViewSession } from './blockControlsViewSession';
import {
  clearCurrentEditorBlockPositionSnapshot,
  setCurrentEditorBlockPositionSnapshot,
} from '../../utils/editorBlockPositionCache';

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
    document.body.innerHTML = '';
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
});
