import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EditorView } from '@milkdown/kit/prose/view';
import { createToolbarActionController } from './toolbarActions';
import { NOTES_COPY_FEEDBACK_DURATION_MS } from '../shared/copyFeedback';
import type { BlockRange } from '../cursor/blockSelectionUtils';

const commandMocks = vi.hoisted(() => ({
  copySelectionToClipboard: vi.fn(),
  setLink: vi.fn(),
  toggleMark: vi.fn(),
}));

const cleanupMocks = vi.hoisted(() => ({
  collapseSelectionAndHideFloatingToolbar: vi.fn(),
}));

const blockSelectionMocks = vi.hoisted(() => ({
  deleteSelectedBlocks: vi.fn(),
  getBlockSelectionPluginState: vi.fn(() => ({ selectedBlocks: [] as BlockRange[] })),
  blankAreaDragBoxPluginKey: {},
  clearBlocksAction: { type: 'clear-blocks' },
}));

vi.mock('./commands', () => ({
  copySelectionToClipboard: commandMocks.copySelectionToClipboard,
  setLink: commandMocks.setLink,
  toggleMark: commandMocks.toggleMark,
}));

vi.mock('../clipboard/copyCleanup', () => ({
  collapseSelectionAndHideFloatingToolbar: cleanupMocks.collapseSelectionAndHideFloatingToolbar,
}));

vi.mock('../cursor/blockSelectionCommands', () => ({
  deleteSelectedBlocks: blockSelectionMocks.deleteSelectedBlocks,
}));

vi.mock('../cursor/blockSelectionPluginState', () => ({
  CLEAR_BLOCKS_ACTION: blockSelectionMocks.clearBlocksAction,
  blankAreaDragBoxPluginKey: blockSelectionMocks.blankAreaDragBoxPluginKey,
  getBlockSelectionPluginState: blockSelectionMocks.getBlockSelectionPluginState,
}));

type MockToolbarView = EditorView & {
  dom: HTMLDivElement;
  state: {
    doc: {
      eq: ReturnType<typeof vi.fn>;
    };
    selection: {
      eq: ReturnType<typeof vi.fn>;
    };
    tr: {
      setMeta: ReturnType<typeof vi.fn>;
    };
  };
  dispatch: ReturnType<typeof vi.fn>;
};

function createMockView() {
  const dom = document.createElement('div');
  const doc = {
    eq: vi.fn((other: unknown) => other === doc),
  };
  const selection = {
    eq: vi.fn((other: unknown) => other === selection),
  };
  const tr = {
    setMeta: vi.fn(),
  };
  tr.setMeta.mockReturnValue(tr);

  return {
    dom,
    state: { doc, selection, tr },
    dispatch: vi.fn(),
  } as unknown as MockToolbarView;
}

function replaceMockSelection(view: MockToolbarView) {
  const selection = {
    eq: vi.fn((other: unknown) => other === selection),
  };
  view.state.selection = selection as MockToolbarView['state']['selection'];
  return selection;
}

