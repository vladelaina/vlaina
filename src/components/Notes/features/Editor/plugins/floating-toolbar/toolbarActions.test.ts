import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EditorView } from '@milkdown/kit/prose/view';
import { createToolbarActionController } from './toolbarActions';
import { NOTES_COPY_FEEDBACK_DURATION_MS } from '../shared/copyFeedback';

const commandMocks = vi.hoisted(() => ({
  copySelectionToClipboard: vi.fn(),
  setLink: vi.fn(),
  toggleMark: vi.fn(),
}));

const cleanupMocks = vi.hoisted(() => ({
  collapseSelectionAndHideFloatingToolbar: vi.fn(),
}));

vi.mock('./commands', () => ({
  copySelectionToClipboard: commandMocks.copySelectionToClipboard,
  setLink: commandMocks.setLink,
  toggleMark: commandMocks.toggleMark,
}));

vi.mock('../clipboard/copyCleanup', () => ({
  collapseSelectionAndHideFloatingToolbar: cleanupMocks.collapseSelectionAndHideFloatingToolbar,
}));

type MockToolbarView = EditorView & {
  dom: HTMLDivElement;
  state: {
    tr: {
      setMeta: ReturnType<typeof vi.fn>;
    };
  };
  dispatch: ReturnType<typeof vi.fn>;
};

function createMockView() {
  const dom = document.createElement('div');
  const tr = {
    setMeta: vi.fn(),
  };
  tr.setMeta.mockReturnValue(tr);

  return {
    dom,
    state: { tr },
    dispatch: vi.fn(),
  } as unknown as MockToolbarView;
}

describe('toolbarActions copy feedback', () => {
  afterEach(() => {
    vi.useRealTimers();
    commandMocks.copySelectionToClipboard.mockReset();
    cleanupMocks.collapseSelectionAndHideFloatingToolbar.mockReset();
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
});
