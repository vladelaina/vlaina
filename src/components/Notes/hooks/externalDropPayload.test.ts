import { describe, expect, it, vi } from 'vitest';
import {
  MAX_EXTERNAL_DROP_FILE_SCAN,
  MAX_EXTERNAL_DROP_PATH_CHARS,
  MAX_EXTERNAL_DROP_TYPE_SCAN,
  getDroppedExternalPaths,
  hasDataTransferType,
  hasExternalDroppedFiles,
} from './externalDropPayload';

vi.mock('@/lib/electron/bridge', () => ({
  getElectronBridge: () => null,
}));

function createDataTransfer(payload: Record<string, unknown>): DataTransfer {
  return payload as unknown as DataTransfer;
}

describe('external drop payload helpers', () => {
  it('collects dropped paths without materializing oversized file lists', () => {
    let accessed = 0;
    const arrayFrom = vi.spyOn(Array, 'from').mockImplementation(() => {
      throw new Error('Dropped file lists should not be materialized');
    });
    const files = {
      length: MAX_EXTERNAL_DROP_FILE_SCAN + 1,
      item(index: number) {
        accessed += 1;
        if (index >= MAX_EXTERNAL_DROP_FILE_SCAN) {
          throw new Error('Read past dropped file scan cap');
        }
        return { path: `/outside/note-${index}.md` } as unknown as File;
      },
    };

    const paths = getDroppedExternalPaths(createDataTransfer({ files: files as FileList }));
    arrayFrom.mockRestore();

    expect(paths).toHaveLength(MAX_EXTERNAL_DROP_FILE_SCAN);
    expect(paths[0]).toBe('/outside/note-0.md');
    expect(paths.at(-1)).toBe(`/outside/note-${MAX_EXTERNAL_DROP_FILE_SCAN - 1}.md`);
    expect(accessed).toBe(MAX_EXTERNAL_DROP_FILE_SCAN);
  });

  it('skips oversized dropped path strings before downstream handling', () => {
    const files = [
      { path: `/outside/${'a'.repeat(MAX_EXTERNAL_DROP_PATH_CHARS)}.md` },
      { path: '/outside/alpha.md' },
    ];

    expect(getDroppedExternalPaths(createDataTransfer({ files: files as unknown as FileList }))).toEqual([
      '/outside/alpha.md',
    ]);
  });

  it('does not scan drag type lists beyond the safety cap', () => {
    const types = {
      length: MAX_EXTERNAL_DROP_TYPE_SCAN + 1,
      item() {
        throw new Error('Oversized drag type lists should not be scanned');
      },
    };

    expect(hasDataTransferType(types as unknown as DOMStringList, 'Files')).toBe(false);
    expect(hasExternalDroppedFiles(createDataTransfer({ types: types as unknown as DOMStringList }))).toBe(false);
  });

  it('detects file drops from normal drag types and from file list length', () => {
    expect(hasDataTransferType(['Files'], 'Files')).toBe(true);
    expect(hasExternalDroppedFiles(createDataTransfer({ types: [] as unknown as DOMStringList }))).toBe(false);
    expect(hasExternalDroppedFiles(createDataTransfer({
      files: { length: 1, item: () => null } as unknown as FileList,
      types: [] as unknown as DOMStringList,
    }))).toBe(true);
  });
});
