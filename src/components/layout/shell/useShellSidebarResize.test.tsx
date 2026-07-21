import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useShellSidebarResize } from './useShellSidebarResize';

function SidebarResizeHarness({ onWidthChange }: { onWidthChange: (width: number) => void }) {
  const { handleDoubleClick } = useShellSidebarResize({
    width: 500,
    onWidthChange,
  });

  return <div data-testid="handle" onDoubleClick={handleDoubleClick} />;
}

describe('useShellSidebarResize', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resets to the capped 28 percent default on divider double click', () => {
    vi.stubGlobal('innerWidth', 1280);
    const onWidthChange = vi.fn();
    render(<SidebarResizeHarness onWidthChange={onWidthChange} />);

    fireEvent.doubleClick(screen.getByTestId('handle'));

    expect(onWidthChange).toHaveBeenCalledWith(358);
  });
});
