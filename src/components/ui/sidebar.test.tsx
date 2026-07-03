import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SidebarProvider, useSidebar } from './sidebar';

function SidebarStateProbe() {
  const { state } = useSidebar();
  return <div data-testid="sidebar-state">{state}</div>;
}

describe('SidebarProvider', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not toggle the sidebar shortcut during IME composition', () => {
    render(
      <SidebarProvider defaultOpen>
        <SidebarStateProbe />
      </SidebarProvider>,
    );

    fireEvent.keyDown(window, {
      key: 'b',
      shiftKey: true,
      ctrlKey: true,
      isComposing: true,
    });

    expect(screen.getByTestId('sidebar-state')).toHaveTextContent('expanded');
  });

  it('toggles the sidebar shortcut outside IME composition', () => {
    render(
      <SidebarProvider defaultOpen>
        <SidebarStateProbe />
      </SidebarProvider>,
    );

    fireEvent.keyDown(window, {
      key: 'b',
      shiftKey: true,
      ctrlKey: true,
    });

    expect(screen.getByTestId('sidebar-state')).toHaveTextContent('collapsed');
  });
});
