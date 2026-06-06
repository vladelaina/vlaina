import { describe, expect, it, vi } from 'vitest';
import {
  findAdjacentTableCellPos,
  findFirstTableBodyCellPos,
} from './tableKeyboardPlugin';
import type { BoundedProseScanNode } from '../shared/boundedProseNodeScan';

function node(type: string, children: BoundedProseScanNode[] = [], nodeSize = 2): BoundedProseScanNode {
  return {
    attrs: {},
    child: (index) => children[index],
    childCount: children.length,
    content: {
      size: children.reduce((size, child) => size + (child.nodeSize ?? 1), 0),
    },
    nodeSize,
    type: { name: type },
  };
}

function doc(children: BoundedProseScanNode[]): BoundedProseScanNode {
  return {
    child: (index) => children[index],
    childCount: children.length,
    type: { name: 'doc' },
  };
}

describe('table keyboard scan helpers', () => {
  it('stops scanning after finding the first table body cell', () => {
    const targetCell = node('table_cell');
    const unusedCell = node('table_cell');
    const document = doc([
      node('paragraph'),
      targetCell,
      unusedCell,
    ]);
    const child = vi.spyOn(document, 'child');

    expect(findFirstTableBodyCellPos(document as never, 2)).toBe(4);
    expect(child).toHaveBeenCalledTimes(2);
  });

  it('finds the next table cell without reading later cells', () => {
    const cells = [
      node('table_header'),
      node('table_cell'),
      node('table_cell'),
      node('table_cell'),
    ];
    const table = doc(cells);
    const child = vi.spyOn(table, 'child').mockImplementation((index: number) => {
      if (index > 2) {
        throw new Error('Next-cell lookup should stop before later cells');
      }
      return cells[index];
    });

    expect(findAdjacentTableCellPos(table as never, 10, 12, 1)).toBe(14);
    expect(child).toHaveBeenCalledTimes(3);
  });

  it('finds the previous table cell without materializing all cells', () => {
    const cells = [
      node('table_header'),
      node('table_cell'),
      node('table_cell'),
      node('table_cell'),
    ];
    const table = doc(cells);
    const child = vi.spyOn(table, 'child').mockImplementation((index: number) => {
      if (index > 2) {
        throw new Error('Previous-cell lookup should stop once the current cell is found');
      }
      return cells[index];
    });

    expect(findAdjacentTableCellPos(table as never, 10, 14, -1)).toBe(12);
    expect(child).toHaveBeenCalledTimes(3);
  });
});
