import { beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizePath } from '@/lib/storage/adapter/pathUtils';
import { getNotesRootStorageKey } from '@/lib/storage/notesRootStorageKey';
import {
  createWhiteboardEntry,
  loadWhiteboardIndex,
  normalizeWhiteboardIndex,
  readWhiteboardBoard,
  writeWhiteboardAsset,
  writeWhiteboardBoard,
  writeWhiteboardIndex,
} from './whiteboardRepository';
import { normalizeWhiteboardSnapshot } from './whiteboardDocument';

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
      listDir: vi.fn(async (path: string) => {
        const normalized = normalizePath(path, true).replace(/\/$/, '');
        return Array.from(files.keys())
          .filter((filePath) => filePath.startsWith(`${normalized}/`))
          .map((filePath) => ({
            isDirectory: false,
            isFile: true,
            name: filePath.slice(normalized.length + 1),
            path: filePath,
          }));
      }),
      deleteDir: vi.fn(async (path: string) => {
        const normalized = normalizePath(path, true).replace(/\/$/, '');
        for (const filePath of Array.from(files.keys())) {
          if (filePath === normalized || filePath.startsWith(`${normalized}/`)) files.delete(filePath);
        }
        for (const dirPath of Array.from(dirs)) {
          if (dirPath === normalized || dirPath.startsWith(`${normalized}/`)) dirs.delete(dirPath);
        }
      }),
      deleteFile: vi.fn(async (path: string) => {
        files.delete(normalizePath(path, true));
      }),
      copyFile: vi.fn(async (source: string, target: string) => {
        const content = files.get(normalizePath(source, true));
        if (content === undefined) throw new Error('Source does not exist');
        files.set(normalizePath(target, true), content);
      }),
      rename: vi.fn(async (source: string, target: string) => {
        const normalizedSource = normalizePath(source, true);
        const content = files.get(normalizedSource);
        if (content === undefined) throw new Error('Source does not exist');
        files.set(normalizePath(target, true), content);
        files.delete(normalizedSource);
      }),
      writeBinaryFile: vi.fn(async (path: string, content: Uint8Array) => {
        files.set(normalizePath(path, true), `binary:${Array.from(content).join(',')}`);
      }),
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

