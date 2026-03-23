import type { EditorView } from '@milkdown/kit/prose/view';
import { getContentLayoutContext } from '../../floating-toolbar/floatingToolbarLayout';
import {
  getScrollRoot,
  getToolbarRoot,
  toContainerPosition,
} from '../../floating-toolbar/floatingToolbarDom';

export type LinkTooltipAnchor =
  | { type: 'link'; link: HTMLElement }
  | { type: 'range'; from: number; to: number };

export function getLinkTooltipPositionRoot(view: EditorView): HTMLElement | null {
  return getToolbarRoot(view) ?? getScrollRoot(view);
}

function getViewportAnchorPosition(
  view: EditorView,
  anchor: LinkTooltipAnchor
): { x: number; y: number } {
  if (anchor.type === 'link') {
    const rect = anchor.link.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.bottom + 8,
    };
  }

  const startCoords = view.coordsAtPos(anchor.from);
  const endCoords = view.coordsAtPos(anchor.to);

  return {
    x: (startCoords.left + endCoords.right) / 2,
    y: Math.max(startCoords.bottom, endCoords.bottom) + 8,
  };
}

export function resolveLinkTooltipPosition(args: {
  view: EditorView;
  positionRoot: HTMLElement | null;
  tooltipElement: HTMLElement;
  anchor: LinkTooltipAnchor;
  isEditing: boolean;
}): {
  x: number;
  y: number;
  transform: string;
  transformOrigin: string;
} {
  const { view, positionRoot, tooltipElement, anchor, isEditing } = args;
  const viewportPosition = getViewportAnchorPosition(view, anchor);
  const containerPosition = toContainerPosition(viewportPosition, positionRoot);
  const layout = getContentLayoutContext(view, positionRoot);
  const contentBounds = layout.containerBounds;
  const tooltipWidth = tooltipElement.offsetWidth;
  const margin = 12;
  const clampBounds = positionRoot
    ? {
        left: margin,
        right: Math.max(margin, positionRoot.clientWidth - margin),
      }
    : contentBounds;

  if (isEditing) {
    return {
      x: containerPosition.x,
      y: containerPosition.y,
      transform: 'translateX(-50%)',
      transformOrigin: 'center top',
    };
  }

  if (!clampBounds || tooltipWidth <= 0) {
    return {
      x: containerPosition.x,
      y: containerPosition.y,
      transform: 'translateX(-50%)',
      transformOrigin: 'center top',
    };
  }

  const halfWidth = tooltipWidth / 2;
  const minX = clampBounds.left + halfWidth;
  const maxX = clampBounds.right - halfWidth;
  const centeredX = maxX < minX
    ? (clampBounds.left + clampBounds.right) / 2
    : Math.max(minX, Math.min(containerPosition.x, maxX));

  return {
    x: centeredX,
    y: containerPosition.y,
    transform: 'translateX(-50%)',
    transformOrigin: 'center top',
  };
}
