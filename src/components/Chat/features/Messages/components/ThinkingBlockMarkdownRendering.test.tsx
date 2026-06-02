import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { reactMarkdownSpy } = vi.hoisted(() => ({
  reactMarkdownSpy: vi.fn(),
}));

vi.mock('react-markdown', () => ({
  default: (props: { children?: unknown }) => {
    reactMarkdownSpy(String(props.children ?? ''));
    return <div data-testid="react-markdown">{String(props.children ?? '')}</div>;
  },
}));

import { ThinkingBlock } from './ThinkingBlock';

class ResizeObserverMock {
  observe = vi.fn();
  disconnect = vi.fn();
}

describe('ThinkingBlock markdown rendering', () => {
  beforeEach(() => {
    reactMarkdownSpy.mockClear();
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not rerender stable streaming markdown blocks when only the active tail changes', () => {
    const stable = `${'Stable thought. '.repeat(14)}\n\n`;
    const firstTail = 'First tail';
    const secondTail = 'First tail grows';

    const view = render(
      <ThinkingBlock
        content={`${stable}${firstTail}`}
        isStreaming
      />,
    );

    expect(reactMarkdownSpy).toHaveBeenCalledWith(stable);
    expect(reactMarkdownSpy).toHaveBeenCalledWith(firstTail);

    reactMarkdownSpy.mockClear();
    view.rerender(
      <ThinkingBlock
        content={`${stable}${secondTail}`}
        isStreaming
      />,
    );

    expect(reactMarkdownSpy).not.toHaveBeenCalledWith(stable);
    expect(reactMarkdownSpy).toHaveBeenCalledWith(secondTail);
  });
});
