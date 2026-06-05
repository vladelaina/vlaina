import { describe, expect, it } from 'vitest';
import { ensureFileNodeInTree } from './fileTreePreservation';
import type { FileTreeNode } from './types';

describe('fileTreePreservation', () => {
  it('does not add unsafe or unsupported paths to the tree', () => {
    const tree: FileTreeNode[] = [];

    expect(ensureFileNodeInTree(tree, '../secret.md')).toBe(tree);
    expect(ensureFileNodeInTree(tree, '/tmp/secret.md')).toBe(tree);
    expect(ensureFileNodeInTree(tree, 'docs/image.png')).toBe(tree);
    expect(ensureFileNodeInTree(tree, 'docs/bad\0name.md')).toBe(tree);
  });

  it('normalizes safe relative paths before adding missing nodes', () => {
    expect(ensureFileNodeInTree([], 'drafts//today\\note.md')).toEqual([
      {
        id: 'drafts',
        name: 'drafts',
        path: 'drafts',
        isFolder: true,
        expanded: true,
        children: [
          {
            id: 'drafts/today',
            name: 'today',
            path: 'drafts/today',
            isFolder: true,
            expanded: true,
            children: [
              {
                id: 'drafts/today/note.md',
                name: 'note',
                path: 'drafts/today/note.md',
                isFolder: false,
              },
            ],
          },
        ],
      },
    ]);
  });
});
