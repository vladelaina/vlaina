import { describe, expect, it } from 'vitest';
import {
  activateNotesSplitPreviewLeaf,
  clampNotesSplitRatio,
  countNotesSplitPreviewLeaves,
  createInitialNotesSplitPaneTree,
  findFirstNotesSplitPreviewLeaf,
  findNotesSplitPreviewLeafByPath,
  moveNotesSplitPaneLeaf,
  promoteNotesSplitPreviewLeafToPrimary,
  pruneNotesSplitPaneTree,
  resizeNotesSplitPaneTree,
  resolveNotesSplitDropDirection,
  splitNotesPaneTree,
  type NotesSplitPreviewLeaf,
} from './notesSplitLayout';

const rect = {
  left: 100,
  right: 1100,
  top: 200,
  bottom: 1000,
  width: 1000,
  height: 800,
};

describe('resolveNotesSplitDropDirection', () => {
  it('resolves the nearest editor edge inside the split threshold', () => {
    expect(resolveNotesSplitDropDirection(rect, { clientX: 110, clientY: 600 })).toBe('left');
    expect(resolveNotesSplitDropDirection(rect, { clientX: 1090, clientY: 600 })).toBe('right');
    expect(resolveNotesSplitDropDirection(rect, { clientX: 600, clientY: 210 })).toBe('top');
    expect(resolveNotesSplitDropDirection(rect, { clientX: 600, clientY: 990 })).toBe('bottom');
  });

  it('ignores center and outside drops', () => {
    expect(resolveNotesSplitDropDirection(rect, { clientX: 600, clientY: 600 })).toBeNull();
    expect(resolveNotesSplitDropDirection(rect, { clientX: 90, clientY: 600 })).toBeNull();
  });
});

