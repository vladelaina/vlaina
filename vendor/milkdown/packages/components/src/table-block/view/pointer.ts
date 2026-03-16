import type { EditorView } from '@milkdown/prose/view'

import { throttle } from 'lodash-es'

import type { Refs } from './types'

const EDGE_INTERACTION_THRESHOLD = 12

function isWithinRange(value: number, min: number, max: number) {
  return value >= min && value <= max
}

function getContentFrame(refs: Refs, content: HTMLElement) {
  const wrapper = refs.tableWrapperRef.value
  if (!wrapper) return

  const wrapperRect = wrapper.getBoundingClientRect()
  const contentRect = content.getBoundingClientRect()

  return {
    wrapperRect,
    left: contentRect.left - wrapperRect.left,
    top: contentRect.top - wrapperRect.top,
    width: contentRect.width,
    height: contentRect.height,
    right: contentRect.right - wrapperRect.left,
    bottom: contentRect.bottom - wrapperRect.top,
  }
}

function showRightEdgeHandle(
  refs: Refs,
  content: HTMLElement,
  yHandle: HTMLDivElement
) {
  const rows = content.querySelectorAll('tr')
  const firstRow = rows[0]
  if (!firstRow || firstRow.children.length === 0) return false

  const lastColIndex = firstRow.children.length - 1
  const frame = getContentFrame(refs, content)
  if (!frame) return false

  refs.lineHoverIndex.value![1] = lastColIndex + 1
  yHandle.dataset.show = 'true'
  Object.assign(yHandle.style, {
    top: `${frame.top}px`,
    height: `${frame.height}px`,
    left: `${frame.right}px`,
  })

  return true
}

function showBottomEdgeHandle(
  refs: Refs,
  content: HTMLElement,
  xHandle: HTMLDivElement
) {
  const rows = content.querySelectorAll('tr')
  if (rows.length <= 1) return false

  const lastRowIndex = rows.length - 1
  const frame = getContentFrame(refs, content)
  if (!frame) return false

  refs.lineHoverIndex.value![0] = lastRowIndex + 1
  xHandle.dataset.show = 'true'
  Object.assign(xHandle.style, {
    left: `${frame.left}px`,
    width: `${frame.width}px`,
    top: `${frame.bottom}px`,
  })

  return true
}

function createPointerMoveHandler(
  refs: Refs,
  view?: EditorView
): (e: PointerEvent) => void {
  return throttle((e: PointerEvent) => {
    if (!view?.editable) return
    const { contentWrapperRef, yLineHandleRef, xLineHandleRef, lineHoverIndex } =
      refs
    const yHandle = yLineHandleRef.value
    if (!yHandle) return
    const xHandle = xLineHandleRef.value
    if (!xHandle) return
    const content = contentWrapperRef.value
    if (!content) return
    const frame = getContentFrame(refs, content)
    if (!frame) return

    const contentBoundary = content.getBoundingClientRect()

    const nearRightEdge =
      isWithinRange(
        e.clientY,
        contentBoundary.top - EDGE_INTERACTION_THRESHOLD,
        contentBoundary.bottom + EDGE_INTERACTION_THRESHOLD
      ) &&
      Math.abs(contentBoundary.right - e.clientX) <= EDGE_INTERACTION_THRESHOLD

    const nearBottomEdge =
      isWithinRange(
        e.clientX,
        contentBoundary.left - EDGE_INTERACTION_THRESHOLD,
        contentBoundary.right + EDGE_INTERACTION_THRESHOLD
      ) &&
      Math.abs(contentBoundary.bottom - e.clientY) <= EDGE_INTERACTION_THRESHOLD

    if (nearRightEdge || nearBottomEdge) {
      xHandle.dataset.displayType = 'tool'
      yHandle.dataset.displayType = 'tool'
      refs.lineHoverIndex.value = [-1, -1]

      if (nearRightEdge) {
        showRightEdgeHandle(refs, content, yHandle)
      } else {
        yHandle.dataset.show = 'false'
      }

      if (nearBottomEdge) {
        showBottomEdgeHandle(refs, content, xHandle)
      } else {
        xHandle.dataset.show = 'false'
      }

      return
    }

    lineHoverIndex.value = [-1, -1]
    yHandle.dataset.show = 'false'
    xHandle.dataset.show = 'false'
  }, 20)
}

function createPointerLeaveHandler(refs: Refs): () => void {
  return () => {
    const { yLineHandleRef, xLineHandleRef } = refs
    setTimeout(() => {
      const yHandle = yLineHandleRef.value
      if (!yHandle) return
      const xHandle = xLineHandleRef.value
      if (!xHandle) return

      yHandle.dataset.show = 'false'
      xHandle.dataset.show = 'false'
    }, 200)
  }
}

export function usePointerHandlers(refs: Refs, view?: EditorView) {
  const pointerMove = createPointerMoveHandler(refs, view)
  const pointerLeave = createPointerLeaveHandler(refs)

  return {
    pointerMove,
    pointerLeave,
  }
}
