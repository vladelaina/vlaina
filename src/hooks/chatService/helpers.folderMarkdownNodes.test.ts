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
  it('prioritizes sibling markdown before nested folder markdown', () => {
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
      'docs/d.mdown',
      'docs/nested/c.markdown',
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

  it('does not spend the scan budget on sibling folders before markdown notes', () => {
    const nodes = [
      ...Array.from({ length: 500 }, (_value, index) => folder(`docs/folder-${index}`, [])),
      note('docs/z-alpha.md'),
    ];

    expect(collectMentionFolderMarkdownNodes(nodes).map((node) => node.path)).toEqual([
      'docs/z-alpha.md',
    ]);
  });

  it('does not let early folder markdown fill the result limit before sibling markdown', () => {
    const nodes = [
      folder('docs/nested', Array.from({ length: 20 }, (_value, index) => note(`docs/nested/${index}.md`))),
      note('docs/z-alpha.md'),
    ];

    const paths = collectMentionFolderMarkdownNodes(nodes).map((node) => node.path);

    expect(paths).toHaveLength(20);
    expect(paths[0]).toBe('docs/z-alpha.md');
    expect(paths).not.toContain('docs/nested/19.md');
  });

  it('includes user dot markdown and low-priority generated folders while skipping internal folders', () => {
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
      'docs/node_modules/package.md',
      'docs/Node_Modules/package.md',
      'docs/Dist/bundle.md',
    ]);
  });
});
