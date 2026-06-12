import { beforeEach, describe, expect, it } from 'vitest';

import { MAX_WEB_ADAPTER_FILE_BYTES, WebAdapter } from './WebAdapter';

interface StoredFileForTest {
  path: string;
  content: string | Uint8Array;
  isBinary: boolean;
  size: number;
  modifiedAt: number;
  createdAt: number;
}

describe('WebAdapter write budgets', () => {
  let adapter: WebAdapter;

  beforeEach(() => {
    adapter = new WebAdapter();
  });

  function replaceReadStoredFile(
    readStoredFile: (path: string) => Promise<StoredFileForTest | undefined>,
  ): () => void {
    const target = adapter as unknown as {
      readStoredFile: (path: string) => Promise<StoredFileForTest | undefined>;
    };
    const original = target.readStoredFile;
    target.readStoredFile = readStoredFile;
    return () => {
      target.readStoredFile = original;
    };
  }

  it('rejects appending text past the web write limit before storing a replacement', async () => {
    const restore = replaceReadStoredFile(async () => ({
      path: '/write-budget/huge.md',
      content: '',
      isBinary: false,
      size: MAX_WEB_ADAPTER_FILE_BYTES,
      modifiedAt: 1,
      createdAt: 1,
    }));

    try {
      await expect(adapter.writeFile('/write-budget/huge.md', 'x', { append: true })).rejects.toThrow(
        'Web content is too large to write',
      );
    } finally {
      restore();
    }

    await expect(adapter.exists('/write-budget/huge.md')).resolves.toBe(false);
  });

  it('rejects appending binary data past the web write limit before storing a replacement', async () => {
    const restore = replaceReadStoredFile(async () => ({
      path: '/write-budget/huge.bin',
      content: new Uint8Array(),
      isBinary: true,
      size: MAX_WEB_ADAPTER_FILE_BYTES,
      modifiedAt: 1,
      createdAt: 1,
    }));

    try {
      await expect(
        adapter.writeBinaryFile('/write-budget/huge.bin', new Uint8Array([1]), { append: true }),
      ).rejects.toThrow('Web content is too large to write');
    } finally {
      restore();
    }

    await expect(adapter.exists('/write-budget/huge.bin')).resolves.toBe(false);
  });

  it('does not turn append read failures into overwrites', async () => {
    await adapter.writeFile('/write-budget/original.md', 'original', { recursive: true });
    const restore = replaceReadStoredFile(async () => {
      throw new Error('IndexedDB read failed');
    });

    try {
      await expect(adapter.writeFile('/write-budget/original.md', ' replacement', { append: true })).rejects.toThrow(
        'IndexedDB read failed',
      );
    } finally {
      restore();
    }

    await expect(adapter.readFile('/write-budget/original.md')).resolves.toBe('original');
  });

  it('still appends to missing web files as new files', async () => {
    await adapter.writeFile('/write-budget/new.md', 'created', { append: true, recursive: true });

    await expect(adapter.readFile('/write-budget/new.md')).resolves.toBe('created');
  });
});
