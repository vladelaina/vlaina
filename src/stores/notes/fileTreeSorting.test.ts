import { describe, expect, it } from 'vitest';
import type { FileTreeNode, MetadataFile } from './types';
import { sortFileTree, sortNestedFileTree } from './fileTreeSorting';

describe('fileTreeSorting', () => {
  it('sorts files by descending name when name-desc is selected', () => {
    const nodes: FileTreeNode[] = [
      { id: 'zebra.md', name: 'zebra', path: 'zebra.md', isFolder: false },
      { id: 'Alpha', name: 'Alpha', path: 'Alpha', isFolder: true, children: [], expanded: false },
      { id: 'apple.md', name: 'apple', path: 'apple.md', isFolder: false },
      { id: 'Beta', name: 'Beta', path: 'Beta', isFolder: true, children: [], expanded: false },
    ];

    const sorted = sortFileTree(nodes, { mode: 'name-desc' });

    expect(sorted.map((node) => node.name)).toEqual(['Beta', 'Alpha', 'zebra', 'apple']);
  });

  it('sorts files by updated timestamp while keeping folders ahead of files', () => {
    const nodes: FileTreeNode[] = [
      { id: 'Folder', name: 'Folder', path: 'Folder', isFolder: true, children: [], expanded: false },
      { id: 'older.md', name: 'older', path: 'older.md', isFolder: false },
      { id: 'newer.md', name: 'newer', path: 'newer.md', isFolder: false },
    ];
    const metadata: MetadataFile = {
      version: 2,
      notes: {
        'older.md': { updatedAt: 10 },
        'newer.md': { updatedAt: 20 },
      },
    };

    const sorted = sortFileTree(nodes, { mode: 'updated-desc', metadata });

    expect(sorted.map((node) => node.name)).toEqual(['Folder', 'newer', 'older']);
  });

  it('sorts nested folder children with the active mode', () => {
    const nodes: FileTreeNode[] = [
      {
        id: 'docs',
        name: 'docs',
        path: 'docs',
        isFolder: true,
        expanded: true,
        children: [
          { id: 'docs/first.md', name: 'first', path: 'docs/first.md', isFolder: false },
          { id: 'docs/second.md', name: 'second', path: 'docs/second.md', isFolder: false },
        ],
      },
    ];
    const metadata: MetadataFile = {
      version: 2,
      notes: {
        'docs/first.md': { createdAt: 100 },
        'docs/second.md': { createdAt: 200 },
      },
    };

    const sorted = sortNestedFileTree(nodes, { mode: 'created-desc', metadata });
    const folder = sorted[0];

    expect(folder?.isFolder).toBe(true);
    if (!folder || !folder.isFolder) {
      throw new Error('Expected folder');
    }

    expect(folder.children.map((node) => node.name)).toEqual(['second', 'first']);
  });
});
