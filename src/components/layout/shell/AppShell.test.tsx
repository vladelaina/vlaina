import { cleanup, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from './AppShell';

const mocks = vi.hoisted(() => ({
  setLayoutPanelDragging: vi.fn(),
  setWindowResizeActive: vi.fn(),
}));

vi.mock('@/stores/uiSlice', () => ({
  useUIStore: (selector: (state: {
    setLayoutPanelDragging: typeof mocks.setLayoutPanelDragging;
    setWindowResizeActive: typeof mocks.setWindowResizeActive;
  }) => unknown) => selector({
    setLayoutPanelDragging: mocks.setLayoutPanelDragging,
    setWindowResizeActive: mocks.setWindowResizeActive,
  }),
}));

vi.mock('./UnifiedTitleBar', () => ({
  UnifiedTitleBar: () => <div data-testid="titlebar" />,
}));

vi.mock('./UnifiedSidebarContainer', () => ({
  UnifiedSidebarContainer: ({ children }: { children: ReactNode }) => (
    <aside data-testid="sidebar">{children}</aside>
  ),
}));

describe('AppShell', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('writes both sidebar width variables on the shell root', () => {
    const { container, rerender } = render(
      <AppShell
        sidebarWidth={260}
        sidebarCollapsed={false}
        sidebarContent={<div>Sidebar</div>}
        onSidebarWidthChange={() => {}}
        onSidebarToggle={() => {}}
      >
        <div>Main</div>
      </AppShell>
    );

    const shell = container.querySelector<HTMLElement>('[data-app-shell-root="true"]');
    expect(shell).not.toBeNull();
    expect(shell!.style.getPropertyValue('--vlaina-shell-sidebar-width')).toBe('260px');
    expect(shell!.style.getPropertyValue('--vlaina-width-sidebar-content-inner')).toBe(
      'calc(260px - var(--vlaina-size-32px))'
    );

    rerender(
      <AppShell
        sidebarWidth={320}
        sidebarCollapsed={false}
        sidebarContent={<div>Sidebar</div>}
        onSidebarWidthChange={() => {}}
        onSidebarToggle={() => {}}
      >
        <div>Main</div>
      </AppShell>
    );

    expect(shell!.style.getPropertyValue('--vlaina-shell-sidebar-width')).toBe('320px');
    expect(shell!.style.getPropertyValue('--vlaina-width-sidebar-content-inner')).toBe(
      'calc(320px - var(--vlaina-size-32px))'
    );
  });
});
