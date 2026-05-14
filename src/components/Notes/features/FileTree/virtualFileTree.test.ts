import { describe, expect, it } from 'vitest';
import {
  buildVirtualFileTreeRowOffsets,
  estimateVirtualFileTreeRowHeight,
  getVirtualFileTreeWindow,
  VIRTUAL_FILE_TREE_ROW_HEIGHT,
} from './virtualFileTree';
import type { FileTreeNode } from '@/stores/useNotesStore';

function file(name: string): FileTreeNode {
  return {
    id: name,
    name,
    path: `${name}.md`,
    isFolder: false,
  };
}

describe('virtualFileTree', () => {
  it('estimates taller rows for long names so wrapped sidebar labels are not overlapped', () => {
    const shortHeight = estimateVirtualFileTreeRowHeight({ node: file('short'), depth: 1, parentFolderPath: '' });
    const mediumHeight = estimateVirtualFileTreeRowHeight({
      node: file('moderately-long-sidebar-name'),
      depth: 1,
      parentFolderPath: '',
    });
    const longHeight = estimateVirtualFileTreeRowHeight({
      node: file('a-very-very-very-long-sidebar-file-name-that-wraps'),
      depth: 1,
      parentFolderPath: '',
    });

    expect(shortHeight).toBe(VIRTUAL_FILE_TREE_ROW_HEIGHT);
    expect(mediumHeight).toBeGreaterThan(VIRTUAL_FILE_TREE_ROW_HEIGHT * 2);
    expect(longHeight).toBeGreaterThan(VIRTUAL_FILE_TREE_ROW_HEIGHT);
  });

  it('uses variable row offsets for virtual windows', () => {
    const rowHeights = [38, 98, 38];
    const rowOffsets = buildVirtualFileTreeRowOffsets(rowHeights);

    expect(rowOffsets).toEqual([0, 38, 136, 174]);
    expect(getVirtualFileTreeWindow({
      rowCount: 3,
      rowHeight: VIRTUAL_FILE_TREE_ROW_HEIGHT,
      rowHeights,
      rowOffsets,
      viewportStart: 120,
      viewportHeight: 20,
      overscanRows: 0,
    })).toEqual({
      startIndex: 1,
      endIndex: 3,
      offsetTop: 38,
      totalHeight: 174,
    });
  });
});
