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

  it('allows completed thinking to be expanded after auto-collapse', () => {
    const { container } = render(
      <ThinkingBlock
        content="Finished thought"
        isStreaming={false}
      />,
    );

    const wrapper = container.querySelector<HTMLElement>('[style*="opacity"]');
    expect(wrapper).toHaveStyle({ opacity: '0' });

    fireEvent.click(screen.getByText('Reasoning'));

    expect(wrapper).toHaveStyle({ opacity: '1' });
  });
});
