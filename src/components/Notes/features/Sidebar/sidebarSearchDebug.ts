import type { EditorView } from '@milkdown/kit/prose/view';

const debugObjectIds = new WeakMap<object, string>();
let debugObjectCounter = 0;

export function isSidebarSearchDebugEnabled(): boolean {
  return true;
}

export function logSidebarSearchDebug(label: string, meta?: Record<string, unknown>): void {
  if (!isSidebarSearchDebugEnabled()) {
    return;
  }

  console.log(`[notes:sidebar-search-jump] ${label}`, {
    t: Number(performance.now().toFixed(1)),
    ...meta,
  });
}

export function getSidebarSearchDebugObjectId(
  value: object | null | undefined,
  prefix = 'obj',
): string | null {
  if (!value) {
    return null;
  }

  const existingId = debugObjectIds.get(value);
  if (existingId) {
    return existingId;
  }

  debugObjectCounter += 1;
  const nextId = `${prefix}-${debugObjectCounter}`;
  debugObjectIds.set(value, nextId);
  return nextId;
}

export function getSidebarSearchDebugViewMeta(view: EditorView | null | undefined) {
  if (!view) {
    return null;
  }

  const docSize = view.state.doc.content.size;
  const docPreview = view.state.doc
    .textBetween(0, Math.min(docSize, 80), '\n', ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    viewId: getSidebarSearchDebugObjectId(view, 'view'),
    docSize,
    selectionFrom: view.state.selection.from,
    selectionTo: view.state.selection.to,
    docPreview,
  };
}

export function getSidebarSearchDebugScrollMeta(element: HTMLElement | null | undefined) {
  if (!element) {
    return null;
  }

  return {
    scrollRootId: getSidebarSearchDebugObjectId(element, 'scroll-root'),
    scrollTop: Number(element.scrollTop.toFixed(1)),
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
  };
}
