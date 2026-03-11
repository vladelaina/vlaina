import { describe, expect, it } from 'vitest';
import {
  applyDraftNodes,
  buildTreeFromRecursiveEntries,
  findNode,
  toggleNodeExpanded,
  upsertTreeNode,
} from './tree';
import {
  createDraftRecord,
  createFileNode,
  createFolderNode,
  createTreeEntry,
} from './testUtils';

describe('cloud repo tree helpers', () => {
  it('buildTreeFromRecursiveEntries filters placeholders and non-markdown files', () => {
    const tree = buildTreeFromRecursiveEntries([
      createTreeEntry('docs', 'dir'),
      createTreeEntry('alpha', 'dir'),
      createTreeEntry('docs/readme.md'),
      createTreeEntry('docs/.nekotick.keep'),
      createTreeEntry('docs/image.png'),
      createTreeEntry('z.md'),
    ]);

    expect(tree.map((node) => node.path)).toEqual(['alpha', 'docs', 'z.md']);
    expect(tree[1].children?.map((node) => node.path)).toEqual(['docs/readme.md']);
  });

  it('buildTreeFromRecursiveEntries preserves expanded state from previous nodes', () => {
    const previous = [createFolderNode('docs', [], { expanded: true })];

    const tree = buildTreeFromRecursiveEntries(
      [createTreeEntry('docs', 'dir'), createTreeEntry('docs/readme.md')],
      previous
    );

    expect(tree[0]).toMatchObject({ path: 'docs', expanded: true });
  });

  it('upsertTreeNode creates missing parent folders and does not duplicate nodes', () => {
    const first = upsertTreeNode([], 'docs/note.md', 'file', 'sha-a');
    const second = upsertTreeNode(first, 'docs/note.md', 'file', 'sha-a');

    expect(first[0]).toMatchObject({ path: 'docs', kind: 'folder', expanded: true });
    expect(first[0].children?.[0]).toMatchObject({
      path: 'docs/note.md',
      kind: 'file',
      sha: 'sha-a',
    });
    expect(second[0].children).toHaveLength(1);
  });

  it('applyDraftNodes adds missing dirty markdown drafts and ignores conflicts', () => {
    const base = [createFolderNode('docs', [createFileNode('docs/readme.md')])];
    const tree = applyDraftNodes(base, [
      createDraftRecord(1, 'docs/new.md', 'dirty'),
      createDraftRecord(1, 'docs/conflict.md', 'conflict'),
      createDraftRecord(1, 'docs/image.png', 'dirty'),
    ]);

    expect(findNode(tree, 'docs/new.md')).toMatchObject({ path: 'docs/new.md' });
    expect(findNode(tree, 'docs/conflict.md')).toBeNull();
    expect(findNode(tree, 'docs/image.png')).toBeNull();
  });

  it('toggleNodeExpanded flips only the targeted folder node', () => {
    const tree = [
      createFolderNode('docs', [createFileNode('docs/readme.md')], { expanded: false }),
      createFolderNode('other', [], { expanded: false }),
    ];

    const toggled = toggleNodeExpanded(tree, 'docs');

    expect(findNode(toggled, 'docs')).toMatchObject({ expanded: true });
    expect(findNode(toggled, 'other')).toMatchObject({ expanded: false });
  });
});
