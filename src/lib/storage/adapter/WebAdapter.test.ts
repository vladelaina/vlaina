import { beforeEach, describe, expect, it } from 'vitest';

import { WebAdapter, MAX_WEB_ADAPTER_LIST_ENTRIES } from './WebAdapter';

describe('WebAdapter', () => {
  let adapter: WebAdapter;

  beforeEach(() => {
    adapter = new WebAdapter();
  });

  it('copies binary files without decoding them as text', async () => {
    const bytes = new Uint8Array([0xff, 0x00, 0x80, 0x61]);

    await adapter.writeBinaryFile('/assets/image.bin', bytes, { recursive: true });
    await adapter.copyFile('/assets/image.bin', '/assets/copy.bin');

    await expect(adapter.readBinaryFile('/assets/copy.bin')).resolves.toEqual(bytes);
    await expect(adapter.stat('/assets/copy.bin')).resolves.toMatchObject({
      isFile: true,
      size: bytes.length,
    });
  });

  it('renames binary files without decoding them as text', async () => {
    const bytes = new Uint8Array([0xff, 0x00, 0x80, 0x61]);

    await adapter.writeBinaryFile('/assets/image.bin', bytes, { recursive: true });
    await adapter.rename('/assets/image.bin', '/assets/moved.bin');

    await expect(adapter.readBinaryFile('/assets/moved.bin')).resolves.toEqual(bytes);
    await expect(adapter.exists('/assets/image.bin')).resolves.toBe(false);
  });

  it('isolates stored binary data from caller mutations', async () => {
    const bytes = new Uint8Array([1, 2, 3]);

    await adapter.writeBinaryFile('/assets/image.bin', bytes, { recursive: true });
    bytes[0] = 9;

    const firstRead = await adapter.readBinaryFile('/assets/image.bin');
    firstRead[1] = 8;

    await expect(adapter.readBinaryFile('/assets/image.bin')).resolves.toEqual(new Uint8Array([1, 2, 3]));
  });

  it('rejects binary reads that exceed the caller-provided byte limit', async () => {
    await adapter.writeBinaryFile('/assets/image.bin', new Uint8Array([1, 2, 3]), { recursive: true });

    await expect(adapter.readBinaryFile('/assets/image.bin', 2)).rejects.toThrow('File is too large to read');
    await expect(adapter.readBinaryFile('/assets/image.bin', -1)).rejects.toThrow('Invalid binary read limit');
  });

  it('continues to copy text files as text', async () => {
    await adapter.writeFile('/notes/a.md', 'hello', { recursive: true });
    await adapter.copyFile('/notes/a.md', '/notes/b.md');

    await expect(adapter.readFile('/notes/b.md')).resolves.toBe('hello');
  });

  it('rejects text reads that exceed the caller-provided byte limit', async () => {
    await adapter.writeFile('/notes/a.md', 'hello', { recursive: true });

    await expect(adapter.readFile('/notes/a.md', 4)).rejects.toThrow('File is too large to read');
  });

  it('normalizes dot segments before reading and listing virtual paths', async () => {
    await adapter.writeFile('/vault/docs/../notes/./a.md', 'hello', { recursive: true });

    await expect(adapter.readFile('/vault/notes/a.md')).resolves.toBe('hello');
    await expect(adapter.exists('/vault/docs/../notes/a.md')).resolves.toBe(true);
    await expect(adapter.listDir('/vault')).resolves.toEqual([
      expect.objectContaining({
        name: 'notes',
        path: '/vault/notes',
        isDirectory: true,
      }),
    ]);
  });

  it('rejects relative paths that escape the virtual storage root', async () => {
    await expect(adapter.writeFile('../notes/a.md', 'hello')).rejects.toThrow('Path escapes storage root');
    await expect(adapter.readFile('../notes/a.md')).rejects.toThrow('Path escapes storage root');
    await expect(adapter.listDir('../notes')).rejects.toThrow('Path escapes storage root');
  });

  it('lists implicit parent directories for stored deep files', async () => {
    await adapter.writeFile('/vault/docs/a.md', 'hello');

    await expect(adapter.exists('/vault/docs')).resolves.toBe(true);
    await expect(adapter.stat('/vault/docs')).resolves.toMatchObject({
      name: 'docs',
      path: '/vault/docs',
      isDirectory: true,
      isFile: false,
    });
    await expect(adapter.listDir('/vault')).resolves.toEqual([
      expect.objectContaining({
        name: 'docs',
        path: '/vault/docs',
        isDirectory: true,
      }),
    ]);
    await expect(adapter.listDir('/vault/docs')).resolves.toEqual([
      expect.objectContaining({
        name: 'a.md',
        path: '/vault/docs/a.md',
        isFile: true,
      }),
    ]);
  });

  it('filters hidden entries by default and includes them when requested', async () => {
    await adapter.writeFile('/vault/.journal.md', 'journal', { recursive: true });
    await adapter.writeFile('/vault/.notes/alpha.md', 'alpha', { recursive: true });
    await adapter.writeFile('/vault/docs/beta.md', 'beta', { recursive: true });

    await expect(adapter.listDir('/vault')).resolves.toEqual([
      expect.objectContaining({
        name: 'docs',
        path: '/vault/docs',
        isDirectory: true,
      }),
    ]);

    await expect(adapter.listDir('/vault', { includeHidden: true })).resolves.toEqual([
      expect.objectContaining({
        name: '.journal.md',
        path: '/vault/.journal.md',
        isFile: true,
      }),
      expect.objectContaining({
        name: '.notes',
        path: '/vault/.notes',
        isDirectory: true,
      }),
      expect.objectContaining({
        name: 'docs',
        path: '/vault/docs',
        isDirectory: true,
      }),
    ]);

    await expect(adapter.listDir('/vault', { recursive: true, includeHidden: true })).resolves.toEqual([
      expect.objectContaining({
        name: '.journal.md',
        path: '/vault/.journal.md',
        isFile: true,
      }),
      expect.objectContaining({
        name: '.notes',
        path: '/vault/.notes',
        isDirectory: true,
      }),
      expect.objectContaining({
        name: 'alpha.md',
        path: '/vault/.notes/alpha.md',
        isFile: true,
      }),
      expect.objectContaining({
        name: 'docs',
        path: '/vault/docs',
        isDirectory: true,
      }),
      expect.objectContaining({
        name: 'beta.md',
        path: '/vault/docs/beta.md',
        isFile: true,
      }),
    ]);
  });

  it('includes implicit directories in recursive listings without duplicating them', async () => {
    await adapter.writeFile('/vault/docs/guides/a.md', 'hello');

    await expect(adapter.listDir('/vault', { recursive: true })).resolves.toEqual([
      expect.objectContaining({
        name: 'docs',
        path: '/vault/docs',
        isDirectory: true,
      }),
      expect.objectContaining({
        name: 'guides',
        path: '/vault/docs/guides',
        isDirectory: true,
      }),
      expect.objectContaining({
        name: 'a.md',
        path: '/vault/docs/guides/a.md',
        isFile: true,
      }),
    ]);
  });

  it('caps recursive listing results when prefix scans return many entries', async () => {
    const adapterWithScans = adapter as unknown as {
      readStoredFilesByPrefix: (prefix: string) => Promise<{ entries: unknown[]; truncated: boolean }>;
      readStoredDirsByPrefix: (prefix: string) => Promise<{ entries: unknown[]; truncated: boolean }>;
    };
    adapterWithScans.readStoredFilesByPrefix = async () => ({
      entries: Array.from(
        { length: MAX_WEB_ADAPTER_LIST_ENTRIES + 1 },
        (_, index) => ({
          path: `/vault/docs/file-${index}.md`,
          content: 'hello',
          isBinary: false,
          size: 5,
          modifiedAt: index,
          createdAt: index,
        }),
      ),
      truncated: false,
    });
    adapterWithScans.readStoredDirsByPrefix = async () => ({ entries: [], truncated: false });

    await expect(adapter.listDir('/vault', { recursive: true })).resolves.toHaveLength(
      MAX_WEB_ADAPTER_LIST_ENTRIES,
    );
  });

  it('prioritizes markdown files and directories before applying the list cap', async () => {
    const adapterWithScans = adapter as unknown as {
      readStoredFilesByPrefix: (prefix: string) => Promise<{ entries: unknown[]; truncated: boolean }>;
      readStoredDirsByPrefix: (prefix: string) => Promise<{ entries: unknown[]; truncated: boolean }>;
    };
    adapterWithScans.readStoredFilesByPrefix = async () => ({
      entries: [
        ...Array.from({ length: MAX_WEB_ADAPTER_LIST_ENTRIES }, (_, index) => ({
          path: `/vault/asset-${String(index).padStart(5, '0')}.png`,
          content: new Uint8Array([index % 255]),
          isBinary: true,
          size: 1,
          modifiedAt: index,
          createdAt: index,
        })),
        {
          path: '/vault/late.md',
          content: 'late',
          isBinary: false,
          size: 4,
          modifiedAt: 1,
          createdAt: 1,
        },
      ],
      truncated: false,
    });
    adapterWithScans.readStoredDirsByPrefix = async () => ({
      entries: [
        {
          path: '/vault/docs',
          createdAt: 1,
        },
      ],
      truncated: false,
    });

    const entries = await adapter.listDir('/vault', { includeHidden: true });

    expect(entries).toHaveLength(MAX_WEB_ADAPTER_LIST_ENTRIES);
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'late.md', path: '/vault/late.md', isFile: true }),
        expect.objectContaining({ name: 'docs', path: '/vault/docs', isDirectory: true }),
      ]),
    );
    expect(entries).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'asset-19999.png' }),
      ]),
    );
  });

  it('renames implicit parent directories with their stored child files', async () => {
    await adapter.writeFile('/vault/docs/a.md', 'hello');

    await adapter.rename('/vault/docs', '/vault/archive');

    await expect(adapter.exists('/vault/docs')).resolves.toBe(false);
    await expect(adapter.readFile('/vault/archive/a.md')).resolves.toBe('hello');
    await expect(adapter.listDir('/vault')).resolves.toEqual([
      expect.objectContaining({
        name: 'archive',
        path: '/vault/archive',
        isDirectory: true,
      }),
    ]);
  });

  it('does not include sibling paths that only share a directory name prefix', async () => {
    await adapter.writeFile('/vault/docs/a.md', 'docs');
    await adapter.writeFile('/vault/docs-extra/b.md', 'extra');

    await expect(adapter.listDir('/vault/docs', { recursive: true })).resolves.toEqual([
      expect.objectContaining({
        name: 'a.md',
        path: '/vault/docs/a.md',
        isFile: true,
      }),
    ]);

    await adapter.rename('/vault/docs', '/vault/archive');

    await expect(adapter.exists('/vault/docs-extra/b.md')).resolves.toBe(true);
    await expect(adapter.exists('/vault/archive/a.md')).resolves.toBe(true);
    await expect(adapter.exists('/vault/archive-extra/b.md')).resolves.toBe(false);
  });

  it('recursively deletes implicit parent directories with their stored child files', async () => {
    await adapter.writeFile('/vault/docs/a.md', 'hello');

    await adapter.deleteDir('/vault/docs', true);

    await expect(adapter.exists('/vault/docs')).resolves.toBe(false);
    await expect(adapter.exists('/vault/docs/a.md')).resolves.toBe(false);
    await expect(adapter.listDir('/vault')).resolves.toEqual([]);
  });

  it('rejects non-recursive deletion of non-empty directories', async () => {
    await adapter.writeFile('/vault/notes/a.md', 'hello', { recursive: true });

    await expect(adapter.deleteDir('/vault/notes')).rejects.toThrow('Directory not empty');
    await expect(adapter.exists('/vault/notes/a.md')).resolves.toBe(true);
  });

  it('rejects moving a directory into itself', async () => {
    await adapter.writeFile('/vault/notes/a.md', 'hello', { recursive: true });

    await expect(adapter.rename('/vault/notes', '/vault/notes/archive')).rejects.toThrow(
      'Cannot move a directory into itself',
    );
    await expect(adapter.exists('/vault/notes/a.md')).resolves.toBe(true);
    await expect(adapter.exists('/vault/notes/archive')).resolves.toBe(false);
  });

  it('does not partially delete recursive directories when a prefix scan is capped', async () => {
    await adapter.writeFile('/vault/docs/a.md', 'hello', { recursive: true });
    const adapterWithScans = adapter as unknown as {
      readStoredFilesByPrefix: (prefix: string) => Promise<{ entries: unknown[]; truncated: boolean }>;
      readStoredDirsByPrefix: (prefix: string) => Promise<{ entries: unknown[]; truncated: boolean }>;
    };
    adapterWithScans.readStoredFilesByPrefix = async () => ({
      entries: [
        {
          path: '/vault/docs/a.md',
          content: 'hello',
          isBinary: false,
          size: 5,
          modifiedAt: 1,
          createdAt: 1,
        },
      ],
      truncated: true,
    });
    adapterWithScans.readStoredDirsByPrefix = async () => ({
      entries: [{ path: '/vault/docs', createdAt: 1 }],
      truncated: false,
    });

    await expect(adapter.deleteDir('/vault/docs', true)).rejects.toThrow(
      'Directory is too large to delete safely.',
    );
    await expect(adapter.exists('/vault/docs/a.md')).resolves.toBe(true);
  });

  it('does not partially move recursive directories when a prefix scan is capped', async () => {
    await adapter.writeFile('/vault/docs/a.md', 'hello', { recursive: true });
    const adapterWithScans = adapter as unknown as {
      readStoredFilesByPrefix: (prefix: string) => Promise<{ entries: unknown[]; truncated: boolean }>;
      readStoredDirsByPrefix: (prefix: string) => Promise<{ entries: unknown[]; truncated: boolean }>;
    };
    adapterWithScans.readStoredFilesByPrefix = async () => ({
      entries: [
        {
          path: '/vault/docs/a.md',
          content: 'hello',
          isBinary: false,
          size: 5,
          modifiedAt: 1,
          createdAt: 1,
        },
      ],
      truncated: true,
    });
    adapterWithScans.readStoredDirsByPrefix = async () => ({
      entries: [{ path: '/vault/docs', createdAt: 1 }],
      truncated: false,
    });

    await expect(adapter.rename('/vault/docs', '/vault/archive')).rejects.toThrow(
      'Directory is too large to move safely.',
    );
    await expect(adapter.exists('/vault/docs/a.md')).resolves.toBe(true);
    await expect(adapter.exists('/vault/archive/a.md')).resolves.toBe(false);
  });
});
