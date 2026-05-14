import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NoteTabContent } from './NoteTabContent';

const notesState = {
  notesPath: '/vault',
  draftNotes: {},
  error: null,
};

vi.mock('@/stores/useNotesStore', () => ({
  useNotesStore: (selector: (state: typeof notesState) => unknown) => selector(notesState),
}));

describe('NoteTabContent', () => {
  it('truncates long tab titles to fifteen visible characters', () => {
    render(
      <NoteTabContent
        tab={{ path: 'very-long-note-name.md', name: 'very-long-note-name', isDirty: false }}
        isActive={false}
        title="very-long-note-name"
      />,
    );

    expect(screen.getByText('very-long-note-....')).toBeInTheDocument();
    expect(screen.queryByText('very-long-note-name')).not.toBeInTheDocument();
  });
});
