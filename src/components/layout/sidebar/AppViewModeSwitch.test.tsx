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

  it('optimistically expands only the selected view while switching', () => {
    const { container } = render(<AppViewModeSwitch />);
    const notesTab = screen.getByRole('tab', { name: 'Notes' });
    const boardTab = screen.getByRole('tab', { name: 'Board' });
    const chatTab = screen.getByRole('tab', { name: 'Chat' });

    expect(chatTab).toHaveAttribute('aria-selected', 'true');
    expect(boardTab).toHaveAttribute('aria-selected', 'false');
    expect(chatTab).toHaveStyle({ flexGrow: 1 });
    const activeBackground = container.querySelector('[aria-hidden="true"]');
    expect(activeBackground).toHaveClass('bg-[var(--vlaina-sidebar-row-selected-bg)]');
    expect(screen.getByText('Chat')).toHaveClass('opacity-[var(--vlaina-opacity-100)]');
    expect(screen.getByText('Notes')).toHaveClass('opacity-[var(--vlaina-opacity-0)]');
    expect(screen.getByText('Board')).toHaveClass('opacity-[var(--vlaina-opacity-0)]');

    fireEvent.click(notesTab);

    expect(hoisted.uiState.setAppViewMode).toHaveBeenCalledWith('notes');
    expect(notesTab).toHaveAttribute('aria-selected', 'true');
    expect(notesTab.className).toContain('text-[length:var(--vlaina-font-15)]');
    expect(notesTab.className).not.toContain('transition-colors');
    expect(notesTab).toHaveStyle({ color: 'var(--vlaina-sidebar-row-selected-text)' });
    expect(notesTab).toHaveStyle({ flexGrow: 1 });
    expect(screen.getByText('Notes')).toHaveClass('opacity-[var(--vlaina-opacity-100)]');
    expect(chatTab).toHaveAttribute('aria-selected', 'false');
    expect(chatTab).toHaveStyle({ flexGrow: 0 });
    expect(container.querySelector('[aria-hidden="true"]')).toBe(activeBackground);
  });
});
