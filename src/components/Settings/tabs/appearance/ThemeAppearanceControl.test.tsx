import type { ReactNode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearMarkdownThemePreview,
  useEffectiveImportedMarkdownThemeId,
} from '@/components/markdown-theme/markdownThemePreview';
import { ThemeAppearanceControl } from './ThemeAppearanceControl';

vi.mock('@/components/ui/icons', () => ({
  Icon: ({ name }: { name: string }) => <span>{name}</span>,
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children, ...props }: { children: ReactNode }) => (
    <div role="menu" {...props}>{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onFocus,
    onPointerEnter,
    onSelect,
    ...props
  }: {
    children: ReactNode;
    onFocus?: () => void;
    onPointerEnter?: () => void;
    onSelect?: () => void;
  }) => (
    <button
      type="button"
      role="menuitem"
      onFocus={onFocus}
      onPointerEnter={onPointerEnter}
      onClick={onSelect}
      {...props}
    >
      {children}
    </button>
  ),
}));

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key === 'settings.appearance.theme.default' ? 'Default' : key,
  }),
}));

const themes = ['first', 'second'].map((id) => ({
  id,
  name: id,
  platform: 'typora' as const,
  cssFile: `${id}.css`,
  sourcePath: `/themes/${id}.css`,
  sourceModifiedAt: 1,
  sourceSize: 1,
  createdAt: 1,
  updatedAt: 1,
}));

function EffectiveTheme() {
  const id = useEffectiveImportedMarkdownThemeId('saved');
  return <output>{id ?? 'default'}</output>;
}

describe('ThemeAppearanceControl preview', () => {
  afterEach(() => {
    vi.useRealTimers();
    clearMarkdownThemePreview();
  });

  it('previews only the last hovered theme and restores the saved theme on leave', () => {
    vi.useFakeTimers();
    const onThemeChange = vi.fn();
    const onThemePreload = vi.fn();

    render(<>
      <ThemeAppearanceControl
        colorMode="system"
        importedThemeId="saved"
        importedThemes={themes}
        onColorModeChange={vi.fn()}
        onThemeChange={onThemeChange}
        onThemeRefresh={vi.fn()}
        onThemeWarmup={vi.fn()}
        onThemePreload={onThemePreload}
      />
      <EffectiveTheme />
    </>);

    fireEvent.pointerEnter(screen.getByRole('menuitem', { name: 'first' }));
    fireEvent.pointerEnter(screen.getByRole('menuitem', { name: 'second' }));
    act(() => vi.advanceTimersByTime(80));

    expect(screen.getByRole('status')).toHaveTextContent('second');
    expect(onThemePreload).toHaveBeenCalledTimes(1);
    expect(onThemePreload).toHaveBeenCalledWith('second');
    expect(onThemeChange).not.toHaveBeenCalled();

    fireEvent.pointerLeave(screen.getByRole('menu'));
    expect(screen.getByRole('status')).toHaveTextContent('saved');
  });
});
