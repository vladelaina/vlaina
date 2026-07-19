import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearDiagnosticsLog, getDiagnosticsLogText } from '@/lib/diagnostics/diagnosticsLog';
import { NoteSaveStatus } from './NoteSaveStatus';

const notesState = {
  error: null as string | null,
  isDirty: false,
  saveError: null as string | null,
  saveErrorPath: null as string | null,
};

vi.mock('@/stores/useNotesStore', () => ({
  useNotesStore: (selector: (state: typeof notesState) => unknown) => selector(notesState),
}));

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => ({
      'storage.saveFailed': 'Save failed',
    })[key] ?? key,
  }),
}));

describe('NoteSaveStatus', () => {
  beforeEach(() => {
    clearDiagnosticsLog();
    notesState.error = null;
    notesState.isDirty = false;
    notesState.saveError = null;
    notesState.saveErrorPath = null;
  });
  it('stays hidden after persistence finishes', () => {
    const { rerender } = render(<NoteSaveStatus notePath="alpha.md" />);
    expect(screen.queryByRole('status')).toBeNull();

    notesState.isDirty = true;
    rerender(<NoteSaveStatus notePath="alpha.md" />);
    expect(screen.queryByRole('status')).toBeNull();

    notesState.isDirty = false;
    rerender(<NoteSaveStatus notePath="alpha.md" />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('keeps a save failure visible and does not describe drafts as autosaving', () => {
    notesState.isDirty = true;
    notesState.error = 'disk full';
    notesState.saveError = 'disk full';
    notesState.saveErrorPath = 'alpha.md';
    const { rerender } = render(<NoteSaveStatus notePath="alpha.md" />);
    expect(screen.getByRole('status')).toHaveTextContent('Save failed');
    expect(screen.getByRole('status')).toHaveAttribute('data-note-save-status', 'error');
    const report = JSON.parse(getDiagnosticsLogText());
    expect(report.entries).toContainEqual(expect.objectContaining({
      channel: 'note-save',
      event: 'save-error-visible',
      details: expect.objectContaining({ errorMessage: 'disk full' }),
    }));

    rerender(<NoteSaveStatus notePath="draft:alpha" />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('does not show another note autosave failure on the active note', () => {
    notesState.isDirty = true;
    notesState.saveError = 'disk full';
    notesState.saveErrorPath = 'other.md';

    render(<NoteSaveStatus notePath="alpha.md" />);

    expect(screen.queryByRole('status')).toBeNull();
  });

  it('does not present unrelated notes errors as save failures', () => {
    notesState.error = 'Failed to load the file tree';
    notesState.isDirty = true;

    render(<NoteSaveStatus notePath="alpha.md" />);

    expect(screen.queryByRole('status')).toBeNull();
  });
});
