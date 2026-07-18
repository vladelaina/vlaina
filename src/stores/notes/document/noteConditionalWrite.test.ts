import { describe, expect, it, vi } from 'vitest';
import type { StorageAdapter } from '@/lib/storage/adapter';
import { writeNoteFileIfSemanticallyUnchanged } from './noteConditionalWrite';

function createStorage({
  currentDiskContent,
  writeResults,
}: {
  currentDiskContent: string;
  writeResults: boolean[];
}) {
  return {
    readFile: vi.fn().mockResolvedValue(currentDiskContent),
    writeFileIfUnchanged: vi.fn()
      .mockResolvedValueOnce(writeResults[0])
      .mockResolvedValueOnce(writeResults[1]),
  } as unknown as StorageAdapter;
}

describe('writeNoteFileIfSemanticallyUnchanged', () => {
  it.each([
    ['CRLF', '# Alpha\r\n', '# Alpha\n'],
    ['CR', '# Alpha\r', '# Alpha\n'],
    ['UTF-8 BOM', '\uFEFF# Alpha\n', '# Alpha\n'],
  ])('retries a rejected write for a pure %s encoding difference', async (_label, disk, expected) => {
    const storage = createStorage({ currentDiskContent: disk, writeResults: [false, true] });

    await expect(writeNoteFileIfSemanticallyUnchanged({
      storage,
      fullPath: '/notes/alpha.md',
      expectedContent: expected,
      content: '# Local edit\n',
    })).resolves.toBe(true);

    expect(storage.writeFileIfUnchanged).toHaveBeenNthCalledWith(
      2,
      '/notes/alpha.md',
      disk,
      '# Local edit\n',
    );
  });

  it('does not retry when the disk body changed', async () => {
    const storage = createStorage({ currentDiskContent: '# External edit\n', writeResults: [false] });

    await expect(writeNoteFileIfSemanticallyUnchanged({
      storage,
      fullPath: '/notes/alpha.md',
      expectedContent: '# Alpha\n',
      content: '# Local edit\n',
    })).resolves.toBe(false);

    expect(storage.writeFileIfUnchanged).toHaveBeenCalledTimes(1);
  });

  it('does not retry a rejected create after another process creates the file', async () => {
    const storage = createStorage({ currentDiskContent: '# External note\n', writeResults: [false] });

    await expect(writeNoteFileIfSemanticallyUnchanged({
      storage,
      fullPath: '/notes/alpha.md',
      expectedContent: null,
      content: '# Local note\n',
    })).resolves.toBe(false);

    expect(storage.readFile).not.toHaveBeenCalled();
    expect(storage.writeFileIfUnchanged).toHaveBeenCalledTimes(1);
  });

  it('keeps the conflict when the disk changes again before the retry', async () => {
    const storage = createStorage({ currentDiskContent: '# Alpha\r\n', writeResults: [false, false] });

    await expect(writeNoteFileIfSemanticallyUnchanged({
      storage,
      fullPath: '/notes/alpha.md',
      expectedContent: '# Alpha\n',
      content: '# Local edit\n',
    })).resolves.toBe(false);

    expect(storage.writeFileIfUnchanged).toHaveBeenCalledTimes(2);
  });
});
