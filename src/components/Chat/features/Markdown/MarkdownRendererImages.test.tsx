import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/components/Chat/common/LocalImage', () => ({
  LocalImage: (props: { alt?: string; src: string }) => (
    <img data-testid="local-image" alt={props.alt || 'image'} src={props.src} />
  ),
}));

vi.mock('./components/ChatImageViewer', () => ({
  ChatImageViewer: () => null,
}));

import MarkdownRenderer from './MarkdownRenderer';

describe('MarkdownRenderer images', () => {
  it('renders generated base64 image markdown as an image', () => {
    render(<MarkdownRenderer content="![Generated image](<data:image/png;base64,abc123>)" />);

    expect(screen.getByTestId('local-image')).toHaveAttribute('src', 'data:image/png;base64,abc123');
    expect(screen.queryByText('[Image unavailable]')).not.toBeInTheDocument();
  });

  it('still renders legacy unwrapped base64 image markdown', () => {
    render(<MarkdownRenderer content="![Generated image](data:image/png;base64,abc123)" />);

    expect(screen.getByTestId('local-image')).toHaveAttribute('src', 'data:image/png;base64,abc123');
  });
});
