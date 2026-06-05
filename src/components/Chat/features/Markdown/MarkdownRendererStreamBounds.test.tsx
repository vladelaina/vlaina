import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MAX_CHAT_STREAM_ANIMATION_CHARS } from './chatStreamTextAnimation';

const reactMarkdownSpy = vi.hoisted(() => vi.fn());

vi.mock('react-markdown', () => ({
  default: (props: any) => {
    reactMarkdownSpy(props);
    return (
      <div
        data-testid="react-markdown"
        data-rehype-count={String(props.rehypePlugins.length)}
      >
        <div data-testid="markdown-children">{props.children}</div>
      </div>
    );
  },
}));

vi.mock('@/components/Chat/features/Messages/components/ThinkingBlock', () => ({
  ThinkingBlock: () => null,
}));

vi.mock('@/components/Chat/common/LocalImage', () => ({
  LocalImage: () => <img alt="mock" />,
}));

vi.mock('./components/ChatImageViewer', () => ({
  ChatImageViewer: () => null,
}));

import MarkdownRenderer from './MarkdownRenderer';

describe('MarkdownRenderer stream bounds', () => {
  it('renders oversized streaming markdown without the per-character animation plugin', () => {
    const content = 'x'.repeat(MAX_CHAT_STREAM_ANIMATION_CHARS + 1);

    render(<MarkdownRenderer content={content} isStreaming />);

    expect(screen.getByTestId('markdown-children').textContent).toBe(content);
    expect(screen.getByTestId('react-markdown')).toHaveAttribute('data-rehype-count', '8');
    expect(screen.getByTestId('react-markdown').parentElement).not.toHaveAttribute('data-chat-markdown-live');
    expect(screen.getByTestId('react-markdown').parentElement).not.toHaveClass('chat-markdown-live');
    expect(reactMarkdownSpy).toHaveBeenCalledTimes(1);
  });
});
