import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HeroIconHeader } from './HeroIconHeader';
import { useUIStore } from '@/stores/uiSlice';

vi.mock('@/components/common/AppIcon', () => ({
  AppIcon: ({ icon }: { icon: string }) => <span data-testid="header-icon">{icon}</span>,
}));

vi.mock('@/components/common/UniversalIconPicker/index', () => ({
  UniversalIconPicker: ({
    currentIcon,
    onPreview,
  }: {
    currentIcon?: string;
    onPreview?: (icon: string | null) => void;
  }) => (
    <div data-testid="icon-picker">
      <span data-testid="picker-current-icon">{currentIcon ?? ''}</span>
      <button type="button" onClick={() => onPreview?.('misc.heart')}>Preview heart</button>
      <button type="button" onClick={() => onPreview?.(null)}>Clear preview</button>
    </div>
  ),
}));

vi.mock('@/components/common/UniversalIconPicker/randomEmoji', () => ({
  getRandomHeaderEmoji: () => 'misc.star',
  preloadRandomEmojiData: vi.fn(),
  resolveEmojiForSkinTone: async (emoji: string) => emoji,
}));

describe('HeroIconHeader', () => {
  beforeEach(() => {
    useUIStore.getState().setUniversalPreview(null, {
      icon: null,
      color: null,
      tone: null,
      size: null,
    });

    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      return window.setTimeout(() => callback(performance.now()), 0);
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      clearTimeout(id);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps the newly committed icon visible when hover preview clears before parent props update', async () => {
    const onIconChange = vi.fn();

    const { container } = render(
      <HeroIconHeader
        id="note-1"
        icon={null}
        onIconChange={onIconChange}
        onRequestRandomIcon={() => 'misc.star'}
      />,
    );

    expect(container.querySelector('[data-no-editor-drag-box="true"]')).toBeInstanceOf(HTMLElement);

    fireEvent.click(screen.getByRole('button', { name: /add icon/i }));

    expect(onIconChange).toHaveBeenCalledWith('misc.star');
    expect(screen.getByTestId('header-icon')).toHaveTextContent('misc.star');
    expect(await screen.findByTestId('picker-current-icon')).toHaveTextContent('misc.star');

    fireEvent.click(screen.getByRole('button', { name: 'Preview heart' }));
    await waitFor(() => expect(screen.getByTestId('header-icon')).toHaveTextContent('misc.heart'));

    fireEvent.click(screen.getByRole('button', { name: 'Clear preview' }));

    await waitFor(() => expect(screen.getByTestId('header-icon')).toHaveTextContent('misc.star'));
  });
});
