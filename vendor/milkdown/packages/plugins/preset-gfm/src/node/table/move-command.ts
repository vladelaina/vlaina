type MappableSelection = {
  map?: (doc: unknown, mapping: unknown) => unknown
}

type SelectionTransaction = {
  doc: unknown
  mapping: unknown
  selection: unknown
  setSelection?: (selection: unknown) => unknown
}

type SelectionState<TTr extends SelectionTransaction = SelectionTransaction> = {
  tr: TTr
  selection: MappableSelection
}

type CommandDispatch<TTr extends SelectionTransaction> = (tr: TTr) => void

type PreparedCommand<
  TState extends SelectionState<TTr>,
  TTr extends SelectionTransaction,
  TView,
> = (
  state: TState,
  dispatch?: CommandDispatch<TTr>,
  view?: TView
) => boolean

export function mapPreviousSelection(
  previousSelection: MappableSelection,
  tr: SelectionTransaction
) {
  try {
    return previousSelection?.map?.(tr.doc, tr.mapping) ?? null
  } catch {
    return null
  }
}

export function createPreparedMoveState<
  TState extends SelectionState<TTr>,
  TTr extends SelectionTransaction,
>(state: TState, prepareSelection: (tr: TTr) => TTr): TState {
  const preparedTr = prepareSelection(state.tr)
  return {
    ...state,
    tr: preparedTr,
    selection: preparedTr.selection,
  }
}

export function wrapDispatchWithSelectionRestore<
  TTr extends SelectionTransaction,
>(
  previousSelection: MappableSelection,
  dispatch: CommandDispatch<TTr> | undefined,
  shouldRestoreSelection: boolean
) {
  if (!dispatch) return undefined

  return (tr: TTr) => {
    if (shouldRestoreSelection) {
      const mappedSelection = mapPreviousSelection(previousSelection, tr)
      if (mappedSelection && typeof tr.setSelection === 'function') {
        tr.setSelection(mappedSelection)
      }
    }

    dispatch(tr)
  }
}

export function runPreparedMoveCommand<
  TState extends SelectionState<TTr>,
  TTr extends SelectionTransaction,
  TView,
>(
  state: TState,
  dispatch: CommandDispatch<TTr> | undefined,
  view: TView | undefined,
  options: {
    prepareSelection: (tr: TTr) => TTr
    createCommand: () => PreparedCommand<TState, TTr, TView>
    restoreSelection?: boolean
  }
) {
  const preparedState = createPreparedMoveState(
    state,
    options.prepareSelection
  )
  const wrappedDispatch = wrapDispatchWithSelectionRestore(
    state.selection,
    dispatch,
    options.restoreSelection ?? true
  )

  return options.createCommand()(preparedState, wrappedDispatch, view)
}
