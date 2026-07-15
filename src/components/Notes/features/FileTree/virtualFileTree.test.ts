import { describe, expect, it } from 'vitest';
import {
  buildVirtualFileTreeRowOffsets,
  countVisibleFileTreeRows,
  estimateVirtualFileTreeRowHeight,
  flattenVisibleFileTreeRows,
  getRecommendedFileTreeSidebarWidth,
  getVirtualFileTreeWindow,
  VIRTUAL_FILE_TREE_ROW_HEIGHT,
} from './virtualFileTree';
import type { FileTreeNode } from '@/stores/useNotesStore';
import { SIDEBAR_DEFAULT_WIDTH, SIDEBAR_MAX_WIDTH } from '@/lib/layout/sidebarWidth';

function file(name: string): FileTreeNode {
  return {
    id: name,
    name,
    path: `${name}.md`,
    isFolder: false,
  };
}

function folder(name: string, children: FileTreeNode[] = []): Extract<FileTreeNode, { isFolder: true }> {
  return {
    id: name,
    name,
    path: name,
    isFolder: true,
    children,
    expanded: true,
  };
}

function deepVisibleTree(depth: number): FileTreeNode[] {
  let current: FileTreeNode = file('leaf');

  for (let index = depth; index >= 0; index -= 1) {
    current = folder(`folder-${index}`, [current]);
  }

  return [current];
}

describe('virtualFileTree', () => {
  it('recommends a wider sidebar for long visible file names', () => {
    expect(getRecommendedFileTreeSidebarWidth([
      file('a-markdown-file-name-that-needs-more-room'),
    ])).toBeGreaterThan(SIDEBAR_DEFAULT_WIDTH);
  });

  it('reserves space for the file icon, row padding, and more-actions button', () => {
    expect(getRecommendedFileTreeSidebarWidth([
      file('12345678901234567890'),
    ])).toBe(312);
  });

  it('uses rendered text measurements when they exceed the character estimate', () => {
    expect(getRecommendedFileTreeSidebarWidth(
      [file('wide-name')],
      () => 240,
    )).toBe(392);
  });

  it('accounts for nested wide-character names without exceeding the sidebar maximum', () => {
    const collapsedFolder = folder('folder', [file('\u4e00'.repeat(32))]);
    collapsedFolder.expanded = false;

    expect(getRecommendedFileTreeSidebarWidth([
      collapsedFolder,
    ])).toBe(SIDEBAR_MAX_WIDTH);
  });

  it('keeps the default width when visible file names already fit', () => {
    expect(getRecommendedFileTreeSidebarWidth([file('short')])).toBe(SIDEBAR_DEFAULT_WIDTH);
  });

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

  it('reduces wrapped row height when the sidebar is wider', () => {
    const row = {
      node: file('b6aaf51dac026c53249b1b5cf4f77ca68c29b060.gif'),
      depth: 1,
      parentFolderPath: '',
    };

    expect(estimateVirtualFileTreeRowHeight(row, 560)).toBeLessThan(
      estimateVirtualFileTreeRowHeight(row, 270),
    );
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

  it('flattens deep visible trees without recursive traversal', () => {
    const nodes = deepVisibleTree(2500);

    const rows = flattenVisibleFileTreeRows(nodes);

    expect(rows).toHaveLength(2502);
    expect(rows[0]).toMatchObject({ depth: 0, parentFolderPath: '' });
    expect(rows[rows.length - 1].node.path).toBe('leaf.md');
    expect(countVisibleFileTreeRows(nodes)).toBe(rows.length);
  });

  it('keeps visible tree rows in display order', () => {
    const nodes = [
      folder('docs', [
        file('alpha'),
        folder('guides', [file('beta')]),
      ]),
      file('root'),
    ];

    expect(flattenVisibleFileTreeRows(nodes).map((row) => row.node.path)).toEqual([
      'docs',
      'alpha.md',
      'guides',
      'beta.md',
      'root.md',
    ]);
  });
});
