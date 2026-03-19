import { getCurrentInstance, onMounted, onUnmounted } from 'vue'

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
const EDGE_CREATE_ACTIVATION_THRESHOLD = 6

interface EdgeCreateSession extends DragSessionState {
  axis: EdgeCreateAxis
  startCoord: number
  lastCoord: number
  lastCommitCoord: number
  edgeCoord: number
  anchors: EdgeCreateAnchors
  pendingAnchorSync: boolean
  isActive: boolean
}

interface EdgeCreateRuntime {
  refs: Refs
  getKey: () => number | undefined
  isEditable: () => boolean
  onAddRow: () => void
  onAddCol: () => void
  onShrinkRow: () => void
  onShrinkCol: () => void
  canShrinkRow: () => boolean
  canShrinkCol: () => boolean
}

let activeSession: EdgeCreateSession | null = null
let activeRuntime: EdgeCreateRuntime | null = null

function getRowCount(refs: Refs) {
  const rows = refs.contentWrapperRef.value?.querySelectorAll('tr') ?? []
  return rows.length
}

function getColCount(refs: Refs) {
  const cols = refs.contentWrapperRef.value?.querySelector('tr')?.children ?? []
  return cols.length
}

function syncBottomEdgeIndex(refs: Refs): boolean {
  const rowCount = getRowCount(refs)
  if (rowCount === 0) return false
  refs.lineHoverIndex.value = [rowCount, 0]
  return true
}

function syncRightEdgeIndex(refs: Refs): boolean {
  const colCount = getColCount(refs)
  if (colCount === 0) return false
  refs.lineHoverIndex.value = [0, colCount]
  return true
}

function getCurrentEdgeCoord(
  runtime: EdgeCreateRuntime,
  axis: EdgeCreateAxis
): number | null {
  const content = runtime.refs.contentWrapperRef.value
  if (!content) return null

  const rect = content.getBoundingClientRect()
  return axis === 'row' ? rect.bottom : rect.right
}

function clearSession(current: EdgeCreateSession | null = activeSession) {
  if (!current) return

  unbindDragSessionDocumentListeners(current.source, handleMove, handleEnd)
  releaseTableDragCursor()
  releaseDragSessionPointer(current)

  if (activeSession === current) {
    activeSession = null
  }
}

function handleMove(e: DragSessionEvent) {
  const session = activeSession
  const runtime = activeRuntime
  if (!session || !runtime) return
  if (!canHandleDragSessionEvent(session, e)) return

  suppressTableDragSelection()

  const currentCoord = session.axis === 'row' ? e.clientY : e.clientX

  if (!session.isActive) {
    session.lastCoord = currentCoord

    if (
      Math.abs(currentCoord - session.startCoord) <
      EDGE_CREATE_ACTIVATION_THRESHOLD
    ) {
      return
    }

    const edgeCoord = getCurrentEdgeCoord(runtime, session.axis)
    if (edgeCoord == null) return

    session.isActive = true
    session.lastCommitCoord = currentCoord
    session.anchors = createEdgeCreateAnchors(
      currentCoord,
      edgeCoord,
      EDGE_CREATE_THRESHOLD
    )
    session.pendingAnchorSync = false
    e.preventDefault()
    e.stopPropagation()
    return
  }

  if (session.pendingAnchorSync) {
    const edgeCoord = getCurrentEdgeCoord(runtime, session.axis)
    if (edgeCoord == null) return
    if (edgeCoord === session.edgeCoord) {
      session.lastCoord = currentCoord
      return
    }
    session.edgeCoord = edgeCoord
    session.anchors = createEdgeCreateAnchors(
      session.lastCommitCoord,
      edgeCoord,
      EDGE_CREATE_THRESHOLD
    )
    session.pendingAnchorSync = false
  }

  const action = resolveEdgeCreateAction({
    currentCoord,
    previousCoord: session.lastCoord,
    anchors: session.anchors,
  })

  session.lastCoord = currentCoord

  if (action === 'expand') {
    if (session.axis === 'row') {
      if (!syncBottomEdgeIndex(runtime.refs)) return
      runtime.onAddRow()
    } else {
      if (!syncRightEdgeIndex(runtime.refs)) return
      runtime.onAddCol()
    }

    session.lastCommitCoord = currentCoord
    session.pendingAnchorSync = true
    e.preventDefault()
    e.stopPropagation()
    return
  }

  if (action !== 'shrink') return

  if (session.axis === 'row') {
    if (!runtime.canShrinkRow()) return
    syncBottomEdgeIndex(runtime.refs)
    runtime.onShrinkRow()
  } else {
    if (!runtime.canShrinkCol()) return
    syncRightEdgeIndex(runtime.refs)
    runtime.onShrinkCol()
  }

  session.lastCommitCoord = currentCoord
  session.pendingAnchorSync = true
  e.preventDefault()
  e.stopPropagation()
}

