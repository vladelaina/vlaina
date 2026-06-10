import { getContentLayoutContext } from '../floating-toolbar/floatingToolbarLayout';
import { toContainerPosition } from '../floating-toolbar/floatingToolbarDom';
import { themeDomStyleTokens } from '@/styles/themeTokens';

interface HorizontalBounds {
  left: number;
  right: number;
}

function parsePixelValue(value: string): number {
  const parsed = Number.parseFloat(value || '0');
  return Number.isFinite(parsed) ? parsed : 0;
}

function getElementReadableHorizontalBounds(
  element: HTMLElement,
  positionRoot: HTMLElement | null
): HorizontalBounds | null {
  const rect = element.getBoundingClientRect();
  if (!Number.isFinite(rect.left) || !Number.isFinite(rect.right) || rect.right <= rect.left) {
    return null;
  }

  const rootLeft = positionRoot?.getBoundingClientRect().left ?? 0;
  const styles = window.getComputedStyle(element);
  const left = rect.left - rootLeft + parsePixelValue(styles.paddingLeft);
  const right = rect.right - rootLeft - parsePixelValue(styles.paddingRight);

  return right > left ? { left, right } : null;
}

function intersectHorizontalBounds(
  base: HorizontalBounds,
  candidate: HorizontalBounds | null
): HorizontalBounds {
  if (!candidate) {
    return base;
  }

  const left = Math.max(base.left, candidate.left);
  const right = Math.min(base.right, candidate.right);

  return right > left ? { left, right } : base;
}

export function resolveTextEditorPopupPlacement(args: {
  editorView: { dom: HTMLElement };
  positionRoot: HTMLElement | null;
  viewportPosition: { x: number; y: number };
}) {
  const { editorView, positionRoot, viewportPosition } = args;
  const containerPosition = toContainerPosition(viewportPosition, positionRoot);
  const layout = getContentLayoutContext(editorView as never, positionRoot);
  const margin = themeDomStyleTokens.editorPopupHorizontalMarginPx;
  const layoutBounds = layout.containerBounds
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
  const bounds = intersectHorizontalBounds(
    layoutBounds,
    getElementReadableHorizontalBounds(editorView.dom, positionRoot)
  );
  const width = Math.max(0, bounds.right - bounds.left);

  return {
    x: bounds.left,
    y: containerPosition.y,
    width,
  };
}
