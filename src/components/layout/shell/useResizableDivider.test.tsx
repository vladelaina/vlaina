import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useResizableDivider } from './useResizableDivider';

function DividerHarness({
  width = 280,
  onWidthChange,
}: {
  width?: number;
  onWidthChange: (width: number) => void;
}) {
  const { handleDragStart } = useResizableDivider({
    width,
    minWidth: 240,
    maxWidth: 500,
    defaultWidth: 280,
    onWidthChange,
  });

  return <div data-testid="handle" onMouseDown={handleDragStart} />;
}

describe('useResizableDivider', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });

  it('does not schedule a live width update when the computed width is unchanged', () => {
    const onWidthChange = vi.fn();
    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      });

    render(<DividerHarness onWidthChange={onWidthChange} />);

    fireEvent.mouseDown(screen.getByTestId('handle'), { clientX: 100 });
    fireEvent.mouseMove(document, { clientX: 100 });

    expect(requestAnimationFrameSpy).not.toHaveBeenCalled();
    expect(onWidthChange).not.toHaveBeenCalled();

    fireEvent.mouseMove(document, { clientX: 110 });
    fireEvent.mouseMove(document, { clientX: 110 });

    expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(1);
    expect(onWidthChange).toHaveBeenCalledTimes(1);
    expect(onWidthChange).toHaveBeenCalledWith(290);

    fireEvent.mouseUp(document);
  });
});
