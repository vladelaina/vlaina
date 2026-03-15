import { onMounted, onUnmounted } from 'vue'

import type { Refs } from './types'
import {
  bindDragSessionDocumentListeners,
  canHandleDragSessionEvent,
  captureDragSessionPointer,
  type DragSessionEvent,
  getDragRuntimeKey,
  releaseDragSessionPointer,
  type DragSessionSource,
  type DragSessionState,
  unbindDragSessionDocumentListeners,
} from './drag-session'
import {
  acquireTableDragCursor,
  releaseTableDragCursor,
  suppressTableDragSelection,
} from './drag-cursor'
import {
  createEdgeCreateAnchors,
  resolveEdgeCreateAction,
  type EdgeCreateAnchors,
  type EdgeCreateAxis,
} from './edge-create-state'

const EDGE_CREATE_THRESHOLD = 18

interface CornerAxisChannel {
  startCoord: number
  lastCoord: number
  lastCommitCoord: number
  anchors: EdgeCreateAnchors
  pendingAnchorSync: boolean
}

interface CornerCreateSession extends DragSessionState {
  row: CornerAxisChannel
  col: CornerAxisChannel
}

interface CornerCreateRuntime {
  refs: Refs
  getKey: () => number | undefined
  onAddRow: () => void
  onAddCol: () => void
  onShrinkRow: () => void
  onShrinkCol: () => void
  canShrinkRow: () => boolean
  canShrinkCol: () => boolean
}

let activeSession: CornerCreateSession | null = null
let activeRuntime: CornerCreateRuntime | null = null

function getCurrentEdgeCoord(
  runtime: CornerCreateRuntime,
  axis: EdgeCreateAxis
): number | null {
  const content = runtime.refs.contentWrapperRef.value
  if (!content) return null

  const rect = content.getBoundingClientRect()
  return axis === 'row' ? rect.bottom : rect.right
}

function getCurrentPointerCoord(event: DragSessionEvent, axis: EdgeCreateAxis) {
  return axis === 'row' ? event.clientY : event.clientX
}

function getChannel(
  session: CornerCreateSession,
  axis: EdgeCreateAxis
): CornerAxisChannel {
  return axis === 'row' ? session.row : session.col
}

function clearSession(current: CornerCreateSession | null = activeSession) {
  if (!current) return

  unbindDragSessionDocumentListeners(current.source, handleMove, handleEnd)
  releaseTableDragCursor()
  releaseDragSessionPointer(current)

  if (activeSession === current) {
    activeSession = null
  }
}

function syncAxisIndex(refs: Refs, axis: EdgeCreateAxis): boolean {
  if (axis === 'row') {
    const rowCount = refs.contentWrapperRef.value?.querySelectorAll('tr').length ?? 0
    if (rowCount === 0) return false
    refs.lineHoverIndex.value = [rowCount, 0]
    return true
  }

  const colCount =
    refs.contentWrapperRef.value?.querySelector('tr')?.children.length ?? 0
  if (colCount === 0) return false
  refs.lineHoverIndex.value = [0, colCount]
  return true
}

function triggerAxis(
  runtime: CornerCreateRuntime,
  axis: EdgeCreateAxis,
  action: 'expand' | 'shrink'
) {
  if (action === 'expand') {
    if (!syncAxisIndex(runtime.refs, axis)) return false
    if (axis === 'row') runtime.onAddRow()
    else runtime.onAddCol()
    return true
  }

  if (axis === 'row') {
    if (!runtime.canShrinkRow()) return false
    syncAxisIndex(runtime.refs, axis)
    runtime.onShrinkRow()
    return true
  }

  if (!runtime.canShrinkCol()) return false
  syncAxisIndex(runtime.refs, axis)
  runtime.onShrinkCol()
  return true
}