describe('toolbarActions copy feedback', () => {
  afterEach(() => {
    vi.useRealTimers();
    commandMocks.copySelectionToClipboard.mockReset();
    cleanupMocks.collapseSelectionAndHideFloatingToolbar.mockReset();
    blockSelectionMocks.deleteSelectedBlocks.mockReset();
    blockSelectionMocks.getBlockSelectionPluginState.mockReset();
    blockSelectionMocks.getBlockSelectionPluginState.mockReturnValue({ selectedBlocks: [] });
  });

  it('suppresses mirrored CodeMirror selection only while copy feedback is visible', async () => {
    vi.useFakeTimers();
    commandMocks.copySelectionToClipboard.mockResolvedValue(true);
    const view = createMockView();
    const controller = createToolbarActionController(() => null);

    await controller.handleAction(view, 'copy');

    expect(view.dom.classList.contains('vlaina-toolbar-copy-feedback-active')).toBe(true);

    vi.advanceTimersByTime(NOTES_COPY_FEEDBACK_DURATION_MS);

    expect(cleanupMocks.collapseSelectionAndHideFloatingToolbar).toHaveBeenCalledWith(view);
    expect(view.dom.classList.contains('vlaina-toolbar-copy-feedback-active')).toBe(true);

    vi.advanceTimersByTime(40);

    expect(view.dom.classList.contains('vlaina-toolbar-copy-feedback-active')).toBe(false);

    controller.destroy();
  });

  it('suppresses mirrored CodeMirror selection before the async clipboard write finishes', async () => {
    let resolveCopy!: (value: boolean) => void;
    commandMocks.copySelectionToClipboard.mockReturnValue(new Promise<boolean>((resolve) => {
      resolveCopy = resolve;
    }));
    const view = createMockView();
    const controller = createToolbarActionController(() => null);

    const action = controller.handleAction(view, 'copy');

    expect(view.dom.classList.contains('vlaina-toolbar-copy-feedback-active')).toBe(true);

    resolveCopy(true);
    await action;

    controller.destroy();
  });

  it('does not collapse a newer selection after copy feedback expires', async () => {
    vi.useFakeTimers();
    commandMocks.copySelectionToClipboard.mockResolvedValue(true);
    const view = createMockView();
    const controller = createToolbarActionController(() => null);

    await controller.handleAction(view, 'copy');
    replaceMockSelection(view);

    vi.advanceTimersByTime(NOTES_COPY_FEEDBACK_DURATION_MS);

    expect(cleanupMocks.collapseSelectionAndHideFloatingToolbar).not.toHaveBeenCalled();

    vi.advanceTimersByTime(40);

    expect(view.dom.classList.contains('vlaina-toolbar-copy-feedback-active')).toBe(false);

    controller.destroy();
  });

  it('can prepare copy suppression before the copy action runs', () => {
    const view = createMockView();
    const controller = createToolbarActionController(() => null);

    controller.prepareAction(view, 'copy');

    expect(view.dom.classList.contains('vlaina-toolbar-copy-feedback-active')).toBe(true);

    controller.destroy();
    expect(view.dom.classList.contains('vlaina-toolbar-copy-feedback-active')).toBe(false);
  });

  it('clears prepared copy suppression when the copy action is canceled before click', () => {
    const view = createMockView();
    const controller = createToolbarActionController(() => null);

    controller.prepareAction(view, 'copy');
    controller.cancelPreparedAction('copy');

    expect(view.dom.classList.contains('vlaina-toolbar-copy-feedback-active')).toBe(false);

    controller.destroy();
  });

  it('clears copy feedback suppression when the controller is destroyed', async () => {
    vi.useFakeTimers();
    commandMocks.copySelectionToClipboard.mockResolvedValue(true);
    const view = createMockView();
    const controller = createToolbarActionController(() => null);

    await controller.handleAction(view, 'copy');
    controller.destroy();

    expect(view.dom.classList.contains('vlaina-toolbar-copy-feedback-active')).toBe(false);
    expect(cleanupMocks.collapseSelectionAndHideFloatingToolbar).not.toHaveBeenCalled();
  });

  it('deletes the active block selection before falling back to text selection deletion', async () => {
    const view = createMockView();
    const selectedBlocks = [{ from: 1, to: 6 }, { from: 6, to: 11 }];
    blockSelectionMocks.getBlockSelectionPluginState.mockReturnValue({ selectedBlocks });
    blockSelectionMocks.deleteSelectedBlocks.mockReturnValue(true);
    const controller = createToolbarActionController(() => null);

    await expect(controller.handleAction(view, 'delete')).resolves.toBe(false);

    expect(blockSelectionMocks.deleteSelectedBlocks).toHaveBeenCalledTimes(1);
    const [calledView, calledBlocks, applyClearSelectionMeta] = blockSelectionMocks.deleteSelectedBlocks.mock.calls[0];
    expect(calledView).toBe(view);
    expect(calledBlocks).toBe(selectedBlocks);
    expect(typeof applyClearSelectionMeta).toBe('function');

    const tr = { setMeta: vi.fn(() => tr) };
    expect(applyClearSelectionMeta(tr)).toBe(tr);
    expect(tr.setMeta).toHaveBeenCalledWith(
      blockSelectionMocks.blankAreaDragBoxPluginKey,
      blockSelectionMocks.clearBlocksAction,
    );
    expect(view.dispatch).not.toHaveBeenCalled();

    controller.destroy();
  });
});
