import { describe, expect, it, vi } from 'vitest';

type MappableSelection = {
  map?: (doc: unknown, mapping: unknown) => unknown;
};

type SelectionTransaction = {
  doc: unknown;
  mapping: unknown;
  selection: unknown;
  setSelection?: (selection: unknown) => unknown;
};

type SelectionState<TTr extends SelectionTransaction = SelectionTransaction> = {
  tr: TTr;
  selection: MappableSelection;
};

type CommandDispatch<TTr extends SelectionTransaction> = (tr: TTr) => void;

type PreparedCommand<
  TState extends SelectionState<TTr>,
  TTr extends SelectionTransaction,
  TView,
> = (
  state: TState,
  dispatch?: CommandDispatch<TTr>,
  view?: TView
) => boolean;

function mapPreviousSelection(
  previousSelection: MappableSelection,
  tr: SelectionTransaction
) {
  try {
    return previousSelection?.map?.(tr.doc, tr.mapping) ?? null;
  } catch {
    return null;
  }
}

function createPreparedMoveState<
  TState extends SelectionState<TTr>,
  TTr extends SelectionTransaction,
>(state: TState, prepareSelection: (tr: TTr) => TTr): TState {
  const preparedTr = prepareSelection(state.tr);
  return {
    ...state,
    tr: preparedTr,
    selection: preparedTr.selection,
  };
}

function wrapDispatchWithSelectionRestore<TTr extends SelectionTransaction>(
  previousSelection: MappableSelection,
  dispatch: CommandDispatch<TTr> | undefined,
  shouldRestoreSelection: boolean
) {
  if (!dispatch) return undefined;

  return (tr: TTr) => {
    if (shouldRestoreSelection) {
      const mappedSelection = mapPreviousSelection(previousSelection, tr);
      if (mappedSelection && typeof tr.setSelection === 'function') {
        tr.setSelection(mappedSelection);
      }
    }

    dispatch(tr);
  };
}

function runPreparedMoveCommand<
  TState extends SelectionState<TTr>,
  TTr extends SelectionTransaction,
  TView,
>(
  state: TState,
  dispatch: CommandDispatch<TTr> | undefined,
  view: TView | undefined,
  options: {
    prepareSelection: (tr: TTr) => TTr;
    createCommand: () => PreparedCommand<TState, TTr, TView>;
    restoreSelection?: boolean;
  }
) {
  const preparedState = createPreparedMoveState(
    state,
    options.prepareSelection
  );
  const wrappedDispatch = wrapDispatchWithSelectionRestore(
    state.selection,
    dispatch,
    options.restoreSelection ?? true
  );

  return options.createCommand()(preparedState, wrappedDispatch, view);
}

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
