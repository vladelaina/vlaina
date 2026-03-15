export type DragSessionSource = 'pointer' | 'mouse'
export type DragSessionEvent = PointerEvent | MouseEvent

export interface DragSessionState {
  source: DragSessionSource
  pointerId: number | null
  target: HTMLElement
  key: number | undefined
}

export function getDragRuntimeKey(getKey: () => number | undefined) {
  try {
    return getKey()
  } catch {
    return undefined
  }
}

export function canHandleDragSessionEvent(
  session: Pick<DragSessionState, 'source' | 'pointerId'>,
  event: DragSessionEvent
) {
  if (
    session.source === 'pointer' &&
    'pointerId' in event &&
    session.pointerId !== event.pointerId
  ) {
    return false
  }

  if (session.source === 'pointer' && !('pointerId' in event)) return false
  if (session.source === 'mouse' && 'pointerId' in event) return false

  return true
}

export function bindDragSessionDocumentListeners(
  source: DragSessionSource,
  onMove: (event: DragSessionEvent) => void,
  onEnd: (event: DragSessionEvent) => void
) {
  if (source === 'pointer') {
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onEnd)
    document.addEventListener('pointercancel', onEnd)
    return
  }

  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onEnd)
}

export function unbindDragSessionDocumentListeners(
  source: DragSessionSource,
  onMove: (event: DragSessionEvent) => void,
  onEnd: (event: DragSessionEvent) => void
) {
  if (source === 'pointer') {
    document.removeEventListener('pointermove', onMove)
    document.removeEventListener('pointerup', onEnd)
    document.removeEventListener('pointercancel', onEnd)
    return
  }

  document.removeEventListener('mousemove', onMove)
  document.removeEventListener('mouseup', onEnd)
}

export function captureDragSessionPointer(
  source: DragSessionSource,
  event: DragSessionEvent,
  target: HTMLElement
) {
  if (source !== 'pointer' || !('pointerId' in event)) return
  target.setPointerCapture(event.pointerId)
}

export function releaseDragSessionPointer(
  session: Pick<DragSessionState, 'pointerId' | 'target'>
) {
  try {
    if (session.pointerId != null) {
      session.target.releasePointerCapture(session.pointerId)
    }
  } catch {
  }
}
