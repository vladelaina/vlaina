import { fireEvent, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VirtualEmojiGrid } from './VirtualEmojiGrid';

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 34,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        size: 34,
        start: index * 34,
      })),
    scrollToIndex: vi.fn(),
  }),
}));

describe('VirtualEmojiGrid', () => {
  it('renders mixed recent icons and keeps their preview and select values', async () => {
    const onPreview = vi.fn();
    const onSelect = vi.fn();
    const imageLoader = vi.fn(async () => 'blob:logo');
    const recentIcons = [
      'assets/icons/logo.png',
      'icon:star:currentColor',
      '😀',
    ];

    const { container } = render(
      <VirtualEmojiGrid
        emojis={[]}
        skinTone={0}
        onSelect={onSelect}
        onPreview={onPreview}
        recentIcons={recentIcons}
        categoryId="people"
        categoryName="Smileys & People"
        imageLoader={imageLoader}
      />,
    );

    const recentButtons = Array.from(container.querySelectorAll<HTMLButtonElement>('[data-icon]'));
    expect(recentButtons.map((button) => button.dataset.icon)).toEqual(recentIcons);

    fireEvent.mouseOver(recentButtons[0]);
    expect(onPreview).toHaveBeenCalledWith('assets/icons/logo.png');

    fireEvent.click(recentButtons[0]);
    expect(onSelect).toHaveBeenCalledWith('assets/icons/logo.png');

    await waitFor(() => {
      expect(imageLoader).toHaveBeenCalledWith('assets/icons/logo.png');
    });
    expect(container.querySelector('img[alt="icon"]')).toHaveStyle({
      width: '20px',
      height: '20px',
    });
  });
});
