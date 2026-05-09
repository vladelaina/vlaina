import { NodeSelection, TextSelection } from '@milkdown/kit/prose/state';
import { describe, expect, it } from 'vitest';
import { shouldClearBlockSelectionForTransaction } from './blankAreaDragBoxPlugin';

describe('shouldClearBlockSelectionForTransaction', () => {
  it('clears block selection when the editor moves to a text selection', () => {
    const selection = Object.create(TextSelection.prototype);

    expect(
      shouldClearBlockSelectionForTransaction(
        { selection, selectionSet: true } as never,
        { selectedBlocks: [{ from: 1, to: 5 }] }
      )
    ).toBe(true);
  });

  it('does not clear block selection for node selections or unrelated transactions', () => {
    const nodeSelection = Object.create(NodeSelection.prototype);
    const pluginState = { selectedBlocks: [{ from: 1, to: 5 }] };

    expect(
      shouldClearBlockSelectionForTransaction(
        { selection: nodeSelection, selectionSet: true } as never,
        pluginState
      )
    ).toBe(false);

    expect(
      shouldClearBlockSelectionForTransaction(
        { selection: Object.create(TextSelection.prototype), selectionSet: false } as never,
        pluginState
      )
    ).toBe(false);

    expect(
      shouldClearBlockSelectionForTransaction(
        { selection: Object.create(TextSelection.prototype), selectionSet: true } as never,
        { selectedBlocks: [] }
      )
    ).toBe(false);
  });
});
