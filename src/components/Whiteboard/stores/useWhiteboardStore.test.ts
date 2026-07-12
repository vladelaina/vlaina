import { beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizePath } from '@/lib/storage/adapter/pathUtils';
import { getNotesRootStorageKey } from '@/lib/storage/notesRootStorageKey';
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
      getBasePath: vi.fn(async () => '/app'),
      mkdir: vi.fn(async (path: string) => {
        dirs.add(normalizePath(path, true));
      }),
      readFile: vi.fn(async (path: string) => files.get(normalizePath(path, true)) ?? ''),
      deleteDir: vi.fn(async (path: string) => {
        const normalizedPath = normalizePath(path, true);
        for (const filePath of files.keys()) {
          if (filePath === normalizedPath || filePath.startsWith(`${normalizedPath}/`)) files.delete(filePath);
        }
        for (const dirPath of dirs) {
          if (dirPath === normalizedPath || dirPath.startsWith(`${normalizedPath}/`)) dirs.delete(dirPath);
        }
      }),
      rename: vi.fn(async () => undefined),
      copyFile: vi.fn(async () => undefined),
      listDir: vi.fn(async () => []),
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

const SYSTEM_ROOT = `/app/.vlaina/whiteboards/notes-roots/${getNotesRootStorageKey('/notesRoot')}`;

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
    expect(mocks.files.get(`${SYSTEM_ROOT}/boards/default/board.vlwb.json`)).toContain('note-before-create');
  });

  it('renames a board without changing its storage folder', async () => {
    await useWhiteboardStore.getState().loadForNotesRoot('/notesRoot');
    const board = useWhiteboardStore.getState().boards[0];

    await useWhiteboardStore.getState().renameBoard(board.id, 'Project sketch');

    expect(useWhiteboardStore.getState().boards[0]).toMatchObject({
      folder: board.folder,
      id: board.id,
      title: 'Project sketch',
    });
    expect(mocks.files.get(`${SYSTEM_ROOT}/index.json`)).toContain('Project sketch');
  });

  it('selects the neighboring board after deleting the active board', async () => {
    await useWhiteboardStore.getState().loadForNotesRoot('/notesRoot');
    await useWhiteboardStore.getState().createBoard();
    const deletedBoardId = useWhiteboardStore.getState().activeBoardId;

    await useWhiteboardStore.getState().deleteBoard(deletedBoardId!);

    const state = useWhiteboardStore.getState();
    expect(state.boards).toHaveLength(1);
    expect(state.activeBoardId).toBe(state.boards[0].id);
    expect(state.activeBoardId).not.toBe(deletedBoardId);
    expect(mocks.storage.deleteDir).toHaveBeenCalled();
  });

  it('keeps an empty board available after deleting the final board', async () => {
    await useWhiteboardStore.getState().loadForNotesRoot('/notesRoot');
    const deletedBoardId = useWhiteboardStore.getState().activeBoardId;

    await useWhiteboardStore.getState().deleteBoard(deletedBoardId!);

    const state = useWhiteboardStore.getState();
    expect(state.boards).toHaveLength(1);
    expect(state.activeBoardId).not.toBe(deletedBoardId);
    expect(state.boards[0].title).toBe('Board');
  });
});
