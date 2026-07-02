import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureNotesRootConfig } from './notesRootConfig';

const adapter = {
  exists: vi.fn<(path: string) => Promise<boolean>>(),
  readFile: vi.fn<(path: string, maxBytes?: number) => Promise<string>>(),
  stat: vi.fn<(path: string) => Promise<{ isDirectory?: boolean; isFile?: boolean; size?: number } | null>>(),
  writeFile: vi.fn<(path: string, content: string) => Promise<void>>(),
  mkdir: vi.fn<(path: string, recursive?: boolean) => Promise<void>>(),
  getBasePath: vi.fn<() => Promise<string>>(),
};

vi.mock('@/lib/storage/adapter', () => ({
  getStorageAdapter: () => adapter,
  joinPath: (...segments: string[]) => Promise.resolve(segments.filter(Boolean).join('/')),
}));

describe('notesRootConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(1234);
    adapter.exists.mockResolvedValue(false);
    adapter.readFile.mockResolvedValue('{}');
    adapter.stat.mockResolvedValue(null);
    adapter.writeFile.mockResolvedValue(undefined);
    adapter.mkdir.mockResolvedValue(undefined);
    adapter.getBasePath.mockResolvedValue('/app');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates notesRoot config in the system store', async () => {
    await ensureNotesRootConfig('/notesRoot');

    expect(adapter.mkdir).toHaveBeenCalledWith('/app/.vlaina/notes/notes-roots/notes-root-g0ujgn', true);
    expect(adapter.writeFile).toHaveBeenCalledWith(
      '/app/.vlaina/notes/notes-roots/notes-root-g0ujgn/config.json',
      JSON.stringify({ version: 1, created: 1234, notesRootPath: '/notesRoot' }, null, 2)
    );
  });

  it('updates stale notesRootPath in an existing config', async () => {
    adapter.exists.mockResolvedValue(true);
    adapter.stat.mockResolvedValue({ size: 64 });
    adapter.readFile.mockResolvedValue(JSON.stringify({ version: 1, created: 100, notesRootPath: '/old' }));

    await ensureNotesRootConfig('/notesRoot');

    expect(adapter.writeFile).toHaveBeenCalledWith(
      '/app/.vlaina/notes/notes-roots/notes-root-g0ujgn/config.json',
      JSON.stringify({ version: 1, created: 100, notesRootPath: '/notesRoot' }, null, 2)
    );
  });

  it('repairs invalid existing config content', async () => {
    adapter.exists.mockResolvedValue(true);
    adapter.stat.mockResolvedValue({ size: 8 });
    adapter.readFile.mockResolvedValue('not-json');

    await ensureNotesRootConfig('/notesRoot');

    expect(adapter.writeFile).toHaveBeenCalledWith(
      '/app/.vlaina/notes/notes-roots/notes-root-g0ujgn/config.json',
      JSON.stringify({ version: 1, created: 1234, notesRootPath: '/notesRoot' }, null, 2)
    );
  });

  it('repairs oversized existing config content without reading it', async () => {
    adapter.exists.mockResolvedValue(true);
    adapter.stat.mockResolvedValue({ size: 100 * 1024 });

    await ensureNotesRootConfig('/notesRoot');

    expect(adapter.readFile).not.toHaveBeenCalled();
    expect(adapter.writeFile).toHaveBeenCalledWith(
      '/app/.vlaina/notes/notes-roots/notes-root-g0ujgn/config.json',
      JSON.stringify({ version: 1, created: 1234, notesRootPath: '/notesRoot' }, null, 2)
    );
  });

  it('repairs existing config content with invalid known stat size without reading it', async () => {
    adapter.exists.mockResolvedValue(true);
    adapter.stat.mockResolvedValue({ size: -1 });

    await ensureNotesRootConfig('/notesRoot');

    expect(adapter.readFile).not.toHaveBeenCalled();
    expect(adapter.writeFile).toHaveBeenCalledWith(
      '/app/.vlaina/notes/notes-roots/notes-root-g0ujgn/config.json',
      JSON.stringify({ version: 1, created: 1234, notesRootPath: '/notesRoot' }, null, 2)
    );
  });

  it('reads existing config content when stat has no size', async () => {
    adapter.exists.mockResolvedValue(true);
    adapter.stat.mockResolvedValue({});
    adapter.readFile.mockResolvedValue(JSON.stringify({ version: 1, created: 100, notesRootPath: '/old' }));

    await ensureNotesRootConfig('/notesRoot');

    expect(adapter.readFile).toHaveBeenCalledWith(
      '/app/.vlaina/notes/notes-roots/notes-root-g0ujgn/config.json',
      64 * 1024,
    );
    expect(adapter.writeFile).toHaveBeenCalledWith(
      '/app/.vlaina/notes/notes-roots/notes-root-g0ujgn/config.json',
      JSON.stringify({ version: 1, created: 100, notesRootPath: '/notesRoot' }, null, 2)
    );
  });

  it('repairs existing config content that exceeds the limit after read', async () => {
    adapter.exists.mockResolvedValue(true);
    adapter.stat.mockResolvedValue({ size: 64 });
    adapter.readFile.mockResolvedValue('x'.repeat(64 * 1024 + 1));

    await ensureNotesRootConfig('/notesRoot');

    expect(adapter.readFile).toHaveBeenCalledWith(
      '/app/.vlaina/notes/notes-roots/notes-root-g0ujgn/config.json',
      64 * 1024,
    );
    expect(adapter.writeFile).toHaveBeenCalledWith(
      '/app/.vlaina/notes/notes-roots/notes-root-g0ujgn/config.json',
      JSON.stringify({ version: 1, created: 1234, notesRootPath: '/notesRoot' }, null, 2)
    );
  });
});
