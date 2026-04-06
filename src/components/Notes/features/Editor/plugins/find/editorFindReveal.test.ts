import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  expandCollapsedHeadingSectionAtPosMock: vi.fn(),
  toggleCodeBlockCollapsedMock: vi.fn(),
}));

vi.mock('../heading/collapse', () => ({
  expandCollapsedHeadingSectionAtPos: mocks.expandCollapsedHeadingSectionAtPosMock,
}));

vi.mock('../code/codeBlockTransactions', () => ({
  toggleCodeBlockCollapsed: mocks.toggleCodeBlockCollapsedMock,
}));

import { findCollapsedCodeBlockPos, revealEditorFindMatch } from './editorFindReveal';

function createResolvedView(options: {
  depth: number;
  nodes: Array<{ type: { name: string }; attrs?: Record<string, unknown> }>;
  before: Record<number, number>;
}) {
  return {
    state: {
      doc: {
        resolve: vi.fn(() => ({
          depth: options.depth,
          node: (depth: number) => options.nodes[depth],
          before: (depth: number) => options.before[depth],
        })),
      },
    },
  };
}

describe('editorFindReveal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('finds the collapsed code block ancestor for a match position', () => {
    const view = createResolvedView({
      depth: 3,
      nodes: [
        { type: { name: 'doc' } },
        { type: { name: 'paragraph' } },
        { type: { name: 'code_block' }, attrs: { collapsed: true } },
        { type: { name: 'text' } },
      ],
      before: {
        2: 12,
      },
    });

    expect(findCollapsedCodeBlockPos(view as never, 18)).toBe(12);
  });

  it('ignores expanded code blocks when resolving a hidden match', () => {
    const view = createResolvedView({
      depth: 2,
      nodes: [
        { type: { name: 'doc' } },
        { type: { name: 'code_block' }, attrs: { collapsed: false } },
        { type: { name: 'text' } },
      ],
      before: {
        1: 8,
      },
    });

    expect(findCollapsedCodeBlockPos(view as never, 10)).toBeNull();
  });

  it('reveals hidden heading sections and collapsed code blocks before scrolling', () => {
    mocks.expandCollapsedHeadingSectionAtPosMock.mockReturnValue(true);
    const view = createResolvedView({
      depth: 2,
      nodes: [
        { type: { name: 'doc' } },
        { type: { name: 'code_block' }, attrs: { collapsed: true } },
        { type: { name: 'text' } },
      ],
      before: {
        1: 24,
      },
    });

    const revealed = revealEditorFindMatch(view as never, {
      from: 30,
      to: 31,
      ranges: [{ from: 30, to: 31 }],
    });

    expect(revealed).toBe(true);
    expect(mocks.expandCollapsedHeadingSectionAtPosMock).toHaveBeenCalledWith(view, 30);
    expect(mocks.toggleCodeBlockCollapsedMock).toHaveBeenCalledWith(view, 24, true);
  });

  it('returns false when the active match is already visible', () => {
    mocks.expandCollapsedHeadingSectionAtPosMock.mockReturnValue(false);
    const view = createResolvedView({
      depth: 1,
      nodes: [
        { type: { name: 'doc' } },
        { type: { name: 'paragraph' } },
      ],
      before: {},
    });

    const revealed = revealEditorFindMatch(view as never, {
      from: 6,
      to: 10,
      ranges: [{ from: 6, to: 10 }],
    });

    expect(revealed).toBe(false);
    expect(mocks.toggleCodeBlockCollapsedMock).not.toHaveBeenCalled();
  });
});
