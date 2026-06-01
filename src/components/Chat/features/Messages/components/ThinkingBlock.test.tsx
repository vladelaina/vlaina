import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThinkingBlock } from './ThinkingBlock';
import { dispatchChatSelectionStreamFreeze } from './chatSelectionStreamFreeze';

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
    vi.useRealTimers();
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
    expect(wrapper).toHaveAttribute('data-chat-thinking-collapsed', 'true');
    expect(container.querySelector('[data-chat-selection-surface="true"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-chat-selection-start="true"]')).not.toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: 'Reasoning' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(wrapper).toHaveStyle({ opacity: '1' });
    expect(wrapper).not.toHaveAttribute('data-chat-thinking-collapsed');
    expect(container.querySelector('[data-chat-selection-surface="true"]')).toBeInTheDocument();
    expect(container.querySelector('[data-chat-selection-start="true"]')).toBeInTheDocument();
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
    expect(liveSurface).toHaveClass('markdown-surface');

    rerender(
      <ThinkingBlock
        content="Streaming thought"
        isStreaming={false}
      />,
    );

    expect(container.querySelector('[data-chat-markdown-live="true"]')).not.toBeInTheDocument();
  });

  it('renders thinking code blocks through the shared markdown components', () => {
    const { container } = render(
      <ThinkingBlock
        content={"```ts\nconst value = 1;\n```"}
        isStreaming={false}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reasoning' }));

    expect(container.querySelector('.code-block-chrome')).not.toBeNull();
    expect(container.querySelector('.code-block-chrome-language-label')).toHaveTextContent('ts');
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
    expect(wrapper).toHaveStyle({ maxHeight: '0px', opacity: '0' });
  });

  it('freezes live thinking content while stream animation is suspended', () => {
    const { container, rerender } = render(
      <ThinkingBlock
        content="First thought"
        isStreaming
      />,
    );

    rerender(
      <ThinkingBlock
        content="First thought plus more"
        isStreaming
        suspendStreamAnimation
      />,
    );

    expect(container).toHaveTextContent('First thought plus more');

    rerender(
      <ThinkingBlock
        content="First thought plus more and more"
        isStreaming
        suspendStreamAnimation
      />,
    );

    expect(container).toHaveTextContent('First thought plus more');
    expect(container).not.toHaveTextContent('First thought plus more and more');

    rerender(
      <ThinkingBlock
        content="First thought plus more and more"
        isStreaming
      />,
    );

    expect(container).toHaveTextContent('First thought plus more and more');
  });

  it('freezes live thinking content after mouse down selection starts', () => {
    const { container, rerender } = render(
      <ThinkingBlock
        content="First thought"
        isStreaming
      />,
    );

    const surface = container.querySelector('[data-chat-selection-surface="true"]')!;
    fireEvent.mouseDown(surface, { button: 0 });

    rerender(
      <ThinkingBlock
        content="First thought plus more"
        isStreaming
      />,
    );

    expect(container).toHaveTextContent('First thought');
    expect(container).not.toHaveTextContent('First thought plus more');
  });

  it('freezes live thinking content from the global selection start signal', () => {
    const { container, rerender } = render(
      <ThinkingBlock
        content="First thought"
        isStreaming
      />,
    );

    const surface = container.querySelector('[data-chat-selection-surface="true"]')!;
    act(() => {
      dispatchChatSelectionStreamFreeze({
        button: 0,
        source: 'mousedown',
        target: surface,
      });
    });

    rerender(
      <ThinkingBlock
        content="First thought plus more"
        isStreaming
      />,
    );

    expect(container).toHaveTextContent('First thought');
    expect(container).not.toHaveTextContent('First thought plus more');
  });

  it('freezes completed thinking while the parent message is still streaming', () => {
    const { container, rerender } = render(
      <ThinkingBlock
        content="Completed thought"
        isStreaming={false}
        isMessageStreaming
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reasoning' }));
    const surface = container.querySelector('[data-chat-selection-surface="true"]')!;
    fireEvent.mouseDown(surface, { button: 0 });

    rerender(
      <ThinkingBlock
        content="Completed thought plus more"
        isStreaming={false}
        isMessageStreaming
      />,
    );

    expect(container).toHaveTextContent('Completed thought');
    expect(container).not.toHaveTextContent('Completed thought plus more');
  });

  it('keeps live thinking frozen while a completed selection remains active', () => {
    vi.useFakeTimers();
    let selectedText = 'First';
    const selectionSpy = vi.spyOn(window, 'getSelection').mockReturnValue({
      get isCollapsed() {
        return selectedText.length === 0;
      },
      rangeCount: 1,
      toString: () => selectedText,
    } as Selection);
    const { container, rerender } = render(
      <ThinkingBlock
        content="First thought"
        isStreaming
      />,
    );

    const surface = container.querySelector('[data-chat-selection-surface="true"]')!;
    fireEvent.mouseDown(surface, { button: 0 });
    rerender(
      <ThinkingBlock
        content="First thought plus more"
        isStreaming
      />,
    );
    fireEvent.pointerUp(document);

    expect(container).toHaveTextContent('First thought');
    expect(container).not.toHaveTextContent('First thought plus more');

    act(() => {
      vi.advanceTimersByTime(701);
    });
    rerender(
      <ThinkingBlock
        content="First thought plus more and more"
        isStreaming
      />,
    );

    expect(container).toHaveTextContent('First thought');
    expect(container).not.toHaveTextContent('First thought plus more and more');

    selectedText = '';
    fireEvent(document, new Event('selectionchange'));
    act(() => {
      vi.advanceTimersByTime(121);
    });
    rerender(
      <ThinkingBlock
        content="First thought plus more and more"
        isStreaming
      />,
    );

    expect(container).toHaveTextContent('First thought plus more and more');
    selectionSpy.mockRestore();
  });
});