function handleEnd(e: DragSessionEvent) {
  const session = activeSession
  if (!session) return
  if (!canHandleDragSessionEvent(session, e)) return

  clearSession(session)
  e.preventDefault()
  e.stopPropagation()
}

export function useEdgeCreateHandlers(
  refs: Refs,
  isEditable: () => boolean,
  onAddRow: () => void,
  onAddCol: () => void,
  onShrinkRow: () => void,
  onShrinkCol: () => void,
  canShrinkRow: () => boolean,
  canShrinkCol: () => boolean,
  getKey: () => number | undefined
) {
  const runtime: EdgeCreateRuntime = {
    refs,
    getKey,
    isEditable,
    onAddRow,
    onAddCol,
    onShrinkRow,
    onShrinkCol,
    canShrinkRow,
    canShrinkCol,
  }

  if (getCurrentInstance()) {
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
  }

  const startSession =
    (axis: EdgeCreateAxis, source: DragSessionSource) => (e: DragSessionEvent) => {
      if (activeSession) return
      if (!runtime.isEditable()) return
      if (e.button !== 0) return
      if (!(e.currentTarget instanceof HTMLElement)) return

      const canStart =
        axis === 'row'
          ? syncBottomEdgeIndex(runtime.refs)
          : syncRightEdgeIndex(runtime.refs)
      if (!canStart) return

      const startCoord = axis === 'row' ? e.clientY : e.clientX
      const edgeCoord = getCurrentEdgeCoord(runtime, axis)
      if (edgeCoord == null) return

      activeRuntime = runtime
      activeSession = {
        axis,
        source,
        pointerId: 'pointerId' in e ? e.pointerId : null,
        startCoord,
        lastCoord: startCoord,
        lastCommitCoord: startCoord,
        edgeCoord,
        anchors: createEdgeCreateAnchors(
          startCoord,
          edgeCoord,
          EDGE_CREATE_THRESHOLD
        ),
        pendingAnchorSync: false,
        isActive: false,
        target: e.currentTarget,
        key: getDragRuntimeKey(runtime.getKey),
      }

      captureDragSessionPointer(source, e, e.currentTarget)

      acquireTableDragCursor(axis === 'row' ? 'row-resize' : 'col-resize')
      bindDragSessionDocumentListeners(source, handleMove, handleEnd)
      e.preventDefault()
      e.stopPropagation()
    }

  return {
    startRowEdgeCreate: startSession('row', 'pointer'),
    startColEdgeCreate: startSession('col', 'pointer'),
    startRowEdgeCreateMouse: startSession('row', 'mouse'),
    startColEdgeCreateMouse: startSession('col', 'mouse'),
    prepareRowEdgeCreate: () =>
      runtime.isEditable() && syncBottomEdgeIndex(runtime.refs),
    prepareColEdgeCreate: () =>
      runtime.isEditable() && syncRightEdgeIndex(runtime.refs),
  }
}
