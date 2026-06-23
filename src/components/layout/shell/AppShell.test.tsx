import { cleanup, render } from '@testing-library/react';
import { forwardRef, type ReactNode, type Ref } from 'react';
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
  UnifiedTitleBar: forwardRef<HTMLDivElement>(function UnifiedTitleBar(_props, ref) {
    return <div ref={ref} data-testid="titlebar" />;
  }),
}));

vi.mock('./UnifiedSidebarContainer', () => ({
  UnifiedSidebarContainer: ({
    children,
    widthScopeRef,
  }: {
    children: ReactNode;
    widthScopeRef?: Ref<HTMLDivElement>;
  }) => (
    <aside ref={widthScopeRef} data-testid="sidebar">{children}</aside>
  ),
}));

describe('AppShell', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('scopes live sidebar width variables away from the main shell root', () => {
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
    const titlebar = container.querySelector<HTMLElement>('[data-testid="titlebar"]');
    const sidebar = container.querySelector<HTMLElement>('[data-testid="sidebar"]');
    expect(shell).not.toBeNull();
    expect(titlebar).not.toBeNull();
    expect(sidebar).not.toBeNull();
    expect(shell!.style.getPropertyValue('--vlaina-shell-sidebar-width')).toBe('');
    expect(titlebar!.style.getPropertyValue('--vlaina-shell-sidebar-width')).toBe('260px');
    expect(titlebar!.style.getPropertyValue('--vlaina-width-sidebar-content-inner')).toBe(
      'calc(260px - var(--vlaina-size-32px))'
    );
    expect(sidebar!.style.getPropertyValue('--vlaina-shell-sidebar-width')).toBe('260px');
    expect(sidebar!.style.getPropertyValue('--vlaina-width-sidebar-content-inner')).toBe(
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

    expect(shell!.style.getPropertyValue('--vlaina-shell-sidebar-width')).toBe('');
    expect(titlebar!.style.getPropertyValue('--vlaina-shell-sidebar-width')).toBe('320px');
    expect(sidebar!.style.getPropertyValue('--vlaina-shell-sidebar-width')).toBe('320px');
    expect(sidebar!.style.getPropertyValue('--vlaina-width-sidebar-content-inner')).toBe(
      'calc(320px - var(--vlaina-size-32px))'
    );
  });
});
