import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NoteTabContent } from './NoteTabContent';

const notesState = {
  notesPath: '/notesRoot',
  draftNotes: {},
  error: null,
  saveError: null as string | null,
  saveErrorPath: null as string | null,
};

vi.mock('@/stores/useNotesStore', () => ({
  useNotesStore: (selector: (state: typeof notesState) => unknown) => selector(notesState),
}));

describe('NoteTabContent', () => {
  beforeEach(() => {
    notesState.saveError = null;
    notesState.saveErrorPath = null;
  });

  it('renders long tab titles in full and lets layout clipping decide overflow', () => {
    render(
      <NoteTabContent
        tab={{ path: 'very-long-note-name.md', name: 'very-long-note-name', isDirty: false }}
        isActive={false}
        title="very-long-note-name"
      />,
    );

    expect(screen.getByText('very-long-note-name')).toBeInTheDocument();
    expect(screen.queryByText('very-long-note-....')).not.toBeInTheDocument();
  });

  it('attaches the label ref to the rendered tab title text', () => {
    const labelRef = { current: null as HTMLSpanElement | null };

    render(
      <NoteTabContent
        tab={{ path: 'short-name.md', name: 'short-name', isDirty: false }}
        isActive={false}
        title="short-name"
        labelRef={labelRef}
      />,
    );

    expect(labelRef.current).toBe(screen.getByText('short-name'));
  });

  it('only shows an active dirty indicator for that note save error', () => {
    notesState.saveError = 'disk full';
    notesState.saveErrorPath = 'other.md';
    const props = {
      tab: { path: 'alpha.md', name: 'alpha', isDirty: true },
      isActive: true,
      title: 'alpha',
    };
    const view = render(<NoteTabContent {...props} />);
    expect(view.container.querySelector('span.h-1\\.5')).toBeNull();

    notesState.saveErrorPath = 'alpha.md';
    view.rerender(<NoteTabContent {...props} />);
    expect(view.container.querySelector('span.h-1\\.5')).not.toBeNull();
  });
});
