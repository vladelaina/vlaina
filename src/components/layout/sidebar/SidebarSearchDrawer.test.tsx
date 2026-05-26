import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createRef } from 'react';
import { SidebarSearchDrawer } from './SidebarSearchDrawer';

describe('SidebarSearchDrawer', () => {
  it('handles arrow key selection before submit', () => {
    const onSelectPrevious = vi.fn();
    const onSelectNext = vi.fn();
    const onSubmit = vi.fn();

    render(
      <SidebarSearchDrawer
        isSearchOpen
        shouldShowTopActions={false}
        searchQuery="alpha"
        setSearchQuery={() => {}}
        inputRef={createRef<HTMLInputElement>()}
        hideSearch={() => {}}
        canSubmit
        onSubmit={onSubmit}
        canSelectPrevious
        canSelectNext
        onSelectPrevious={onSelectPrevious}
        onSelectNext={onSelectNext}
        placeholder=""
        closeLabel="Close search"
        topActions={null}
      />,
    );

    const input = screen.getByRole('textbox');
    const downEvent = fireEvent.keyDown(input, { key: 'ArrowDown' });
    const upEvent = fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(downEvent).toBe(false);
    expect(upEvent).toBe(false);
    expect(onSelectNext).toHaveBeenCalledTimes(1);
    expect(onSelectPrevious).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('leaves arrow keys alone when there is no selectable result', () => {
    const onSelectNext = vi.fn();

    render(
      <SidebarSearchDrawer
        isSearchOpen
        shouldShowTopActions={false}
        searchQuery="missing"
        setSearchQuery={() => {}}
        inputRef={createRef<HTMLInputElement>()}
        hideSearch={() => {}}
        canSubmit={false}
        onSubmit={() => {}}
        canSelectNext={false}
        onSelectNext={onSelectNext}
        placeholder=""
        closeLabel="Close search"
        topActions={null}
      />,
    );

    const input = screen.getByRole('textbox');
    const downEvent = fireEvent.keyDown(input, { key: 'ArrowDown' });

    expect(downEvent).toBe(true);
    expect(onSelectNext).not.toHaveBeenCalled();
  });
});
