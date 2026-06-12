import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppViewModeSwitch } from './AppViewModeSwitch';

const hoisted = vi.hoisted(() => ({
  uiState: {
    appViewMode: 'chat' as 'notes' | 'chat' | 'lab',
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
    const chatTab = screen.getByRole('tab', { name: 'Chat' });
    const thumb = container.querySelector('[aria-hidden="true"]');

    expect(chatTab).toHaveAttribute('aria-selected', 'true');
    expect(thumb?.className).toContain('translate-x-full');

    fireEvent.click(notesTab);

    expect(hoisted.uiState.setAppViewMode).toHaveBeenCalledWith('notes');
    expect(notesTab).toHaveAttribute('aria-selected', 'true');
    expect(notesTab.className).toContain('text-[length:var(--vlaina-font-15)]');
    expect(notesTab.className).not.toContain('transition-colors');
    expect(notesTab).toHaveStyle({ color: 'var(--vlaina-accent)' });
    expect(chatTab).toHaveAttribute('aria-selected', 'false');
    expect(thumb?.className).not.toContain('translate-x-full');
  });
});
