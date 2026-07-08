import { beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizePath } from '@/lib/storage/adapter/pathUtils';
import { normalizeWhiteboardSnapshot } from '../model/whiteboardDocument';
import { useWhiteboardStore } from './useWhiteboardStore';

const mocks = vi.hoisted(() => {
  const files = new Map<string, string>();
  const dirs = new Set<string>();
  return {
    dirs,
    files,
    storage: {
      exists: vi.fn(async (path: string) => files.has(normalizePath(path, true)) || dirs.has(normalizePath(path, true))),
      mkdir: vi.fn(async (path: string) => {
        dirs.add(normalizePath(path, true));
      }),
      readFile: vi.fn(async (path: string) => files.get(normalizePath(path, true)) ?? ''),
      writeFile: vi.fn(async (path: string, content: string) => {
        files.set(normalizePath(path, true), content);
      }),
    },
  };
});

vi.mock('@/lib/storage/adapter', () => ({
  getStorageAdapter: () => mocks.storage,
  joinPath: async (...segments: string[]) => normalizePath(segments.filter(Boolean).join('/'), true),
}));

describe('useWhiteboardStore', () => {
  beforeEach(() => {
    mocks.files.clear();
    mocks.dirs.clear();
    vi.clearAllMocks();
    useWhiteboardStore.setState(useWhiteboardStore.getInitialState(), true);
  });

  it('creates a visible next board and flushes the current board first', async () => {
    await useWhiteboardStore.getState().loadForNotesRoot('/notesRoot');
    useWhiteboardStore.getState().setActiveSnapshotDraft(normalizeWhiteboardSnapshot({
      elements: [{ height: 80, id: 'note-before-create', text: 'Keep me', type: 'note', width: 120, x: 1, y: 2 }],
    }));

    await useWhiteboardStore.getState().createBoard();

    const state = useWhiteboardStore.getState();
    expect(state.boards.map((board) => board.title)).toEqual(['Board', 'Board 2']);
    expect(state.boards.find((board) => board.id === state.activeBoardId)?.title).toBe('Board 2');
    expect(mocks.files.get('/notesRoot/.vlaina/whiteboards/boards/default/board.vlwb.json')).toContain('note-before-create');
  });
});
