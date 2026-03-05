import { describe, expect, it, vi } from 'vitest';
import type { EditorView } from '@milkdown/kit/prose/view';
import { shouldMoveSelectionToTitle } from './titleNavigationUtils';

function createMockView(options: {
  empty: boolean;
  topLevelIndex: number;
  endOfTextblockUp: boolean;
}): EditorView {
  return {
    state: {
      selection: {
        empty: options.empty,
        $from: {
          index: vi.fn(() => options.topLevelIndex),
        },
      },
    },
    endOfTextblock: vi.fn((dir: 'up' | 'down' | 'left' | 'right') => {
      return dir === 'up' ? options.endOfTextblockUp : false;
    }),
  } as unknown as EditorView;
}

describe('shouldMoveSelectionToTitle', () => {
  it('returns true only when caret is at top block and cannot move up further', () => {
    const view = createMockView({
      empty: true,
      topLevelIndex: 0,
      endOfTextblockUp: true,
    });

    expect(shouldMoveSelectionToTitle(view)).toBe(true);
  });

  it('returns false for non-empty selection', () => {
    const view = createMockView({
      empty: false,
      topLevelIndex: 0,
      endOfTextblockUp: true,
    });

    expect(shouldMoveSelectionToTitle(view)).toBe(false);
  });

  it('returns false when selection is not in first top-level block', () => {
    const view = createMockView({
      empty: true,
      topLevelIndex: 1,
      endOfTextblockUp: true,
    });

    expect(shouldMoveSelectionToTitle(view)).toBe(false);
  });

  it('returns false when caret can still move up inside current text block', () => {
    const view = createMockView({
      empty: true,
      topLevelIndex: 0,
      endOfTextblockUp: false,
    });

    expect(shouldMoveSelectionToTitle(view)).toBe(false);
  });
});