describe('notes split pane tree', () => {
  it('splits a target leaf and keeps the primary pane in the requested order', () => {
    const previewLeaf: NotesSplitPreviewLeaf = {
      type: 'preview',
      id: 'preview:1',
      path: 'docs/beta.md',
      requiresOpenTab: true,
    };

    const tree = splitNotesPaneTree(
      createInitialNotesSplitPaneTree(),
      'primary',
      previewLeaf,
      'right',
      'split:1',
    );

    expect(tree).toMatchObject({
      type: 'split',
      direction: 'right',
      orientation: 'horizontal',
      first: { type: 'primary' },
      second: { type: 'preview', path: 'docs/beta.md' },
    });
    expect(countNotesSplitPreviewLeaves(tree)).toBe(1);
  });

  it('can split an existing preview leaf to create additional panes', () => {
    const firstPreview: NotesSplitPreviewLeaf = {
      type: 'preview',
      id: 'preview:1',
      path: 'docs/beta.md',
      requiresOpenTab: true,
    };
    const secondPreview: NotesSplitPreviewLeaf = {
      type: 'preview',
      id: 'preview:2',
      path: 'docs/gamma.md',
      requiresOpenTab: false,
    };

    const firstTree = splitNotesPaneTree(
      createInitialNotesSplitPaneTree(),
      'primary',
      firstPreview,
      'right',
      'split:1',
    );
    const nextTree = splitNotesPaneTree(firstTree, 'preview:1', secondPreview, 'bottom', 'split:2');

    expect(countNotesSplitPreviewLeaves(nextTree)).toBe(2);
    expect(nextTree).toMatchObject({
      type: 'split',
      second: {
        type: 'split',
        direction: 'bottom',
        orientation: 'vertical',
        first: { type: 'preview', path: 'docs/beta.md' },
        second: { type: 'preview', path: 'docs/gamma.md' },
      },
    });
  });

  it('prunes removed previews and collapses empty split nodes', () => {
    const firstPreview: NotesSplitPreviewLeaf = {
      type: 'preview',
      id: 'preview:1',
      path: 'docs/beta.md',
      requiresOpenTab: true,
    };
    const secondPreview: NotesSplitPreviewLeaf = {
      type: 'preview',
      id: 'preview:2',
      path: 'docs/gamma.md',
      requiresOpenTab: true,
    };
    const tree = splitNotesPaneTree(
      splitNotesPaneTree(createInitialNotesSplitPaneTree(), 'primary', firstPreview, 'right', 'split:1'),
      'preview:1',
      secondPreview,
      'bottom',
      'split:2',
    );

    const pruned = pruneNotesSplitPaneTree(tree, (leaf) => leaf.path === 'docs/beta.md');

    expect(countNotesSplitPreviewLeaves(pruned ?? createInitialNotesSplitPaneTree())).toBe(1);
    expect(pruned).toMatchObject({
      type: 'split',
      second: { type: 'preview', path: 'docs/gamma.md' },
    });
  });

  it('activates a preview leaf by moving the primary pane into its position', () => {
    const previewLeaf: NotesSplitPreviewLeaf = {
      type: 'preview',
      id: 'preview:1',
      path: 'docs/beta.md',
      requiresOpenTab: true,
    };
    const replacementLeaf: NotesSplitPreviewLeaf = {
      type: 'preview',
      id: 'preview:2',
      path: 'docs/alpha.md',
      requiresOpenTab: true,
    };
    const tree = splitNotesPaneTree(
      createInitialNotesSplitPaneTree(),
      'primary',
      previewLeaf,
      'right',
      'split:1',
    );

    const nextTree = activateNotesSplitPreviewLeaf(tree, 'preview:1', replacementLeaf);

    expect(nextTree).toMatchObject({
      type: 'split',
      first: { type: 'preview', path: 'docs/alpha.md' },
      second: { type: 'primary' },
    });
    expect(findNotesSplitPreviewLeafByPath(nextTree, 'docs/alpha.md')).toMatchObject({
      id: 'preview:2',
    });
  });

  it('promotes a preview leaf when the active primary pane closes', () => {
    const firstPreview: NotesSplitPreviewLeaf = {
      type: 'preview',
      id: 'preview:1',
      path: 'docs/beta.md',
      requiresOpenTab: true,
    };
    const secondPreview: NotesSplitPreviewLeaf = {
      type: 'preview',
      id: 'preview:2',
      path: 'docs/gamma.md',
      requiresOpenTab: true,
    };
    const tree = splitNotesPaneTree(
      splitNotesPaneTree(createInitialNotesSplitPaneTree(), 'primary', firstPreview, 'right', 'split:1'),
      'preview:1',
      secondPreview,
      'bottom',
      'split:2',
    );
    const promoted = findFirstNotesSplitPreviewLeaf(tree);

    const nextTree = promoteNotesSplitPreviewLeafToPrimary(tree, promoted?.id ?? '');

    expect(promoted).toMatchObject({ path: 'docs/beta.md' });
    expect(nextTree).toMatchObject({
      type: 'split',
      first: { type: 'primary' },
      second: { type: 'preview', path: 'docs/gamma.md' },
    });
    expect(countNotesSplitPreviewLeaves(nextTree ?? createInitialNotesSplitPaneTree())).toBe(1);
  });

  it('moves an existing preview leaf to another leaf edge', () => {
    const firstPreview: NotesSplitPreviewLeaf = {
      type: 'preview',
      id: 'preview:1',
      path: 'docs/beta.md',
      requiresOpenTab: true,
    };
    const secondPreview: NotesSplitPreviewLeaf = {
      type: 'preview',
      id: 'preview:2',
      path: 'docs/gamma.md',
      requiresOpenTab: false,
    };
    const tree = splitNotesPaneTree(
      splitNotesPaneTree(createInitialNotesSplitPaneTree(), 'primary', firstPreview, 'right', 'split:1'),
      'preview:1',
      secondPreview,
      'bottom',
      'split:2',
    );

    const moved = moveNotesSplitPaneLeaf(tree, 'preview:2', 'primary', 'left', 'split:3');

    expect(countNotesSplitPreviewLeaves(moved)).toBe(2);
    expect(moved).toMatchObject({
      type: 'split',
      direction: 'right',
      first: {
        type: 'split',
        direction: 'left',
        first: { type: 'preview', id: 'preview:2', path: 'docs/gamma.md' },
        second: { type: 'primary' },
      },
      second: { type: 'preview', id: 'preview:1', path: 'docs/beta.md' },
    });
  });

  it('moves the primary leaf while preserving preview leaves', () => {
    const firstPreview: NotesSplitPreviewLeaf = {
      type: 'preview',
      id: 'preview:1',
      path: 'docs/beta.md',
      requiresOpenTab: true,
    };
    const secondPreview: NotesSplitPreviewLeaf = {
      type: 'preview',
      id: 'preview:2',
      path: 'docs/gamma.md',
      requiresOpenTab: false,
    };
    const tree = splitNotesPaneTree(
      splitNotesPaneTree(createInitialNotesSplitPaneTree(), 'primary', firstPreview, 'right', 'split:1'),
      'preview:1',
      secondPreview,
      'bottom',
      'split:2',
    );

    const moved = moveNotesSplitPaneLeaf(tree, 'primary', 'preview:2', 'top', 'split:3');

    expect(countNotesSplitPreviewLeaves(moved)).toBe(2);
    expect(moved).toMatchObject({
      type: 'split',
      direction: 'bottom',
      first: { type: 'preview', id: 'preview:1', path: 'docs/beta.md' },
      second: {
        type: 'split',
        direction: 'top',
        first: { type: 'primary' },
        second: { type: 'preview', id: 'preview:2', path: 'docs/gamma.md' },
      },
    });
  });

  it('clamps split resize ratios', () => {
    expect(clampNotesSplitRatio(-1)).toBe(0.18);
    expect(clampNotesSplitRatio(0.5)).toBe(0.5);
    expect(clampNotesSplitRatio(2)).toBe(0.82);

    const tree = splitNotesPaneTree(
      createInitialNotesSplitPaneTree(),
      'primary',
      {
        type: 'preview',
        id: 'preview:1',
        path: 'docs/beta.md',
        requiresOpenTab: true,
      },
      'right',
      'split:1',
    );

    expect(resizeNotesSplitPaneTree(tree, 'split:1', 0.9)).toMatchObject({
      type: 'split',
      ratio: 0.82,
    });
  });
});
