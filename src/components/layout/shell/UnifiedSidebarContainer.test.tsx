import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UnifiedSidebarContainer } from './UnifiedSidebarContainer';

vi.mock('./useShellSidebarResize', () => ({
  useShellSidebarResize: () => ({ isDragging: false, handleDragStart: vi.fn() }),
}));

describe('UnifiedSidebarContainer', () => {
  it('keeps a peeking sidebar open while its editor has focus', () => {
    const onPeekChange = vi.fn();
    const hasFocus = vi.spyOn(document, 'hasFocus').mockReturnValue(true);

    render(
      <>
        <UnifiedSidebarContainer
          width={260}
          collapsed
          peeking
          onPeekChange={onPeekChange}
          onWidthChange={() => {}}
        >
          <input aria-label="Rename" />
        </UnifiedSidebarContainer>
        <button type="button">Outside</button>
      </>,
    );

    const input = screen.getByRole('textbox', { name: 'Rename' });
    const sidebar = input.closest('aside');
    input.focus();

    fireEvent.mouseLeave(sidebar!);
    expect(onPeekChange).not.toHaveBeenCalled();

    hasFocus.mockReturnValue(false);
    fireEvent.blur(input);
    expect(onPeekChange).not.toHaveBeenCalled();

    hasFocus.mockReturnValue(true);
    fireEvent.focusOut(input, { relatedTarget: screen.getByRole('button', { name: 'Outside' }) });
    expect(onPeekChange).toHaveBeenCalledWith(false);
  });
});
