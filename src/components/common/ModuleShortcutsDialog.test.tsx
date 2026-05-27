import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ModuleShortcutsDialog } from './ModuleShortcutsDialog';

vi.mock('@/hooks/useDialogWindowDrag', () => ({
  useDialogWindowDrag: () => ({
    handleDragHandleMouseDown: vi.fn(),
    handleInteractOutside: vi.fn(),
    handlePointerDownOutside: vi.fn(),
  }),
}));

const sections = [
  {
    title: 'General',
    shortcuts: [
      { action: 'Open settings', keys: ['Ctrl', ','] },
      { action: 'Show shortcuts', keys: ['Ctrl', '/'] },
      { action: 'Toggle sidebar', keys: ['Ctrl', '\\'] },
    ],
  },
  {
    title: 'Chat',
    shortcuts: [
      { action: 'Copy last response', keys: ['Ctrl', 'Shift', 'C'] },
    ],
  },
];

describe('ModuleShortcutsDialog', () => {
  it('filters shortcuts with the search field and shows an empty state', () => {
    render(
      <ModuleShortcutsDialog
        module="chat"
        open
        onOpenChange={vi.fn()}
        title="Shortcuts"
        sections={sections}
      />,
    );

    const searchInput = screen.getByRole('searchbox', { name: 'Search Shortcuts' });

    fireEvent.change(searchInput, { target: { value: 'copy' } });
    expect(screen.getByText('Copy last response')).toBeInTheDocument();
    expect(screen.queryByText('Open settings')).not.toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: 'missing shortcut' } });
    expect(screen.getByText('No results')).toBeInTheDocument();
  });

  it('filters shortcuts by flexible shortcut key input formats', () => {
    render(
      <ModuleShortcutsDialog
        module="chat"
        open
        onOpenChange={vi.fn()}
        title="Shortcuts"
        sections={sections}
      />,
    );

    const searchInput = screen.getByRole('searchbox', { name: 'Search Shortcuts' });

    fireEvent.change(searchInput, { target: { value: 'ctrl+shift+c' } });
    expect(screen.getByText('Copy last response')).toBeInTheDocument();
    expect(screen.queryByText('Open settings')).not.toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: 'command shift c' } });
    expect(screen.getByText('Copy last response')).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: 'ctrl-shift-c' } });
    expect(screen.getByText('Copy last response')).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: 'control comma' } });
    expect(screen.getByText('Open settings')).toBeInTheDocument();
    expect(screen.queryByText('Copy last response')).not.toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: 'ctrl,' } });
    expect(screen.getByText('Open settings')).toBeInTheDocument();
    expect(screen.queryByText('Copy last response')).not.toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: 'cmd slash' } });
    expect(screen.getByText('Show shortcuts')).toBeInTheDocument();
  });

  it('does not treat separator-only shortcut searches as matching every shortcut', () => {
    render(
      <ModuleShortcutsDialog
        module="chat"
        open
        onOpenChange={vi.fn()}
        title="Shortcuts"
        sections={sections}
      />,
    );

    const searchInput = screen.getByRole('searchbox', { name: 'Search Shortcuts' });

    fireEvent.change(searchInput, { target: { value: '+' } });
    expect(screen.getByText('No results')).toBeInTheDocument();
  });
});
