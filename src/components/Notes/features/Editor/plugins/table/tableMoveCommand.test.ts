import { describe, expect, it, vi } from 'vitest';

import {
  createPreparedMoveState,
  mapPreviousSelection,
  runPreparedMoveCommand,
  wrapDispatchWithSelectionRestore,
} from '../../../../../../../vendor/milkdown/packages/plugins/preset-gfm/src/node/table/move-command';

function createTransaction() {
  return {
    doc: { kind: 'doc' },
    mapping: { kind: 'mapping' },
    selection: { kind: 'selection' },
    setSelection: vi.fn(function (this: { selection: unknown }, selection: unknown) {
      this.selection = selection;
      return this;
    }),
  };
}

describe('table move command helpers', () => {
  it('creates a prepared state from the temporary row or column selection', () => {
    const state = {
      selection: {
        map: undefined as ((doc: unknown, mapping: unknown) => unknown) | undefined,
      },
      tr: createTransaction(),
    };

    const preparedState = createPreparedMoveState(state, (tr) => ({
      ...tr,
      selection: { kind: 'prepared-selection' },
    }));

    expect(preparedState).toEqual({
      ...state,
      selection: { kind: 'prepared-selection' },
      tr: expect.objectContaining({
        selection: { kind: 'prepared-selection' },
      }),
    });
  });

  it('maps the previous selection back through the move transaction when restoration is enabled', () => {
    const mappedSelection = { kind: 'mapped-selection' };
    const previousSelection = {
      map: vi.fn(() => mappedSelection),
    };
    const state = {
      selection: previousSelection,
      tr: createTransaction(),
    };
    const dispatch = vi.fn();
    let dispatchedTr: ReturnType<typeof createTransaction> | undefined;

    const result = runPreparedMoveCommand(state, dispatch, undefined, {
      prepareSelection: (tr) => ({
        ...tr,
        selection: { kind: 'prepared-selection' },
      }),
      createCommand: () => (preparedState, wrappedDispatch) => {
        expect(preparedState.selection).toEqual({
          kind: 'prepared-selection',
        });

        const tr = createTransaction();
        wrappedDispatch?.(tr);
        dispatchedTr = tr;
        return true;
      },
      restoreSelection: true,
    });

    expect(result).toBe(true);
    expect(previousSelection.map).toHaveBeenCalledWith(
      dispatchedTr?.doc,
      dispatchedTr?.mapping,
    );
    expect(dispatchedTr?.setSelection).toHaveBeenCalledWith(mappedSelection);
    expect(dispatchedTr?.selection).toBe(mappedSelection);
    expect(dispatch).toHaveBeenCalledWith(dispatchedTr);
  });

  it('leaves the command selection untouched when restoration is disabled', () => {
    const mappedSelection = { kind: 'mapped-selection' };
    const previousSelection = {
      map: vi.fn(() => mappedSelection),
    };
    const tr = createTransaction();
    const dispatch = vi.fn();
    const wrappedDispatch = wrapDispatchWithSelectionRestore(
      previousSelection,
      dispatch,
      false,
    );

    wrappedDispatch?.(tr);

    expect(previousSelection.map).not.toHaveBeenCalled();
    expect(tr.setSelection).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith(tr);
  });

  it('returns null when the previous selection cannot be mapped', () => {
    const previousSelection = {
      map: vi.fn(() => {
        throw new Error('cannot map');
      }),
    };

    expect(mapPreviousSelection(previousSelection, createTransaction())).toBeNull();
  });
});
