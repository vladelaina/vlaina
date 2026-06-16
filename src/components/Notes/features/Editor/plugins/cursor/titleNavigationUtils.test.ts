import { describe, expect, it, vi } from 'vitest';
import type { EditorView } from '@milkdown/kit/prose/view';
import { shouldMoveSelectionToTitle } from './titleNavigationUtils';

function createMockView(options: {
  empty: boolean;
  topLevelIndex: number;
  deepestIndex?: number;
  endOfTextblockUp: boolean;
  depth?: number;
  lineStartTop?: number;
  caretTop?: number;
}): EditorView {
  return {
    state: {
      selection: {
        empty: options.empty,
        from: 12,
        $from: {
          index: vi.fn((level: number) => (
            level === 0 ? options.topLevelIndex : options.deepestIndex ?? options.topLevelIndex
          )),
          depth: options.depth ?? 1,
          node: vi.fn((level: number) => ({
            isTextblock: level === (options.depth ?? 1),
          })),
          start: vi.fn(() => 1),
        },
      },
    },
    endOfTextblock: vi.fn((dir: 'up' | 'down' | 'left' | 'right') => {
      return dir === 'up' ? options.endOfTextblockUp : false;
    }),
    coordsAtPos: vi.fn((pos: number) => ({
      left: 0,
      right: 0,
      top: pos === 1 ? options.lineStartTop ?? 100 : options.caretTop ?? 100,
      bottom: pos === 1 ? (options.lineStartTop ?? 100) + 18 : (options.caretTop ?? 100) + 18,
    })),
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
      lineStartTop: 100,
      caretTop: 126,
    });

    expect(shouldMoveSelectionToTitle(view)).toBe(false);
  });

  it('falls back to caret geometry when the browser does not report the first visual line as an up boundary', () => {
    const view = createMockView({
      empty: true,
      topLevelIndex: 0,
      endOfTextblockUp: false,
      lineStartTop: 100,
      caretTop: 102,
    });

    expect(shouldMoveSelectionToTitle(view)).toBe(true);
  });

  it('still treats the text end of the first text block as the first document path', () => {
    const view = createMockView({
      empty: true,
      topLevelIndex: 0,
      deepestIndex: 1,
      endOfTextblockUp: false,
      lineStartTop: 100,
      caretTop: 102,
    });

    expect(shouldMoveSelectionToTitle(view)).toBe(true);
  });

  it('does not use the geometry fallback for wrapped continuation lines', () => {
    const view = createMockView({
      empty: true,
      topLevelIndex: 0,
      endOfTextblockUp: false,
      lineStartTop: 100,
      caretTop: 124,
    });

    expect(shouldMoveSelectionToTitle(view)).toBe(false);
  });
});
