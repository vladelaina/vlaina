import { fireEvent, render, screen, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TitleInput } from './TitleInput';
import { NATIVE_CARET_OVERLAY_REFRESH_EVENT } from '@/hooks/useNativeCaretOverlay';

const focusEditorMock = vi.hoisted(() => ({
  focusEditorToFirstLineEnd: vi.fn(),
}));

const notesState = {
  renameNote: vi.fn(async () => undefined),
  renameAbsoluteNote: vi.fn(async () => undefined),
  updateDraftNoteName: vi.fn(),
  saveNote: vi.fn(async () => undefined),
};

vi.mock('@/stores/useNotesStore', () => ({
  useNotesStore: Object.assign(
    (selector: (state: typeof notesState) => unknown) => selector(notesState),
    {
      getState: () => ({
        ...notesState,
        notesPath: '/vault',
      }),
    },
  ),
}));

vi.mock('@/stores/uiSlice', () => ({
  useUIStore: (selector: (state: { setNotesPreviewTitle: typeof vi.fn }) => unknown) =>
    selector({ setNotesPreviewTitle: vi.fn() }),
}));

vi.mock('@/stores/useToastStore', () => ({
  useToastStore: (selector: (state: { addToast: typeof vi.fn }) => unknown) =>
    selector({ addToast: vi.fn() }),
}));

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('./utils/focusEditor', () => ({
  focusEditorToFirstLineEnd: focusEditorMock.focusEditorToFirstLineEnd,
}));

describe('TitleInput', () => {
  let width = 0;
  let scrollHeight = 1200;
  let originalRect: typeof HTMLTextAreaElement.prototype.getBoundingClientRect;
  let originalScrollHeight: PropertyDescriptor | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    width = 0;
    scrollHeight = 1200;
    originalRect = HTMLTextAreaElement.prototype.getBoundingClientRect;
    originalScrollHeight = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'scrollHeight');

    HTMLTextAreaElement.prototype.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: width,
      bottom: 40,
      width,
      height: 40,
      toJSON: () => ({}),
    });
    Object.defineProperty(HTMLTextAreaElement.prototype, 'scrollHeight', {
      configurable: true,
      get: () => scrollHeight,
    });
  });

  afterEach(() => {
    HTMLTextAreaElement.prototype.getBoundingClientRect = originalRect;
    if (originalScrollHeight) {
      Object.defineProperty(HTMLTextAreaElement.prototype, 'scrollHeight', originalScrollHeight);
    } else {
      delete (HTMLTextAreaElement.prototype as { scrollHeight?: number }).scrollHeight;
    }
    vi.useRealTimers();
  });

  it('does not lock a bogus title height when first measured before layout has width', () => {
    render(<TitleInput notePath="/vault/test.md" initialTitle="test" />);

    const input = screen.getByDisplayValue('test') as HTMLTextAreaElement;
    expect(input.style.height).toBe('');

    width = 360;
    scrollHeight = 44;

    act(() => {
      vi.advanceTimersByTime(120);
    });

    expect(input.style.height).toBe('44px');
  });

  it('resets stale internal title scroll before refreshing the focused caret overlay', async () => {
    width = 360;
    scrollHeight = 44;
    const caretRefreshListener = vi.fn();
    document.addEventListener(NATIVE_CARET_OVERLAY_REFRESH_EVENT, caretRefreshListener);

    try {
      render(<TitleInput notePath="/vault/test.md" initialTitle="Long title" />);

      const input = screen.getByDisplayValue('Long title') as HTMLTextAreaElement;
      input.focus();
      input.scrollTop = 28;
      input.scrollLeft = 6;

      await act(async () => {
        fireEvent.change(input, { target: { value: '' } });
      });

      expect(input.scrollTop).toBe(0);
      expect(input.scrollLeft).toBe(0);
      expect(caretRefreshListener).toHaveBeenCalled();
    } finally {
      document.removeEventListener(NATIVE_CARET_OVERLAY_REFRESH_EVENT, caretRefreshListener);
    }
  });

  it.each([
    { ctrlKey: true },
    { shiftKey: true },
    { metaKey: true },
    { altKey: true },
  ])('does not intercept modified ArrowDown in the title input: %o', (eventInit) => {
    render(<TitleInput notePath="/vault/test.md" initialTitle="test" />);

    const input = screen.getByDisplayValue('test') as HTMLTextAreaElement;

    expect(
      fireEvent.keyDown(input, {
        key: 'ArrowDown',
        ...eventInit,
      })
    ).toBe(true);
  });

  it('moves from the title to the first body line end on plain ArrowDown', async () => {
    render(<TitleInput notePath="/vault/test.md" initialTitle="test" />);

    const input = screen.getByDisplayValue('test') as HTMLTextAreaElement;

    await act(async () => {
      fireEvent.keyDown(input, {
        key: 'ArrowDown',
      });
      await Promise.resolve();
    });
    act(() => {
      vi.advanceTimersByTime(16);
    });

    expect(focusEditorMock.focusEditorToFirstLineEnd).toHaveBeenCalledTimes(1);
  });

  it('does not commit or move focus when Enter is pressed during IME composition', () => {
    const onEnter = vi.fn();
    render(<TitleInput notePath="/vault/test.md" initialTitle="test" onEnter={onEnter} />);

    const input = screen.getByDisplayValue('test') as HTMLTextAreaElement;

    expect(
      fireEvent.keyDown(input, {
        key: 'Enter',
        isComposing: true,
      })
    ).toBe(true);

    expect(onEnter).not.toHaveBeenCalled();
    expect(notesState.renameNote).not.toHaveBeenCalled();
    expect(notesState.renameAbsoluteNote).not.toHaveBeenCalled();
  });

  it('does not leave the title input on ArrowDown during IME composition', () => {
    render(<TitleInput notePath="/vault/test.md" initialTitle="test" />);

    const input = screen.getByDisplayValue('test') as HTMLTextAreaElement;

    expect(
      fireEvent.keyDown(input, {
        key: 'ArrowDown',
        isComposing: true,
      })
    ).toBe(true);

    expect(notesState.renameNote).not.toHaveBeenCalled();
    expect(notesState.renameAbsoluteNote).not.toHaveBeenCalled();
  });

  it('keeps a cleared existing title empty on blur so the Untitled placeholder remains visible', async () => {
    render(<TitleInput notePath="/vault/test.md" initialTitle="test" />);

    const input = screen.getByDisplayValue('test') as HTMLTextAreaElement;

    fireEvent.change(input, { target: { value: '' } });
    await act(async () => {
      fireEvent.blur(input);
    });

    expect(input.value).toBe('');
    expect(screen.getByPlaceholderText('notes.untitled')).toBe(input);
    expect(notesState.renameNote).not.toHaveBeenCalled();
    expect(notesState.renameAbsoluteNote).not.toHaveBeenCalled();
  });

  it('clears a draft title on blur instead of restoring the previous draft name', async () => {
    render(<TitleInput notePath="draft:test" initialTitle="Draft title" />);

    const input = screen.getByDisplayValue('Draft title') as HTMLTextAreaElement;

    fireEvent.change(input, { target: { value: '' } });
    await act(async () => {
      fireEvent.blur(input);
    });

    expect(input.value).toBe('');
    expect(notesState.updateDraftNoteName).toHaveBeenCalledWith('draft:test', '');
    expect(notesState.saveNote).toHaveBeenCalledWith({ explicit: false });
  });
});
