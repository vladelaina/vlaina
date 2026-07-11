import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NoteSaveStatus } from './NoteSaveStatus';

const notesState = {
  error: null as string | null,
  isDirty: false,
};

vi.mock('@/stores/useNotesStore', () => ({
  useNotesStore: (selector: (state: typeof notesState) => unknown) => selector(notesState),
}));

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => ({
      'common.saved': 'Saved',
      'common.saving': 'Saving...',
      'storage.saveFailed': 'Save failed',
    })[key] ?? key,
  }),
}));

describe('NoteSaveStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    notesState.error = null;
    notesState.isDirty = false;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows saving, then briefly shows saved after persistence finishes', () => {
    const { rerender } = render(<NoteSaveStatus notePath="alpha.md" />);
    expect(screen.queryByRole('status')).toBeNull();

    notesState.isDirty = true;
    rerender(<NoteSaveStatus notePath="alpha.md" />);
    expect(screen.getByRole('status')).toHaveTextContent('Saving...');
    expect(screen.getByRole('status')).toHaveAttribute('data-note-save-status', 'saving');

    notesState.isDirty = false;
    rerender(<NoteSaveStatus notePath="alpha.md" />);
    expect(screen.getByRole('status')).toHaveTextContent('Saved');

    act(() => vi.runAllTimers());
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('keeps a save failure visible and does not describe drafts as autosaving', () => {
    notesState.isDirty = true;
    notesState.error = 'disk full';
    const { rerender } = render(<NoteSaveStatus notePath="alpha.md" />);
    expect(screen.getByRole('status')).toHaveTextContent('Save failed');
    expect(screen.getByRole('status')).toHaveAttribute('data-note-save-status', 'error');

    rerender(<NoteSaveStatus notePath="draft:alpha" />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('does not present unrelated notes errors as save failures', () => {
    notesState.error = 'Failed to load the file tree';

    render(<NoteSaveStatus notePath="alpha.md" />);

    expect(screen.queryByRole('status')).toBeNull();
  });
});
