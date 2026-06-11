import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { SidebarUserHeader } from './SidebarUserHeader';
import { useUIStore } from '@/stores/uiSlice';

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/ui/icons', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
}));

vi.mock('@/components/ui/shortcut-keys', () => ({
  ShortcutKeys: () => <span data-testid="shortcut-keys" />,
}));

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('./WorkspaceSwitcher', () => ({
  WorkspaceSwitcher: ({ className }: { className?: string }) => (
    <div className={className} data-testid="workspace-switcher" />
  ),
}));

describe('SidebarUserHeader', () => {
  beforeEach(() => {
    useUIStore.setState({ devPlatformPreview: 'system' });
  });

  afterEach(() => {
    cleanup();
  });

  it('uses the compact titlebar padding on the system platform preview', async () => {
    const { container } = render(<SidebarUserHeader toggleSidebar={() => {}} />);

    await screen.findByTestId('workspace-switcher');

    expect(container.querySelector('.sidebar-user-header')).toHaveClass('pl-3');
  });

  it('reserves macOS traffic-light space during macOS platform preview', async () => {
    useUIStore.setState({ devPlatformPreview: 'macos' });

    const { container } = render(<SidebarUserHeader toggleSidebar={() => {}} />);

    await screen.findByTestId('workspace-switcher');

    expect(container.querySelector('.sidebar-user-header')).toHaveClass('pl-[var(--vlaina-space-76px)]');
  });
});