describe('whiteboardRepository', () => {
  beforeEach(() => {
    mocks.files.clear();
    mocks.dirs.clear();
    vi.clearAllMocks();
  });

  it('loads a default index when the whiteboard index does not exist', async () => {
    await expect(loadWhiteboardIndex('/notesRoot')).resolves.toMatchObject({
      activeBoardId: 'default',
      boards: [{ folder: 'default', id: 'default', title: 'Board' }],
      version: 1,
    });
  });

  it('rejects unversioned whiteboard indexes', () => {
    expect(normalizeWhiteboardIndex({ activeBoardId: 'legacy', boards: [] })).toMatchObject({
      activeBoardId: 'default',
      version: 1,
    });
  });

  it('creates each board as a folder with board JSON and assets directory', async () => {
    const { entry } = await createWhiteboardEntry('/notesRoot', 'Project Plan');

    expect(entry.folder).toBe('project-plan');
    expect(mocks.files.has(`${SYSTEM_ROOT}/config.json`)).toBe(true);
    expect(mocks.files.has(`${SYSTEM_ROOT}/index.json`)).toBe(true);
    expect(mocks.files.has(`${SYSTEM_ROOT}/boards/project-plan/board.vlwb.json`)).toBe(true);
    expect(mocks.dirs.has(`${SYSTEM_ROOT}/boards/project-plan/assets`)).toBe(true);
  });

  it('writes board snapshots into the selected board folder', async () => {
    const { entry } = await createWhiteboardEntry('/notesRoot', 'Sketch');
    await writeWhiteboardBoard('/notesRoot', entry, normalizeWhiteboardSnapshot({
      elements: [{ height: 80, id: 'image-1', text: 'hello.png', type: 'image', width: 120, x: 1, y: 2 }],
    }));

    const rawBoard = mocks.files.get(`${SYSTEM_ROOT}/boards/sketch/board.vlwb.json`);
    expect(rawBoard).toContain('"format": "vlaina.whiteboard"');
    expect(rawBoard).toContain('"image-1"');
  });

  it('recovers a board from its backup when the primary file is malformed', async () => {
    const { entry } = await createWhiteboardEntry('/notesRoot', 'Sketch');
    const boardPath = `${SYSTEM_ROOT}/boards/sketch/board.vlwb.json`;
    await writeWhiteboardBoard('/notesRoot', entry, normalizeWhiteboardSnapshot({
      elements: [{ height: 80, id: 'recovered', text: 'safe.png', type: 'image', width: 120, x: 1, y: 2 }],
    }));
    await writeWhiteboardBoard('/notesRoot', entry, normalizeWhiteboardSnapshot({
      elements: [{ height: 80, id: 'recovered', text: 'safe.png', type: 'image', width: 120, x: 1, y: 2 }],
    }));
    mocks.files.set(boardPath, '{broken');

    const snapshot = await readWhiteboardBoard('/notesRoot', entry);

    expect(snapshot?.elements[0]).toMatchObject({ id: 'recovered' });
    expect(mocks.files.get(boardPath)).toBe(mocks.files.get(`${boardPath}.bak`));
  });

  it('recovers the index from its backup when the primary file is malformed', async () => {
    const created = await createWhiteboardEntry('/notesRoot', 'Sketch');
    await writeWhiteboardIndex('/notesRoot', created.index);
    mocks.files.set(`${SYSTEM_ROOT}/index.json`, '{broken');

    const recovered = await loadWhiteboardIndex('/notesRoot');

    expect(recovered.activeBoardId).toBe(created.entry.id);
    expect(recovered.boards).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: created.entry.id }),
    ]));
  });

  it('keeps the previous primary and backup when atomic replacement fails', async () => {
    const { entry } = await createWhiteboardEntry('/notesRoot', 'Sketch');
    const boardPath = `${SYSTEM_ROOT}/boards/sketch/board.vlwb.json`;
    const previous = mocks.files.get(boardPath);
    mocks.storage.rename.mockRejectedValueOnce(new Error('replace failed'));

    await expect(writeWhiteboardBoard('/notesRoot', entry, normalizeWhiteboardSnapshot({
      elements: [{ height: 80, id: 'new', text: 'new.png', type: 'image', width: 120, x: 1, y: 2 }],
    }))).rejects.toThrow('replace failed');

    expect(mocks.files.get(boardPath)).toBe(previous);
    expect(mocks.files.get(`${boardPath}.bak`)).toBe(previous);
    expect(Array.from(mocks.files.keys()).some((path) => path.endsWith('.tmp'))).toBe(false);
  });

  it('rejects board payloads larger than the 16 MB read limit', async () => {
    const { entry } = await createWhiteboardEntry('/notesRoot', 'Sketch');
    const oversized = normalizeWhiteboardSnapshot({
      elements: [{ height: 80, id: 'large', text: 'x'.repeat(16 * 1024 * 1024), type: 'image', width: 120, x: 1, y: 2 }],
    });

    await expect(writeWhiteboardBoard('/notesRoot', entry, oversized)).rejects.toThrow('too large');
  });

  it('writes imported images into the board assets folder', async () => {
    const { entry } = await createWhiteboardEntry('/notesRoot', 'Sketch');
    const file = {
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      name: 'Demo:Image.png',
    } as File;

    await expect(writeWhiteboardAsset('/notesRoot', entry, file)).resolves.toBe('assets/DemoImage.png');
    expect(mocks.files.get(`${SYSTEM_ROOT}/boards/sketch/assets/DemoImage.png`)).toBe('binary:1,2,3');
  });

});
