import { describe, expect, it } from 'vitest';

import { findNearestTableTextSelectionPos } from '../../../../../../../vendor/milkdown/packages/prose/src/tables';

describe('deleteColumn selection normalization', () => {
  it('prefers the nearest remaining table cell textblock after a deleted column', () => {
    const tr = {
      mapping: {
        map: (pos: number) => pos,
      },
      doc: {
        nodeAt: (pos: number) =>
          pos === 20
            ? {
                nodeSize: 6,
              }
            : pos === 40
              ? {
                  nodeSize: 6,
                }
              : null,
        content: {
          size: 100,
        },
        resolve: () => ({
          depth: 1,
          before: () => 10,
          node: (depth: number) => ({
            descendants: (callback: (node: any, pos: number) => void) => {
              callback({ type: { name: 'table_cell' } }, 9);
              callback({ type: { name: 'table_cell' } }, 29);
            },
            type: {
              name: depth === 1 ? 'table' : 'doc',
            },
          }),
        }),
        nodesBetween: (
          from: number,
          _to: number,
          callback: (node: any, pos: number) => boolean | void,
        ) => {
          if (from === 20) {
            callback({ isTextblock: false }, 20);
            callback({ isTextblock: true }, 21);
          }
        },
      },
    };

    expect(findNearestTableTextSelectionPos(tr, 24)).toBe(22);
  });

  it('returns null when no remaining table textblock can be resolved', () => {
    const tr = {
      mapping: {
        map: (pos: number) => pos,
      },
      doc: {
        content: {
          size: 100,
        },
        nodeAt: () => null,
        nodesBetween: () => {},
        resolve: () => ({
          depth: 0,
          nodeAfter: null,
          nodeBefore: null,
        }),
      },
    };

    expect(findNearestTableTextSelectionPos(tr, 24)).toBeNull();
  });
});
