import { describe, expect, it } from 'vitest';
import { collectMentionFolderMarkdownNodes } from './helpers';
import type { FileTreeNode } from '@/stores/notes/types';

function note(path: string): FileTreeNode {
  return {
    id: path,
    name: path.split('/').pop() ?? path,
    path,
    isFolder: false,
  };
}

function folder(path: string, children: FileTreeNode[]): FileTreeNode {
  return {
    id: path,
    name: path.split('/').pop() ?? path,
    path,
    isFolder: true,
    expanded: true,
    children,
  };
}

describe('collectMentionFolderMarkdownNodes', () => {
  it('keeps depth-first markdown order', () => {
    const nodes = [
      note('docs/a.md'),
      folder('docs/nested', [
        note('docs/nested/b.txt'),
        note('docs/nested/c.markdown'),
      ]),
      note('docs/d.mdown'),
    ];

    expect(collectMentionFolderMarkdownNodes(nodes).map((node) => node.path)).toEqual([
      'docs/a.md',
      'docs/nested/c.markdown',
      'docs/d.mdown',
    ]);
  });

  it('stops before visiting later subtrees after the folder mention limit is reached', () => {
    let expensiveChildrenAccessed = false;
    const expensiveFolder = {
      id: 'docs/expensive',
      name: 'expensive',
      path: 'docs/expensive',
      isFolder: true,
      expanded: true,
      get children() {
        expensiveChildrenAccessed = true;
        return [note('docs/expensive/late.md')];
      },
    } as FileTreeNode;
    const nodes = [
      ...Array.from({ length: 20 }, (_value, index) => note(`docs/${index}.md`)),
      expensiveFolder,
    ];

    expect(collectMentionFolderMarkdownNodes(nodes)).toHaveLength(20);
    expect(expensiveChildrenAccessed).toBe(false);
  });

  it('does not spend the scan budget on unsupported files before markdown notes', () => {
    const nodes = [
      ...Array.from({ length: 600 }, (_value, index) => note(`docs/asset-${index}.png`)),
      note('docs/z-alpha.md'),
    ];

    expect(collectMentionFolderMarkdownNodes(nodes).map((node) => node.path)).toEqual([
      'docs/z-alpha.md',
    ]);
  });

  it('includes user dot markdown while skipping internal and generated folders', () => {
    const nodes = [
      note('docs/.journal.md'),
      folder('docs/.notes', [
        note('docs/.notes/alpha.md'),
      ]),
      folder('docs/.vlaina', [
        note('docs/.vlaina/workspace.md'),
      ]),
      folder('docs/.git', [
        note('docs/.git/config.md'),
      ]),
      folder('docs/.VLAINA', [
        note('docs/.VLAINA/workspace.md'),
      ]),
      folder('docs/.GIT', [
        note('docs/.GIT/config.md'),
      ]),
      folder('docs/node_modules', [
        note('docs/node_modules/package.md'),
      ]),
      folder('docs/Node_Modules', [
        note('docs/Node_Modules/package.md'),
      ]),
      folder('docs/Dist', [
        note('docs/Dist/bundle.md'),
      ]),
    ];

    expect(collectMentionFolderMarkdownNodes(nodes).map((node) => node.path)).toEqual([
      'docs/.journal.md',
      'docs/.notes/alpha.md',
    ]);
  });
});
