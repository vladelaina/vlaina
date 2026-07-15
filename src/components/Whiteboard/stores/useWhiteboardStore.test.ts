import { beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizePath } from '@/lib/storage/adapter/pathUtils';
import { getNotesRootStorageKey } from '@/lib/storage/notesRootStorageKey';
import { WHITEBOARD_SYSTEM_STORAGE_SCOPE } from '@/lib/storage/whiteboardStoragePaths';
import { normalizeWhiteboardSnapshot } from '../model/whiteboardDocument';
import { flushWhiteboardStorage, useWhiteboardStore } from './useWhiteboardStore';

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
      deleteFile: vi.fn(async (path: string) => {
        files.delete(normalizePath(path, true));
      }),
      rename: vi.fn(async (source: string, target: string) => {
        const normalizedSource = normalizePath(source, true);
        const content = files.get(normalizedSource);
        if (content === undefined) throw new Error('Source does not exist');
        files.set(normalizePath(target, true), content);
        files.delete(normalizedSource);
      }),
      copyFile: vi.fn(async (source: string, target: string) => {
        const content = files.get(normalizePath(source, true));
        if (content === undefined) throw new Error('Source does not exist');
        files.set(normalizePath(target, true), content);
      }),
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
const DEFAULT_SYSTEM_ROOT = `/app/.vlaina/whiteboards/notes-roots/${getNotesRootStorageKey(WHITEBOARD_SYSTEM_STORAGE_SCOPE)}`;

