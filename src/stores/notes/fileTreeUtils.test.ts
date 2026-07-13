import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FileTreeNode } from './types';
import {
  addNodeToTree,
  buildFileTree,
  countFileTreeNodes,
  expandFoldersForPath,
  findNode,
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
  isAbsolutePath: (path: string) => path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path),
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

function createDeepTree(depth: number): FileTreeNode[] {
  let current: FileTreeNode = {
    id: `folder-${depth}/leaf.md`,
    name: 'leaf',
    path: `folder-${depth}/leaf.md`,
    isFolder: false,
  };

  for (let index = depth; index >= 0; index -= 1) {
    current = {
      id: `folder-${index}`,
      name: `folder-${index}`,
      path: `folder-${index}`,
      isFolder: true,
      expanded: true,
      children: [current],
    };
  }

  return [current];
}

describe('fileTreeUtils structural sharing', () => {
  beforeEach(() => {
    mocks.listDir.mockReset();
    mocks.exists.mockReset();
    mocks.exists.mockResolvedValue(false);
  });

  it('keeps generated folders low priority without hiding their markdown notes', async () => {
    mocks.listDir.mockImplementation(async (path: string) => {
      if (path === '/notesRoot') {
        return [
          { name: 'node_modules', path: '/notesRoot/node_modules', isDirectory: true, isFile: false },
          { name: 'Node_Modules', path: '/notesRoot/Node_Modules', isDirectory: true, isFile: false },
          { name: 'Dist', path: '/notesRoot/Dist', isDirectory: true, isFile: false },
          { name: 'docs', path: '/notesRoot/docs', isDirectory: true, isFile: false },
        ];
      }

      if (path === '/notesRoot/docs') {
        return [
          { name: 'alpha.md', path: '/notesRoot/docs/alpha.md', isDirectory: false, isFile: true },
        ];
      }

      if (path === '/notesRoot/node_modules') {
        return [
          { name: 'package.md', path: '/notesRoot/node_modules/package.md', isDirectory: false, isFile: true },
        ];
      }

      if (path === '/notesRoot/Node_Modules') {
        return [
          { name: 'package.md', path: '/notesRoot/Node_Modules/package.md', isDirectory: false, isFile: true },
        ];
      }

      if (path === '/notesRoot/Dist') {
        return [
          { name: 'bundle.md', path: '/notesRoot/Dist/bundle.md', isDirectory: false, isFile: true },
        ];
      }

      return [];
    });

    const tree = await buildFileTree('/notesRoot');

    expect(mocks.listDir).toHaveBeenCalledWith('/notesRoot/docs', { includeHidden: true });
    expect(mocks.listDir).toHaveBeenCalledWith('/notesRoot/node_modules', { includeHidden: true });
    expect(mocks.listDir).toHaveBeenCalledWith('/notesRoot/Node_Modules', { includeHidden: true });
    expect(mocks.listDir).toHaveBeenCalledWith('/notesRoot/Dist', { includeHidden: true });
    expect(mocks.exists).not.toHaveBeenCalledWith('/notesRoot/node_modules/.git');
    expect(mocks.exists).not.toHaveBeenCalledWith('/notesRoot/Node_Modules/.git');
    expect(mocks.exists).not.toHaveBeenCalledWith('/notesRoot/Dist/.git');
    expect(mocks.exists).toHaveBeenCalledWith('/notesRoot/docs/.git');
    expect(tree).toEqual([
      {
        id: 'Dist',
        name: 'Dist',
        path: 'Dist',
        isFolder: true,
        expanded: false,
        children: [
          {
            id: 'Dist/bundle.md',
            name: 'bundle',
            path: 'Dist/bundle.md',
            isFolder: false,
          },
        ],
      },
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
        children: [
          {
            id: 'node_modules/package.md',
            name: 'package',
            path: 'node_modules/package.md',
            isFolder: false,
          },
        ],
      },
      {
        id: 'Node_Modules',
        name: 'Node_Modules',
        path: 'Node_Modules',
        isFolder: true,
        expanded: false,
        children: [
          {
            id: 'Node_Modules/package.md',
            name: 'package',
            path: 'Node_Modules/package.md',
            isFolder: false,
          },
        ],
      },
    ]);
  });

  it('detects sibling git folders with bounded concurrency', async () => {
    let activeDetections = 0;
    let maxActiveDetections = 0;
    mocks.listDir.mockImplementation(async (path: string) => {
      if (path === '/notesRoot') {
        return Array.from({ length: 12 }, (_, index) => ({
          name: `folder-${index}`,
          path: `/notesRoot/folder-${index}`,
          isDirectory: true,
          isFile: false,
        }));
      }

      return [];
    });
    mocks.exists.mockImplementation(async () => {
      activeDetections += 1;
      maxActiveDetections = Math.max(maxActiveDetections, activeDetections);
      await new Promise((resolve) => setTimeout(resolve, 0));
      activeDetections -= 1;
      return false;
    });

    const tree = await buildFileTree('/notesRoot');

    expect(tree).toHaveLength(12);
    expect(mocks.exists).toHaveBeenCalledTimes(12);
    expect(maxActiveDetections).toBeGreaterThan(1);
    expect(maxActiveDetections).toBeLessThanOrEqual(8);
  });

  it('includes every supported markdown extension in the tree', async () => {
    mocks.listDir.mockResolvedValue([
      { name: 'alpha.md', path: '/notesRoot/alpha.md', isDirectory: false, isFile: true },
      { name: 'beta.markdown', path: '/notesRoot/beta.markdown', isDirectory: false, isFile: true },
      { name: 'gamma.mdown', path: '/notesRoot/gamma.mdown', isDirectory: false, isFile: true },
      { name: 'delta.mkd', path: '/notesRoot/delta.mkd', isDirectory: false, isFile: true },
      { name: 'image.png', path: '/notesRoot/image.png', isDirectory: false, isFile: true },
    ]);

    await expect(buildFileTree('/notesRoot')).resolves.toEqual([
      {
        id: 'alpha.md',
        name: 'alpha',
        path: 'alpha.md',
        isFolder: false,
      },
      {
        id: 'beta.markdown',
        name: 'beta',
        path: 'beta.markdown',
        isFolder: false,
      },
      {
        id: 'delta.mkd',
        name: 'delta',
        path: 'delta.mkd',
        isFolder: false,
      },
      {
        id: 'gamma.mdown',
        name: 'gamma',
        path: 'gamma.mdown',
        isFolder: false,
      },
      {
        id: 'image.png',
        name: 'image.png',
        path: 'image.png',
        isFolder: false,
        kind: 'image',
      },
    ]);
  });

  it('includes user dotfile notes while hiding internal app and git folders', async () => {
    mocks.listDir.mockImplementation(async (path: string) => {
      if (path === '/notesRoot') {
        return [
          { name: '.journal.md', path: '/notesRoot/.journal.md', isDirectory: false, isFile: true },
          { name: '.notes', path: '/notesRoot/.notes', isDirectory: true, isFile: false },
          { name: '.vlaina', path: '/notesRoot/.vlaina', isDirectory: true, isFile: false },
          { name: '.git', path: '/notesRoot/.git', isDirectory: true, isFile: false },
          { name: '.VLAINA', path: '/notesRoot/.VLAINA', isDirectory: true, isFile: false },
          { name: '.GIT', path: '/notesRoot/.GIT', isDirectory: true, isFile: false },
        ];
      }

      if (path === '/notesRoot/.notes') {
        return [
          { name: 'alpha.md', path: '/notesRoot/.notes/alpha.md', isDirectory: false, isFile: true },
        ];
      }

      return [];
    });

    await expect(buildFileTree('/notesRoot')).resolves.toEqual([
      {
        id: '.notes',
        name: '.notes',
        path: '.notes',
        isFolder: true,
        expanded: false,
        children: [
          {
            id: '.notes/alpha.md',
            name: 'alpha',
            path: '.notes/alpha.md',
            isFolder: false,
          },
        ],
      },
      {
        id: '.journal.md',
        name: '.journal',
        path: '.journal.md',
        isFolder: false,
      },
    ]);
    expect(mocks.listDir).toHaveBeenCalledWith('/notesRoot', { includeHidden: true });
    expect(mocks.listDir).toHaveBeenCalledWith('/notesRoot/.notes', { includeHidden: true });
    expect(mocks.listDir).not.toHaveBeenCalledWith('/notesRoot/.vlaina');
    expect(mocks.listDir).not.toHaveBeenCalledWith('/notesRoot/.git');
    expect(mocks.listDir).not.toHaveBeenCalledWith('/notesRoot/.VLAINA');
    expect(mocks.listDir).not.toHaveBeenCalledWith('/notesRoot/.GIT');
  });

  it('caps root-level file tree entry processing before building nodes', async () => {
    mocks.listDir.mockResolvedValue(
      Array.from({ length: 6000 }, (_, index) => ({
        name: `folder-${String(index).padStart(4, '0')}`,
        path: `/notesRoot/folder-${String(index).padStart(4, '0')}`,
        isDirectory: true,
        isFile: false,
      })),
    );

    const tree = await buildFileTree('/notesRoot');

    expect(tree).toHaveLength(5000);
    expect(mocks.exists).toHaveBeenCalledTimes(5000);
    expect(mocks.exists).not.toHaveBeenCalledWith('/notesRoot/folder-5000/.git');
    expect(mocks.listDir).toHaveBeenCalledTimes(1);
  });

  it('does not let non-markdown files spend the scan budget before visible notes', async () => {
    mocks.listDir.mockResolvedValue([
      ...Array.from({ length: 10_000 }, (_, index) => ({
        name: `asset-${String(index).padStart(5, '0')}.png`,
        path: `/notesRoot/asset-${String(index).padStart(5, '0')}.png`,
        isDirectory: false,
        isFile: true,
      })),
      { name: 'late.md', path: '/notesRoot/late.md', isDirectory: false, isFile: true },
    ]);

    const tree = await buildFileTree('/notesRoot');

    expect(tree).toHaveLength(5000);
    expect(tree).toContainEqual({
      id: 'late.md',
      name: 'late',
      path: 'late.md',
      isFolder: false,
    });
    expect(tree.filter((node) => !node.isFolder && node.kind === 'image')).toHaveLength(4999);
  });

  it('ignores unsafe storage entry names while building the tree', async () => {
    mocks.listDir.mockImplementation(async (path: string) => {
      if (path === '/notesRoot') {
        return [
          { name: 'safe.md', path: '/notesRoot/safe.md', isDirectory: false, isFile: true },
          { name: '../secret.md', path: '/notesRoot/../secret.md', isDirectory: false, isFile: true },
          { name: 'nested/evil.md', path: '/notesRoot/nested/evil.md', isDirectory: false, isFile: true },
          { name: 'bad\\evil.md', path: '/notesRoot/bad/evil.md', isDirectory: false, isFile: true },
          { name: 'docs', path: '/notesRoot/docs', isDirectory: true, isFile: false },
          { name: '..', path: '/notesRoot/..', isDirectory: true, isFile: false },
        ];
      }

      if (path === '/notesRoot/docs') {
        return [
          { name: 'inside.md', path: '/notesRoot/docs/inside.md', isDirectory: false, isFile: true },
        ];
      }

      return [];
    });

    const tree = await buildFileTree('/notesRoot');

    expect(tree).toEqual([
      {
        id: 'docs',
        name: 'docs',
        path: 'docs',
        isFolder: true,
        expanded: false,
        children: [
          {
            id: 'docs/inside.md',
            name: 'inside',
            path: 'docs/inside.md',
            isFolder: false,
          },
        ],
      },
      {
        id: 'safe.md',
        name: 'safe',
        path: 'safe.md',
        isFolder: false,
      },
    ]);
    expect(mocks.listDir).not.toHaveBeenCalledWith('/notesRoot/..');
  });

  it('keeps readable sibling notes when one nested folder cannot be listed', async () => {
    mocks.listDir.mockImplementation(async (path: string) => {
      if (path === '/notesRoot') {
        return [
          { name: 'root.md', path: '/notesRoot/root.md', isDirectory: false, isFile: true },
          { name: 'docs', path: '/notesRoot/docs', isDirectory: true, isFile: false },
          { name: 'locked', path: '/notesRoot/locked', isDirectory: true, isFile: false },
        ];
      }

      if (path === '/notesRoot/docs') {
        return [
          { name: 'inside.md', path: '/notesRoot/docs/inside.md', isDirectory: false, isFile: true },
        ];
      }

      if (path === '/notesRoot/locked') {
        throw new Error('Permission denied');
      }

      return [];
    });

    const tree = await buildFileTree('/notesRoot');

    expect(tree).toEqual([
      {
        id: 'docs',
        name: 'docs',
        path: 'docs',
        isFolder: true,
        expanded: false,
        children: [
          {
            id: 'docs/inside.md',
            name: 'inside',
            path: 'docs/inside.md',
            isFolder: false,
          },
        ],
      },
      {
        id: 'locked',
        name: 'locked',
        path: 'locked',
        isFolder: true,
        expanded: false,
        children: [],
      },
      {
        id: 'root.md',
        name: 'root',
        path: 'root.md',
        isFolder: false,
      },
    ]);
  });

  it('marks git repository folders without exposing the .git directory', async () => {
    mocks.exists.mockImplementation(async (path: string) => path === '/notesRoot/project/.git');
    mocks.listDir.mockImplementation(async (path: string) => {
      if (path === '/notesRoot') {
        return [
          { name: 'project', path: '/notesRoot/project', isDirectory: true, isFile: false },
        ];
      }

      if (path === '/notesRoot/project') {
        return [
          { name: '.git', path: '/notesRoot/project/.git', isDirectory: true, isFile: false },
          { name: 'notes', path: '/notesRoot/project/notes', isDirectory: true, isFile: false },
          { name: 'readme.md', path: '/notesRoot/project/readme.md', isDirectory: false, isFile: true },
        ];
      }

      if (path === '/notesRoot/project/notes') {
        return [
          { name: 'intro.md', path: '/notesRoot/project/notes/intro.md', isDirectory: false, isFile: true },
        ];
      }

      return [];
    });

    const tree = await buildFileTree('/notesRoot');

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
    mocks.exists.mockImplementation(async (path: string) => path === '/notesRoot/.git');

    await expect(isGitRepositoryDirectory('/notesRoot')).resolves.toBe(true);
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

  it('counts deep file trees without recursive traversal', () => {
    expect(countFileTreeNodes(createDeepTree(2500))).toEqual({
      nodes: 2502,
      folders: 2501,
      files: 1,
    });
  });

  it('finds nodes in deep file trees without recursive traversal', () => {
    expect(findNode(createDeepTree(2500), 'folder-2500/leaf.md')).toMatchObject({
      isFolder: false,
      path: 'folder-2500/leaf.md',
    });
  });
});
