import { render, screen, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TitleInput } from './TitleInput';

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

describe('TitleInput', () => {
  let width = 0;
  let scrollHeight = 1200;
  let originalRect: typeof HTMLTextAreaElement.prototype.getBoundingClientRect;
  let originalScrollHeight: PropertyDescriptor | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
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
});
