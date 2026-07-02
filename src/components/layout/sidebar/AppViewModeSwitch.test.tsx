import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppViewModeSwitch } from './AppViewModeSwitch';

const hoisted = vi.hoisted(() => ({
  uiState: {
    appViewMode: 'chat' as 'notes' | 'chat' | 'whiteboard' | 'lab',
    setAppViewMode: vi.fn(),
  },
}));

vi.mock('@/components/ui/icons', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
}));

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => ({
      'app.viewNotes': 'Notes',
      'app.viewChat': 'Chat',
      'app.viewWhiteboard': 'Board',
      'shortcut.action.toggleAppViewMode': 'Switch app view',
    }[key] ?? key),
  }),
}));

vi.mock('@/stores/uiSlice', () => ({
  useUIStore: (selector: (state: typeof hoisted.uiState) => unknown) => selector(hoisted.uiState),
}));

describe('AppViewModeSwitch', () => {
  beforeEach(() => {
    hoisted.uiState.appViewMode = 'chat';
    hoisted.uiState.setAppViewMode.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('optimistically syncs the Notes text color with the selected thumb while switching', () => {
    const { container } = render(<AppViewModeSwitch />);
    const notesTab = screen.getByRole('tab', { name: 'Notes' });
    const boardTab = screen.getByRole('tab', { name: 'Board' });
    const chatTab = screen.getByRole('tab', { name: 'Chat' });
    const tablist = screen.getByRole('tablist', { name: 'Switch app view' });
    const thumb = container.querySelector('[aria-hidden="true"]');

    expect(chatTab).toHaveAttribute('aria-selected', 'true');
    expect(boardTab).toHaveAttribute('aria-selected', 'false');
    expect(tablist).toHaveStyle({
      '--vlaina-app-view-mode-option-count': '3',
      '--vlaina-width-view-mode-thumb': 'calc((100% - var(--vlaina-space-075rem)) / var(--vlaina-app-view-mode-option-count))',
    });
    expect(thumb?.className).toContain('bg-[var(--vlaina-sidebar-row-selected-bg)]');
    expect(thumb).toHaveStyle({ transform: 'translateX(200%)' });

    fireEvent.click(notesTab);

    expect(hoisted.uiState.setAppViewMode).toHaveBeenCalledWith('notes');
    expect(notesTab).toHaveAttribute('aria-selected', 'true');
    expect(notesTab.className).toContain('text-[length:var(--vlaina-font-15)]');
    expect(notesTab.className).not.toContain('transition-colors');
    expect(notesTab).toHaveStyle({ color: 'var(--vlaina-sidebar-row-selected-text)' });
    expect(chatTab).toHaveAttribute('aria-selected', 'false');
    expect(thumb).toHaveStyle({ transform: 'translateX(0%)' });
  });
});