function updateAxis(
  runtime: CornerCreateRuntime,
  session: CornerCreateSession,
  axis: EdgeCreateAxis,
  event: DragSessionEvent
) {
  const channel = getChannel(session, axis)
  const currentCoord = getCurrentPointerCoord(event, axis)
  const delta = currentCoord - channel.startCoord

  if (channel.pendingAnchorSync) {
    const edgeCoord = getCurrentEdgeCoord(runtime, axis)
    if (edgeCoord == null) return
    channel.anchors = createEdgeCreateAnchors(
      channel.lastCommitCoord,
      edgeCoord,
      EDGE_CREATE_THRESHOLD
    )
    channel.pendingAnchorSync = false
  }

  const action = resolveEdgeCreateAction({
    currentCoord,
    previousCoord: channel.lastCoord,
    anchors: channel.anchors,
  })

  channel.lastCoord = currentCoord
  if (!action) return

  const triggered = triggerAxis(runtime, axis, action)
  if (!triggered) return

  channel.lastCommitCoord = currentCoord
  channel.pendingAnchorSync = true
}

function handleMove(event: DragSessionEvent) {
  const session = activeSession
  const runtime = activeRuntime
  if (!session || !runtime) return
  if (!canHandleDragSessionEvent(session, event)) return

  suppressTableDragSelection()

  updateAxis(runtime, session, 'row', event)
  updateAxis(runtime, session, 'col', event)

  event.preventDefault()
  event.stopPropagation()
}

function handleEnd(event: DragSessionEvent) {
  const session = activeSession
  if (!session) return
  if (!canHandleDragSessionEvent(session, event)) return

  clearSession(session)
  event.preventDefault()
  event.stopPropagation()
}

export function useCornerCreateHandlers(
  refs: Refs,
  onAddRow: () => void,
  onAddCol: () => void,
  onShrinkRow: () => void,
  onShrinkCol: () => void,
  canShrinkRow: () => boolean,
  canShrinkCol: () => boolean,
  getKey: () => number | undefined
) {
  const runtime: CornerCreateRuntime = {
    refs,
    getKey,
    onAddRow,
    onAddCol,
    onShrinkRow,
    onShrinkCol,
    canShrinkRow,
    canShrinkCol,
  }

  onMounted(() => {
    if (!activeSession) return
    if (activeSession.key !== getDragRuntimeKey(runtime.getKey)) return
    activeRuntime = runtime
  })

  onUnmounted(() => {
    if (activeRuntime === runtime && !activeSession) {
      activeRuntime = null
    }
  })

  const prepareCornerCreate = () => {
    return syncAxisIndex(runtime.refs, 'row') && syncAxisIndex(runtime.refs, 'col')
  }

  const startSession =
    (source: DragSessionSource) => (event: DragSessionEvent) => {
      if (activeSession) return
      if (event.button !== 0) return
      if (!(event.currentTarget instanceof HTMLElement)) return

      const canStart = prepareCornerCreate()
      if (!canStart) return

      const rowCoord = getCurrentPointerCoord(event, 'row')
      const colCoord = getCurrentPointerCoord(event, 'col')
      const rowEdgeCoord = getCurrentEdgeCoord(runtime, 'row')
      const colEdgeCoord = getCurrentEdgeCoord(runtime, 'col')
      if (rowEdgeCoord == null || colEdgeCoord == null) return

      activeRuntime = runtime
      activeSession = {
        source,
        pointerId: 'pointerId' in event ? event.pointerId : null,
        target: event.currentTarget,
        key: getDragRuntimeKey(runtime.getKey),
        row: {
          startCoord: rowCoord,
          lastCoord: rowCoord,
          lastCommitCoord: rowCoord,
          anchors: createEdgeCreateAnchors(
            rowCoord,
            rowEdgeCoord,
            EDGE_CREATE_THRESHOLD
          ),
          pendingAnchorSync: false,
        },
        col: {
          startCoord: colCoord,
          lastCoord: colCoord,
          lastCommitCoord: colCoord,
          anchors: createEdgeCreateAnchors(
            colCoord,
            colEdgeCoord,
            EDGE_CREATE_THRESHOLD
          ),
          pendingAnchorSync: false,
        },
      }

      captureDragSessionPointer(source, event, event.currentTarget)

      acquireTableDragCursor('nwse-resize')
      bindDragSessionDocumentListeners(source, handleMove, handleEnd)
      event.preventDefault()
      event.stopPropagation()
    }

  return {
    prepareCornerCreate,
    startCornerCreate: startSession('pointer'),
    startCornerCreateMouse: startSession('mouse'),
  }
}
