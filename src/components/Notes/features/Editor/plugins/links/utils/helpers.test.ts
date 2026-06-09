import { describe, expect, it, vi } from 'vitest';
import {
  MAX_LINK_MARK_RANGE_SCAN_CHARS,
  resolveLinkMarkRangeAtPos,
} from './helpers';

function createStateWithLinkRange(linkStart: number, linkEnd: number, docSize: number) {
  const linkMarkType = {
    isInSet: vi.fn((marks: Array<{ type: { name: string } }>) =>
      marks.some((mark) => mark.type.name === 'link') ? { type: { name: 'link' } } : null
    ),
  };
  const resolve = vi.fn((pos: number) => {
    const hasLink = pos >= linkStart && pos < linkEnd;
    const marks = hasLink ? [{ type: { name: 'link' } }] : [];
    return {
      marks: () => marks,
      nodeAfter: hasLink ? { marks } : null,
    };
  });

  return {
    doc: {
      content: { size: docSize },
      resolve,
    },
    schema: {
      marks: {
        link: linkMarkType,
      },
    },
  };
}

describe('link helpers', () => {
  it('resolves bounded link mark ranges around a position', () => {
    const state = createStateWithLinkRange(2, 8, 12);

    expect(resolveLinkMarkRangeAtPos(state as never, 4)).toMatchObject({
      start: 2,
      end: 8,
    });
  });

  it('returns null for link mark ranges that exceed the scan budget', () => {
    const state = createStateWithLinkRange(0, MAX_LINK_MARK_RANGE_SCAN_CHARS + 8, MAX_LINK_MARK_RANGE_SCAN_CHARS + 8);

    expect(resolveLinkMarkRangeAtPos(state as never, 0)).toBeNull();
    expect(state.doc.resolve).toHaveBeenCalledTimes(MAX_LINK_MARK_RANGE_SCAN_CHARS + 2);
  });
});
