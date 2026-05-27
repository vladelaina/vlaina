import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FileTreeNode } from './types';
import {
  addNodeToTree,
  buildFileTree,
  expandFoldersForPath,
  isGitRepositoryDirectory,
  removeNodeFromTree,
  updateFolderExpanded,
} from './fileTreeUtils';
import { ensureFileNodeInTree } from './fileTreePreservation';

const mocks = vi.hoisted(() => ({
  listDir: vi.fn(),
  exists: vi.fn(),
}));

vi.mock('@/lib/storage/adapter', () => ({
  getStorageAdapter: () => ({
    listDir: mocks.listDir,
    exists: mocks.exists,
  }),
  joinPath: async (...segments: string[]) => segments.filter(Boolean).join('/'),
}));

function createTree(): FileTreeNode[] {
  return [
    {
      id: 'docs',
      name: 'docs',
      path: 'docs',
      isFolder: true,
      expanded: false,
      children: [
        {
          id: 'docs/guides',
          name: 'guides',
          path: 'docs/guides',
          isFolder: true,
          expanded: false,
          children: [
            {
              id: 'docs/guides/intro.md',
              name: 'intro',
              path: 'docs/guides/intro.md',
              isFolder: false,
            },
          ],
        },
      ],
    },
    {
      id: 'archive',
      name: 'archive',
      path: 'archive',
      isFolder: true,
      expanded: false,
      children: [
        {
          id: 'archive/old.md',
          name: 'old',
          path: 'archive/old.md',
          isFolder: false,
        },
      ],
    },
  ];
}

describe('fileTreeUtils structural sharing', () => {
  beforeEach(() => {
    mocks.listDir.mockReset();
    mocks.exists.mockReset();
    mocks.exists.mockResolvedValue(false);
  });

  it('does not recurse into heavy generated folders while building the tree', async () => {
    mocks.listDir.mockImplementation(async (path: string) => {
      if (path === '/vault') {
        return [
          { name: 'node_modules', path: '/vault/node_modules', isDirectory: true, isFile: false },
          { name: 'docs', path: '/vault/docs', isDirectory: true, isFile: false },
        ];
      }

      if (path === '/vault/docs') {
        return [
          { name: 'alpha.md', path: '/vault/docs/alpha.md', isDirectory: false, isFile: true },
        ];
      }

      if (path === '/vault/node_modules') {
        return [
          { name: 'package.md', path: '/vault/node_modules/package.md', isDirectory: false, isFile: true },
        ];
      }

      return [];
    });

    const tree = await buildFileTree('/vault');

    expect(mocks.listDir).not.toHaveBeenCalledWith('/vault/node_modules');
    expect(tree).toEqual([
      {
        id: 'docs',
        name: 'docs',
        path: 'docs',
        isFolder: true,
        expanded: false,
        children: [
          {
            id: 'docs/alpha.md',
            name: 'alpha',
            path: 'docs/alpha.md',
            isFolder: false,
          },
        ],
      },
      {
        id: 'node_modules',
        name: 'node_modules',
        path: 'node_modules',
        isFolder: true,
        expanded: false,
        children: [],
      },
    ]);
  });

  it('marks git repository folders without exposing the .git directory', async () => {
    mocks.exists.mockImplementation(async (path: string) => path === '/vault/project/.git');
    mocks.listDir.mockImplementation(async (path: string) => {
      if (path === '/vault') {
        return [
          { name: 'project', path: '/vault/project', isDirectory: true, isFile: false },
        ];
      }

      if (path === '/vault/project') {
        return [
          { name: '.git', path: '/vault/project/.git', isDirectory: true, isFile: false },
          { name: 'notes', path: '/vault/project/notes', isDirectory: true, isFile: false },
          { name: 'readme.md', path: '/vault/project/readme.md', isDirectory: false, isFile: true },
        ];
      }

      if (path === '/vault/project/notes') {
        return [
          { name: 'intro.md', path: '/vault/project/notes/intro.md', isDirectory: false, isFile: true },
        ];
      }

      return [];
    });

    const tree = await buildFileTree('/vault');

    expect(tree).toEqual([
      {
        id: 'project',
        name: 'project',
        path: 'project',
        isFolder: true,
        expanded: false,
        isGitRepository: true,
        children: [
          {
            id: 'project/notes',
            name: 'notes',
            path: 'project/notes',
            isFolder: true,
            expanded: false,
            children: [
              {
                id: 'project/notes/intro.md',
                name: 'intro',
                path: 'project/notes/intro.md',
                isFolder: false,
              },
            ],
          },
          {
            id: 'project/readme.md',
            name: 'readme',
            path: 'project/readme.md',
            isFolder: false,
          },
        ],
      },
    ]);
  });

  it('detects a git repository root path', async () => {
    mocks.exists.mockImplementation(async (path: string) => path === '/vault/.git');

    await expect(isGitRepositoryDirectory('/vault')).resolves.toBe(true);
    await expect(isGitRepositoryDirectory('/other')).resolves.toBe(false);
  });

  it('toggles only the targeted folder route', () => {
    const tree = createTree();
    const nextTree = updateFolderExpanded(tree, 'docs/guides');

    expect(nextTree).not.toBe(tree);
    expect(nextTree[0]).not.toBe(tree[0]);
    expect(nextTree[1]).toBe(tree[1]);
    expect((nextTree[0] as Extract<FileTreeNode, { isFolder: true }>).children[0]).not.toBe(
      (tree[0] as Extract<FileTreeNode, { isFolder: true }>).children[0],
    );
  });

  it('expands only the active path ancestors', () => {
    const tree = createTree();
    const nextTree = expandFoldersForPath(tree, 'docs/guides/intro.md');

    expect(nextTree[0]).not.toBe(tree[0]);
    expect(nextTree[1]).toBe(tree[1]);
    expect((nextTree[0] as Extract<FileTreeNode, { isFolder: true }>).expanded).toBe(true);
    expect(
      ((nextTree[0] as Extract<FileTreeNode, { isFolder: true }>).children[0] as Extract<
        FileTreeNode,
        { isFolder: true }
      >).expanded,
    ).toBe(true);
  });

  it('adds and removes nodes without rebuilding untouched siblings', () => {
    const tree = createTree();
    const addedTree = addNodeToTree(tree, 'docs/guides', {
      id: 'docs/guides/new.md',
      name: 'new',
      path: 'docs/guides/new.md',
      isFolder: false,
    });
    const removedTree = removeNodeFromTree(addedTree, 'docs/guides/new.md');

    expect(addedTree[1]).toBe(tree[1]);
    expect(removedTree[1]).toBe(tree[1]);
    expect(
      (((addedTree[0] as Extract<FileTreeNode, { isFolder: true }>).children[0] as Extract<
        FileTreeNode,
        { isFolder: true }
      >).children.length),
    ).toBe(2);
    expect(
      (((removedTree[0] as Extract<FileTreeNode, { isFolder: true }>).children[0] as Extract<
        FileTreeNode,
        { isFolder: true }
      >).children.length),
    ).toBe(1);
  });

  it('re-adds a missing current file path with its folder chain expanded', () => {
    const nextTree = ensureFileNodeInTree([], 'drafts/today/note.md');

    expect(nextTree).toEqual([
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
