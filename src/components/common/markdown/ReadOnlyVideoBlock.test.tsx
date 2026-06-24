import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReadOnlyVideoBlock } from './ReadOnlyVideoBlock';
import { openExternalHref } from '@/lib/navigation/externalLinks';

vi.mock('@/lib/navigation/externalLinks', () => ({
  openExternalHref: vi.fn(),
}));

describe('ReadOnlyVideoBlock', () => {
  it('does not expose supported video source or title in DOM data attributes', () => {
    const src = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&token=secret';
    const { container } = render(<ReadOnlyVideoBlock src={src} title="private title" />);

    expect(container.querySelector('.video-block')).not.toHaveAttribute('data-src');
    expect(container.querySelector('.video-block')).not.toHaveAttribute('data-title');
    expect(container.innerHTML).not.toContain('token=secret');
    expect(container.innerHTML).not.toContain('private title');

    fireEvent.click(screen.getByRole('button'));
    expect(openExternalHref).toHaveBeenCalledWith(src);
  });

  it('does not auto-embed public provider iframes in read-only markdown', () => {
    const { container } = render(<ReadOnlyVideoBlock src="https://www.youtube.com/watch?v=dQw4w9WgXcQ" />);

    expect(container.querySelector('iframe')).toBeNull();
    expect(container.innerHTML).not.toContain('allow-same-origin');
    expect(container.innerHTML).not.toContain('camera');
    expect(container.innerHTML).not.toContain('microphone');
  });

  it('renders public direct video URLs with native controls', () => {
    const { container } = render(<ReadOnlyVideoBlock src="https://example.com/video.mp4" title="Demo" />);
    const video = container.querySelector('video');

    expect(video).toBeInstanceOf(HTMLVideoElement);
    expect(video).toHaveAttribute('src', 'https://example.com/video.mp4');
    expect(video).toHaveAttribute('preload', 'none');
    expect(container.textContent).not.toContain('Remote video blocked');
  });
});
