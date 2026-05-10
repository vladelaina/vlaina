import { beforeEach, describe, expect, it } from 'vitest';

import { WebAdapter } from './WebAdapter';

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

  it('continues to copy text files as text', async () => {
    await adapter.writeFile('/notes/a.md', 'hello', { recursive: true });
    await adapter.copyFile('/notes/a.md', '/notes/b.md');

    await expect(adapter.readFile('/notes/b.md')).resolves.toBe('hello');
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
});
