import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useEditorLayout } from './useEditorLayout';

function EditorLayoutHarness({
  isPeeking = false,
  peekOffset = 320,
}: {
  isPeeking?: boolean;
  peekOffset?: number;
}) {
  const { contentOffset } = useEditorLayout(isPeeking, peekOffset);
  return <div data-content-offset={contentOffset} />;
}

describe('useEditorLayout', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not subscribe to viewport resize when the editor is not peeking', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

    render(<EditorLayoutHarness />);

    expect(addEventListenerSpy).not.toHaveBeenCalledWith('resize', expect.any(Function));
  });

  it('subscribes to viewport resize when the editor is peeking', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

    render(<EditorLayoutHarness isPeeking />);

    expect(addEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
  });
});