describe('useWhiteboardStore', () => {
  beforeEach(() => {
    mocks.files.clear();
    mocks.dirs.clear();
    vi.clearAllMocks();
    useWhiteboardStore.setState(useWhiteboardStore.getInitialState(), true);
  });

  it('creates and persists one default board in the system storage scope', async () => {
    await useWhiteboardStore.getState().loadForNotesRoot(WHITEBOARD_SYSTEM_STORAGE_SCOPE);

    const state = useWhiteboardStore.getState();
    expect(state.boards).toHaveLength(1);
    expect(state.activeBoardId).toBe('default');
    expect(mocks.files.has(`${DEFAULT_SYSTEM_ROOT}/index.json`)).toBe(true);
    expect(mocks.files.has(`${DEFAULT_SYSTEM_ROOT}/boards/default/board.vlwb.json`)).toBe(true);
  });

  it('creates a visible next board and flushes the current board first', async () => {
    await useWhiteboardStore.getState().loadForNotesRoot('/notesRoot');
    useWhiteboardStore.getState().setActiveSnapshotDraft(normalizeWhiteboardSnapshot({
      elements: [{ height: 80, id: 'image-before-create', text: 'keep.png', type: 'image', width: 120, x: 1, y: 2 }],
    }));

    await useWhiteboardStore.getState().createBoard();

    const state = useWhiteboardStore.getState();
    expect(state.boards.map((board) => board.title)).toEqual(['Board', 'Board 2']);
    expect(state.boards.find((board) => board.id === state.activeBoardId)?.title).toBe('Board 2');
    expect(mocks.files.get(`${SYSTEM_ROOT}/boards/default/board.vlwb.json`)).toContain('image-before-create');
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

  it('flushes the latest draft before switching notes roots', async () => {
    await useWhiteboardStore.getState().loadForNotesRoot('/notesRoot');
    const latestSnapshot = normalizeWhiteboardSnapshot({
      elements: [{ height: 80, id: 'latest-image', text: 'latest-a.png', type: 'image', width: 120, x: 1, y: 2 }],
    });
    useWhiteboardStore.getState().setActiveSnapshotDraft(latestSnapshot);

    await useWhiteboardStore.getState().loadForNotesRoot('/notesRootB');

    expect(mocks.files.get(`${SYSTEM_ROOT}/boards/default/board.vlwb.json`)).toContain('latest-a.png');
    expect(useWhiteboardStore.getState().loadedNotesRootPath).toBe('/notesRootB');
  });

  it('flushes the latest draft immediately for application close', async () => {
    await useWhiteboardStore.getState().loadForNotesRoot('/notesRoot');
    useWhiteboardStore.getState().setActiveSnapshotDraft(normalizeWhiteboardSnapshot({
      elements: [{ height: 80, id: 'close-draft', text: 'close.png', type: 'image', width: 120, x: 1, y: 2 }],
    }));

    await flushWhiteboardStorage();

    expect(mocks.files.get(`${SYSTEM_ROOT}/boards/default/board.vlwb.json`)).toContain('close.png');
  });

  it('rejects a delayed save bound to a previous notes root', async () => {
    await useWhiteboardStore.getState().loadForNotesRoot('/notesRoot');
    const staleSnapshot = normalizeWhiteboardSnapshot({
      elements: [{ height: 80, id: 'stale-image', text: 'stale-root.png', type: 'image', width: 120, x: 1, y: 2 }],
    });
    await useWhiteboardStore.getState().loadForNotesRoot('/notesRootB');

    const result = await useWhiteboardStore.getState().saveActiveSnapshot(staleSnapshot, 'default', '/notesRoot');
    const secondRoot = `/app/.vlaina/whiteboards/notes-roots/${getNotesRootStorageKey('/notesRootB')}`;

    expect(result?.ok).toBe(true);
    expect(mocks.files.get(`${secondRoot}/boards/default/board.vlwb.json`)).not.toContain('Do not copy across roots');
  });

  it('ignores a delayed save after switching to another board', async () => {
    await useWhiteboardStore.getState().loadForNotesRoot('/notesRoot');
    const staleSnapshot = normalizeWhiteboardSnapshot({
      elements: [{ height: 80, id: 'stale-image', text: 'stale-board.png', type: 'image', width: 120, x: 1, y: 2 }],
    });
    useWhiteboardStore.getState().setActiveSnapshotDraft(staleSnapshot);
    const latestSnapshot = normalizeWhiteboardSnapshot({
      elements: [{ height: 80, id: 'latest-image', text: 'latest-board.png', type: 'image', width: 120, x: 1, y: 2 }],
    });
    useWhiteboardStore.getState().setActiveSnapshotDraft(latestSnapshot);
    await useWhiteboardStore.getState().createBoard();

    const result = await useWhiteboardStore.getState().saveActiveSnapshot(staleSnapshot, 'default', '/notesRoot');

    expect(result?.ok).toBe(true);
    expect(mocks.files.get(`${SYSTEM_ROOT}/boards/default/board.vlwb.json`)).toContain('latest-board.png');
    expect(mocks.files.get(`${SYSTEM_ROOT}/boards/default/board.vlwb.json`)).not.toContain('Stale board content');
    expect(useWhiteboardStore.getState().activeBoardId).not.toBe('default');
  });

  it('keeps concurrent saves ordered so the latest snapshot stays on disk', async () => {
    await useWhiteboardStore.getState().loadForNotesRoot('/notesRoot');
    const boardPath = `${SYSTEM_ROOT}/boards/default/board.vlwb.json`;
    let releaseFirstWrite: () => void = () => undefined;
    let markFirstWriteStarted: () => void = () => undefined;
    const firstWriteStarted = new Promise<void>((resolve) => { markFirstWriteStarted = resolve; });
    const firstWriteGate = new Promise<void>((resolve) => { releaseFirstWrite = resolve; });
    mocks.storage.writeFile.mockImplementation(async (path: string, content: string) => {
      const normalizedPath = normalizePath(path, true);
      if (content.includes('older.png')) {
        markFirstWriteStarted();
        await firstWriteGate;
      }
      mocks.files.set(normalizedPath, content);
    });
    const olderSnapshot = normalizeWhiteboardSnapshot({
      elements: [{ height: 80, id: 'older-image', text: 'older.png', type: 'image', width: 120, x: 1, y: 2 }],
    });
    const newerSnapshot = normalizeWhiteboardSnapshot({
      elements: [{ height: 80, id: 'newer-image', text: 'newer.png', type: 'image', width: 120, x: 1, y: 2 }],
    });
    useWhiteboardStore.getState().setActiveSnapshotDraft(olderSnapshot);
    const firstSave = useWhiteboardStore.getState().saveActiveSnapshot(olderSnapshot);
    await firstWriteStarted;
    useWhiteboardStore.getState().setActiveSnapshotDraft(newerSnapshot);
    const secondSave = useWhiteboardStore.getState().saveActiveSnapshot(newerSnapshot);
    releaseFirstWrite();

    await Promise.all([firstSave, secondSave]);

    expect(mocks.files.get(boardPath)).toContain('newer.png');
    expect(mocks.files.get(boardPath)).not.toContain('older.png');
  });
});
