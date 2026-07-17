import { StrictMode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GraphView } from './GraphView';

const hoisted = vi.hoisted(() => ({
  notesState: {
    currentNote: null as { content: string; path: string } | null,
    noteContentsCache: new Map(),
    noteContentsCacheRevision: 0,
    notesPath: '',
    openNote: vi.fn(),
    rootFolder: null as { children: Array<Record<string, unknown>> } | null,
    rootFolderPath: null as string | null,
    scanAllNotes: vi.fn(),
  },
  notesRootState: {
    currentNotesRoot: { name: 'Test notes', path: '/tmp/test-notes' },
  },
  uiState: { setAppViewMode: vi.fn() },
}));

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('@/stores/notes/useNotesStore', () => ({
  useNotesStore: (selector: (state: typeof hoisted.notesState) => unknown) => selector(hoisted.notesState),
}));

vi.mock('@/stores/useNotesRootStore', () => ({
  useNotesRootStore: (selector: (state: typeof hoisted.notesRootState) => unknown) => selector(hoisted.notesRootState),
}));

vi.mock('@/stores/uiSlice', () => ({
  useUIStore: (selector: (state: typeof hoisted.uiState) => unknown) => selector(hoisted.uiState),
}));

describe('GraphView', () => {
  beforeEach(() => {
    localStorage.clear();
    hoisted.notesState.currentNote = null;
    hoisted.notesState.noteContentsCache = new Map();
    hoisted.notesState.noteContentsCacheRevision = 0;
    hoisted.notesState.notesPath = '';
    hoisted.notesState.rootFolder = null;
    hoisted.notesState.rootFolderPath = null;
    hoisted.notesState.scanAllNotes.mockClear();
    hoisted.notesState.scanAllNotes.mockResolvedValue(undefined);
  });

  it('uses a stable empty position snapshot before a graph layout has been saved', () => {
    render(<GraphView />);

    expect(screen.getByText('graph.empty')).toBeInTheDocument();
  });

  it('mounts a populated graph in StrictMode without an effect feedback loop', async () => {
    hoisted.notesState.currentNote = { content: '# Alpha', path: 'Alpha.md' };
    hoisted.notesState.notesPath = '/tmp/test-notes';
    hoisted.notesState.rootFolderPath = '/tmp/test-notes';
    hoisted.notesState.rootFolder = {
      children: [{
        id: 'Alpha.md',
        isFolder: false,
        kind: 'note',
        name: 'Alpha.md',
        path: 'Alpha.md',
      }],
    };
    hoisted.notesState.noteContentsCache = new Map([
      ['Alpha.md', { content: '# Alpha', modifiedAt: 1 }],
    ]);

    render(
      <StrictMode>
        <GraphView active={false} />
      </StrictMode>,
    );

    expect(await screen.findByRole('img', { name: 'app.viewGraph' })).toBeInTheDocument();
    expect(document.querySelector('[data-graph-view-mode="true"]')).toHaveAttribute('data-graph-active', 'false');
    await waitFor(() => expect(hoisted.notesState.scanAllNotes).toHaveBeenCalledWith(
      expect.objectContaining({ background: true, priorityPaths: ['Alpha.md'] }),
    ));
  });
});
