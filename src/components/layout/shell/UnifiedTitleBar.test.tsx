import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UnifiedTitleBar } from './UnifiedTitleBar';

const mocks = vi.hoisted(() => ({
  isMacOS: vi.fn(() => false),
}));

vi.mock('@/lib/desktop/platform', () => ({
  isMacOS: mocks.isMacOS,
}));

vi.mock('@/components/ui/icons', () => ({
  Icon: ({ name }: { name: string }) => <span>{name}</span>,
}));

vi.mock('@/components/layout/WindowControls', () => ({
  WindowControls: () => <div data-testid="window-controls" />,
}));

describe('UnifiedTitleBar', () => {
  it('reserves native traffic-light space when the sidebar is collapsed on macOS', () => {
    mocks.isMacOS.mockReturnValueOnce(true);

    render(
      <UnifiedTitleBar
        sidebarCollapsed
        onToggleSidebar={() => {}}
      />
    );

    expect(screen.getByRole('button').parentElement).toHaveClass('pl-[76px]');
  });

  it('keeps the collapsed sidebar toggle compact on non-mac platforms', () => {
    mocks.isMacOS.mockReturnValueOnce(false);

    render(
      <UnifiedTitleBar
        sidebarCollapsed
        onToggleSidebar={() => {}}
      />
    );

    expect(screen.getByRole('button').parentElement).toHaveClass('pl-2');
  });
});
