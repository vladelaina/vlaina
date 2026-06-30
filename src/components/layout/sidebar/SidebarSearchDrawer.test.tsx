import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createRef, useRef } from 'react';
import { SidebarSearchDrawer, useSidebarSearchDrawerState } from './SidebarSearchDrawer';

function SearchControlsHarness({
  attachScope = true,
  onClose,
}: {
  attachScope?: boolean;
  onClose: () => void;
}) {
  const scopeRef = useRef<HTMLDivElement | null>(null);
  const {
    inputRef,
    scrollRootRef,
  } = useSidebarSearchDrawerState({
    isOpen: true,
    query: 'alpha',
    onOpen: () => {},
    onClose,
    scopeRef,
  });

  return (
    <>
      {attachScope ? (
        <div ref={scopeRef}>
          <div ref={scrollRootRef}>
            <input ref={inputRef} aria-label="Search" />
          </div>
        </div>
      ) : null}
      <textarea aria-label="Outside editor" />
      <div role="dialog">
        <button type="button">Dialog action</button>
      </div>
    </>
  );
}

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

  it('closes search from an outside editor even when an unrelated dialog exists', () => {
    const onClose = vi.fn();
    render(<SearchControlsHarness onClose={onClose} />);

    screen.getByLabelText('Outside editor').focus();
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes search from an outside editor even if Escape carries stale modifiers', () => {
    const onClose = vi.fn();
    render(<SearchControlsHarness onClose={onClose} />);

    screen.getByLabelText('Outside editor').focus();
    fireEvent.keyDown(document, { key: 'Escape', ctrlKey: true, shiftKey: true });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes search even if the interaction scope is not attached yet', () => {
    const onClose = vi.fn();
    render(<SearchControlsHarness attachScope={false} onClose={onClose} />);

    screen.getByLabelText('Outside editor').focus();
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close search when Escape starts inside a dialog', () => {
    const onClose = vi.fn();
    render(<SearchControlsHarness onClose={onClose} />);

    screen.getByRole('button', { name: 'Dialog action' }).focus();
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });

    expect(onClose).not.toHaveBeenCalled();
  });
});
