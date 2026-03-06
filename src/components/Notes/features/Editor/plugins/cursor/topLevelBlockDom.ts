import type { EditorView } from '@milkdown/kit/prose/view';

export function normalizeTopLevelBlockPos(view: EditorView, pos: number): number | null {
  const docSize = view.state.doc.content.size;
  if (docSize <= 0) return null;

  const safePos = Math.max(0, Math.min(pos, docSize));
  try {
    const $pos = view.state.doc.resolve(safePos);
    let indexAtRoot = $pos.index(0);
    if (indexAtRoot >= view.state.doc.childCount) {
      indexAtRoot = view.state.doc.childCount - 1;
    }
    if (indexAtRoot < 0) return null;
    return $pos.posAtIndex(indexAtRoot, 0);
  } catch {
    return null;
  }
}

export function resolveTopLevelBlockElement(view: EditorView, blockPos: number): HTMLElement | null {
  const normalizedPos = normalizeTopLevelBlockPos(view, blockPos);
  if (normalizedPos === null) return null;

  const docSize = view.state.doc.content.size;
  const probePos = Math.max(1, Math.min(normalizedPos + 1, docSize));
  try {
    const domPos = view.domAtPos(probePos);
    let element = domPos.node instanceof HTMLElement ? domPos.node : domPos.node.parentElement;
    while (element && element.parentElement !== view.dom) {
      element = element.parentElement;
    }
    if (element && element.parentElement === view.dom) return element;
  } catch {
  }

  const nodeDom = view.nodeDOM(normalizedPos);
  if (!(nodeDom instanceof HTMLElement)) return null;

  let element: HTMLElement | null = nodeDom;
  while (element && element.parentElement !== view.dom) {
    element = element.parentElement;
  }
  return element && element.parentElement === view.dom ? element : null;
}
