import { render } from '@testing-library/react';
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
});
