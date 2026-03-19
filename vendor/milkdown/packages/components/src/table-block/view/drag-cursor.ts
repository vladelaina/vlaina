type DragCursor = 'col-resize' | 'row-resize' | 'nwse-resize'

const ROOT_CURSOR_ATTR = 'data-table-resize-cursor'
const ROOT_SELECTION_ATTR = 'data-table-resize-selection-lock'
const ROOT_TOOLBAR_ATTR = 'data-table-resize-toolbar-suppress'
const OVERLAY_ID = 'milkdown-table-resize-overlay'
const TOOLBAR_SUPPRESS_MS = 180

let activeLockCount = 0
let previousHtmlCursor = ''
let previousBodyCursor = ''
let previousHtmlUserSelect = ''
let previousBodyUserSelect = ''
let previousHtmlCursorPriority = ''
let previousBodyCursorPriority = ''
let previousHtmlUserSelectPriority = ''
let previousBodyUserSelectPriority = ''
let toolbarSuppressTimeout: number | null = null
let hiddenSelectionEditors: HTMLElement[] = []

function clearBrowserSelection() {
  const selection = document.getSelection()
  if (!selection || selection.rangeCount === 0) return
  selection.removeAllRanges()
}

function ensureOverlay(cursor: DragCursor) {
  let overlay = document.getElementById(OVERLAY_ID)
  if (!(overlay instanceof HTMLDivElement)) {
    overlay = document.createElement('div')
    overlay.id = OVERLAY_ID
    overlay.setAttribute('aria-hidden', 'true')
    overlay.style.position = 'fixed'
    overlay.style.inset = '0'
    overlay.style.zIndex = '2147483647'
    overlay.style.background = 'transparent'
    overlay.style.pointerEvents = 'auto'
    overlay.style.touchAction = 'none'
    document.body.appendChild(overlay)
  }

  overlay.style.setProperty('cursor', cursor, 'important')
}

function removeOverlay() {
  document.getElementById(OVERLAY_ID)?.remove()
}

function hideEditorSelections() {
  hiddenSelectionEditors = Array.from(
    document.querySelectorAll('.milkdown .ProseMirror')
  ).filter((element): element is HTMLElement => element instanceof HTMLElement)

  hiddenSelectionEditors.forEach((element) => {
    element.classList.add('ProseMirror-hideselection')
  })
}

function showEditorSelections() {
  hiddenSelectionEditors.forEach((element) => {
    element.classList.remove('ProseMirror-hideselection')
  })
  hiddenSelectionEditors = []
}

function lockRoot(root: HTMLElement, cursor: DragCursor) {
  root.setAttribute(ROOT_CURSOR_ATTR, cursor)
  root.setAttribute(ROOT_SELECTION_ATTR, '1')
  root.setAttribute(ROOT_TOOLBAR_ATTR, '1')
  root.style.setProperty('cursor', cursor, 'important')
  root.style.setProperty('user-select', 'none', 'important')
}

function unlockRoot(
  root: HTMLElement,
  previousCursor: string,
  previousCursorPriority: string,
  previousUserSelect: string,
  previousUserSelectPriority: string
) {
  root.removeAttribute(ROOT_CURSOR_ATTR)
  root.removeAttribute(ROOT_SELECTION_ATTR)

  if (previousCursor) {
    root.style.setProperty('cursor', previousCursor, previousCursorPriority)
  } else {
    root.style.removeProperty('cursor')
  }

  if (previousUserSelect) {
    root.style.setProperty(
      'user-select',
      previousUserSelect,
      previousUserSelectPriority
    )
  } else {
    root.style.removeProperty('user-select')
  }
}

function applyToolbarSuppression(root: HTMLElement) {
  root.setAttribute(ROOT_TOOLBAR_ATTR, '1')
}

function clearToolbarSuppression(root: HTMLElement) {
  root.removeAttribute(ROOT_TOOLBAR_ATTR)
}

function scheduleToolbarSuppressionRelease(
  html: HTMLElement,
  body: HTMLElement
) {
  if (toolbarSuppressTimeout != null) {
    window.clearTimeout(toolbarSuppressTimeout)
  }

  toolbarSuppressTimeout = window.setTimeout(() => {
    clearToolbarSuppression(html)
    clearToolbarSuppression(body)
    toolbarSuppressTimeout = null
  }, TOOLBAR_SUPPRESS_MS)
}

export function acquireTableDragCursor(cursor: DragCursor) {
  if (typeof document === 'undefined') return
  const html = document.documentElement
  const { body } = document
  if (!html || !body) return

  if (activeLockCount === 0) {
    previousHtmlCursor = html.style.getPropertyValue('cursor')
    previousBodyCursor = body.style.getPropertyValue('cursor')
    previousHtmlUserSelect = html.style.getPropertyValue('user-select')
    previousBodyUserSelect = body.style.getPropertyValue('user-select')
    previousHtmlCursorPriority = html.style.getPropertyPriority('cursor')
    previousBodyCursorPriority = body.style.getPropertyPriority('cursor')
    previousHtmlUserSelectPriority =
      html.style.getPropertyPriority('user-select')
    previousBodyUserSelectPriority =
      body.style.getPropertyPriority('user-select')
  }

  activeLockCount += 1
  lockRoot(html, cursor)
  lockRoot(body, cursor)
  hideEditorSelections()
  clearBrowserSelection()
  ensureOverlay(cursor)
}

export function suppressTableDragSelection() {
  if (typeof document === 'undefined') return
  clearBrowserSelection()
}

export function releaseTableDragCursor() {
  if (typeof document === 'undefined') return
  if (activeLockCount === 0) return

  activeLockCount -= 1
  if (activeLockCount > 0) return

  const html = document.documentElement
  const { body } = document
  if (!html || !body) return

  unlockRoot(
    html,
    previousHtmlCursor,
    previousHtmlCursorPriority,
    previousHtmlUserSelect,
    previousHtmlUserSelectPriority
  )
  unlockRoot(
    body,
    previousBodyCursor,
    previousBodyCursorPriority,
    previousBodyUserSelect,
    previousBodyUserSelectPriority
  )
  showEditorSelections()
  removeOverlay()
  applyToolbarSuppression(html)
  applyToolbarSuppression(body)
  scheduleToolbarSuppressionRelease(html, body)
}
