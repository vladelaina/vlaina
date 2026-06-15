import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CoverAddOverlay } from './CoverAddOverlay';

describe('CoverAddOverlay', () => {
  it('renders below editor toolbar controls while staying clickable', () => {
    const onAddCover = vi.fn();
    const { container } = render(<CoverAddOverlay visible onAddCover={onAddCover} />);
    const overlay = container.firstElementChild;

    expect(overlay).toHaveClass('z-[var(--vlaina-z-20)]');
    expect(overlay).not.toHaveClass('z-[var(--vlaina-z-30)]');
    expect(overlay).toHaveAttribute('data-no-editor-drag-box', 'true');

    fireEvent.mouseDown(overlay!);
    expect(onAddCover).not.toHaveBeenCalled();

    fireEvent.click(overlay!);

    expect(onAddCover).toHaveBeenCalledTimes(1);
  });

  it('does not render when hidden', () => {
    const { container } = render(<CoverAddOverlay visible={false} onAddCover={vi.fn()} />);

    expect(container.firstChild).toBeNull();
  });
});
