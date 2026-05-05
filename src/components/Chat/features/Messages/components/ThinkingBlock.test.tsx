import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThinkingBlock } from './ThinkingBlock';

class ResizeObserverMock {
  static instances: ResizeObserverMock[] = [];

  observe = vi.fn();
  disconnect = vi.fn();

  constructor(_callback: ResizeObserverCallback) {
    ResizeObserverMock.instances.push(this);
  }
}

describe('ThinkingBlock', () => {
  beforeEach(() => {
    ResizeObserverMock.instances = [];
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reuses a single ResizeObserver across content updates', () => {
    const view = render(
      <ThinkingBlock
        content="First thought"
        isStreaming={false}
      />,
    );

    view.rerender(
      <ThinkingBlock
        content="Second thought"
        isStreaming={false}
      />,
    );
    view.rerender(
      <ThinkingBlock
        content="Third thought"
        isStreaming={false}
      />,
    );

    expect(ResizeObserverMock.instances).toHaveLength(1);
    expect(ResizeObserverMock.instances[0]!.observe).toHaveBeenCalledTimes(1);

    view.unmount();

    expect(ResizeObserverMock.instances[0]!.disconnect).toHaveBeenCalledTimes(1);
  });

  it('shows completed thinking collapsed by default and allows it to be expanded', () => {
    const { container } = render(
      <ThinkingBlock
        content="Finished thought"
        isStreaming={false}
      />,
    );

    const wrapper = container.querySelector<HTMLElement>('[style*="opacity"]');
    expect(wrapper).toHaveStyle({ opacity: '0' });
    const toggle = screen.getByRole('button', { name: 'Reasoning' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(wrapper).toHaveStyle({ opacity: '1' });
  });

  it('collapses live thinking after the answer starts streaming', () => {
    const { rerender } = render(
      <ThinkingBlock
        content="Streaming thought"
        isStreaming
      />,
    );

    const toggle = screen.getByRole('button', { name: 'Thought...' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    rerender(
      <ThinkingBlock
        content="Streaming thought"
        isStreaming={false}
      />,
    );

    expect(screen.getByRole('button', { name: 'Reasoning' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('uses the live markdown animation layer while thinking is streaming', () => {
    const { container, rerender } = render(
      <ThinkingBlock
        content="Streaming thought"
        isStreaming
      />,
    );

    const liveSurface = container.querySelector('[data-chat-markdown-live="true"]');
    expect(liveSurface).toHaveClass('chat-markdown-live');

    rerender(
      <ThinkingBlock
        content="Streaming thought"
        isStreaming={false}
      />,
    );

    expect(container.querySelector('[data-chat-markdown-live="true"]')).not.toBeInTheDocument();
  });

  it('allows active thinking to be collapsed while streaming', () => {
    const { container } = render(
      <ThinkingBlock
        content="Streaming thought"
        isStreaming
      />,
    );

    const toggle = screen.getByRole('button', { name: 'Thought...' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    const wrapper = container.querySelector<HTMLElement>('[style*="max-height"]');
    expect(wrapper).toHaveStyle({ maxHeight: '12rem' });
  });
});
