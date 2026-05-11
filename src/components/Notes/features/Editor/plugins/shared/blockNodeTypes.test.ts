import { describe, expect, it } from 'vitest';
import {
  ATOMIC_TEXT_SELECTION_OVERLAY_NODE_NAMES,
  COMPLEX_LIST_ITEM_CHILD_NODE_NAMES,
  LIST_CONTAINER_NODE_NAMES,
  NAVIGABLE_ATOMIC_BLOCK_NODE_NAMES,
  STRUCTURAL_EMPTY_PARAGRAPH_DELETE_BLOCK_NAMES,
  TEXT_ONLY_BLOCK_EDGE_NODE_NAMES,
} from './blockNodeTypes';

describe('blockNodeTypes', () => {
  it('keeps complex list children aligned with block-level atomic overlay nodes', () => {
    for (const name of ATOMIC_TEXT_SELECTION_OVERLAY_NODE_NAMES) {
      if (name === 'math_inline') continue;
      expect(COMPLEX_LIST_ITEM_CHILD_NODE_NAMES.has(name)).toBe(true);
    }
  });

  it('keeps list containers included in structural empty paragraph deletion', () => {
    for (const name of LIST_CONTAINER_NODE_NAMES) {
      expect(STRUCTURAL_EMPTY_PARAGRAPH_DELETE_BLOCK_NAMES.has(name)).toBe(true);
    }
  });

  it('keeps special math and diagram edge-click behavior aligned with keyboard navigation', () => {
    expect([...TEXT_ONLY_BLOCK_EDGE_NODE_NAMES].sort()).toEqual(
      [...NAVIGABLE_ATOMIC_BLOCK_NODE_NAMES].sort()
    );
  });
});
