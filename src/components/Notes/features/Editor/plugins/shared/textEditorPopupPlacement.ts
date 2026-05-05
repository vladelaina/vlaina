import { getContentLayoutContext } from '../floating-toolbar/floatingToolbarLayout';
import { toContainerPosition } from '../floating-toolbar/floatingToolbarDom';

export function resolveTextEditorPopupPlacement(args: {
  editorView: { dom: HTMLElement };
  positionRoot: HTMLElement | null;
  viewportPosition: { x: number; y: number };
}) {
  const { editorView, positionRoot, viewportPosition } = args;
  const containerPosition = toContainerPosition(viewportPosition, positionRoot);
  const layout = getContentLayoutContext(editorView as never, positionRoot);
  const margin = 12;
  const bounds = layout.containerBounds
    ? {
        left: layout.containerBounds.left,
        right: layout.containerBounds.right,
      }
    : positionRoot
      ? {
          left: margin,
          right: positionRoot.clientWidth - margin,
        }
      : {
          left: margin,
          right: window.innerWidth - margin,
        };
  const width = Math.max(0, bounds.right - bounds.left);

  return {
    x: bounds.left,
    y: containerPosition.y,
    width,
  };
}
