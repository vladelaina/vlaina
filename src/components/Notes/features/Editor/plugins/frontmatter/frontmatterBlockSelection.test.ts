import { describe, expect, it, vi } from 'vitest';
import { deleteSelectedFrontmatterBlocks, getFrontmatterSelectedBlocks } from './frontmatterBlockSelection';

const deleteSelectedBlocksMock = vi.fn();

vi.mock('../cursor', () => ({
  blankAreaDragBoxPluginKey: {
    getState: vi.fn((state: { __selectedBlocks?: Array<{ from: number; to: number }> }) => ({
      selectedBlocks: state.__selectedBlocks ?? [],
    })),
  },
}));

vi.mock('../cursor/blockSelectionCommands', () => ({
  deleteSelectedBlocks: (...args: unknown[]) => deleteSelectedBlocksMock(...args),
}));

describe('frontmatterBlockSelection', () => {
  it('returns the full block selection when the current frontmatter block is selected', () => {
    const view = {
      state: {
        __selectedBlocks: [
          { from: 0, to: 5 },
          { from: 5, to: 11 },
        ],
      },
    } as never;

    expect(getFrontmatterSelectedBlocks(view, 0, 5)).toEqual([
      { from: 0, to: 5 },
      { from: 5, to: 11 },
    ]);
  });

  it('returns an empty selection when the current frontmatter block is not in the block selection', () => {
    const view = {
      state: {
        __selectedBlocks: [
          { from: 5, to: 11 },
        ],
      },
    } as never;

    expect(getFrontmatterSelectedBlocks(view, 0, 5)).toEqual([]);
  });

  it('deletes the full selected block group when delete is triggered from a selected frontmatter block', () => {
    deleteSelectedBlocksMock.mockReset();
    deleteSelectedBlocksMock.mockReturnValue(true);
    const view = {
      state: {
        __selectedBlocks: [
          { from: 0, to: 5 },
          { from: 5, to: 11 },
        ],
      },
      dispatch: vi.fn(),
      focus: vi.fn(),
    } as any;

    expect(deleteSelectedFrontmatterBlocks(view, 0, 5)).toBe(true);
    expect(deleteSelectedBlocksMock).toHaveBeenCalledTimes(1);
    expect(deleteSelectedBlocksMock.mock.calls[0]?.[0]).toBe(view);
    expect(deleteSelectedBlocksMock.mock.calls[0]?.[1]).toEqual([
      { from: 0, to: 5 },
      { from: 5, to: 11 },
    ]);
    expect(typeof deleteSelectedBlocksMock.mock.calls[0]?.[2]).toBe('function');
  });
});
