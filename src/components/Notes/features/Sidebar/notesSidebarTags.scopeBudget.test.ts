import { describe, expect, it } from 'vitest';
import type { FileTreeNode, FolderNode } from '@/stores/useNotesStore';
import { buildNotesSidebarTagScopeEntries } from './notesSidebarTags';

describe('notesSidebarTags scope budgets', () => {
  it('collects deeply nested notes without recursive traversal', () => {
    let current: FileTreeNode = {
      id: 'deep-note',
      name: 'deep.md',
      path: 'deep.md',
      isFolder: false,
    };

    for (let depth = 0; depth < 1500; depth += 1) {
      current = {
        id: `folder-${depth}`,
        name: `folder-${depth}`,
        path: `folder-${depth}`,
        isFolder: true,
        expanded: true,
        children: [current],
      };
    }

    expect(buildNotesSidebarTagScopeEntries({ rootFolder: current as FolderNode })).toEqual([
      { path: 'deep.md' },
    ]);
  });

  it('caps oversized tag scope path lists', () => {
    const largeRoot: FolderNode = {
      id: 'root-large',
      name: 'Notes',
      path: '',
      isFolder: true,
      expanded: true,
      children: Array.from({ length: 10_001 }, (_, index) => ({
        id: `note-${index}`,
        name: `note-${index}.md`,
        path: `note-${index}.md`,
        isFolder: false,
      })),
    };

    expect(buildNotesSidebarTagScopeEntries({ rootFolder: largeRoot })).toHaveLength(10_000);
  });

  it('prioritizes current vault starred folders before capping large tag scopes', () => {
    const largeRoot: FolderNode = {
      id: 'root-large-starred',
      name: 'Notes',
      path: '',
      isFolder: true,
      expanded: true,
      children: [
        ...Array.from({ length: 10_000 }, (_, index) => ({
          id: `note-${index}`,
          name: `note-${index}.md`,
          path: `note-${index}.md`,
          isFolder: false as const,
        })),
        {
          id: 'folder-starred',
          name: 'starred',
          path: 'starred',
          isFolder: true,
          expanded: true,
          children: [
            {
              id: 'note-priority',
              name: 'priority.md',
              path: 'starred/priority.md',
              isFolder: false as const,
            },
          ],
        },
      ],
    };

    const entries = buildNotesSidebarTagScopeEntries({
      rootFolder: largeRoot,
      currentVaultPath: '/vault',
      starredEntries: [
        {
          id: 'starred-folder',
          kind: 'folder',
          vaultPath: '/vault',
          relativePath: 'starred',
          addedAt: 1,
        },
      ],
    });

    expect(entries).toHaveLength(10_000);
    expect(entries.map((entry) => entry.path)).toContain('starred/priority.md');
  });
});
