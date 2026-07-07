import type { EditorView } from '@milkdown/kit/prose/view';
import { getContentLayoutContext } from '../floating-toolbar/floatingToolbarLayout';
import { toContainerPosition } from '../floating-toolbar/floatingToolbarDom';
import { getSlashMenuPosition } from './slashState';

const SLASH_MENU_MARGIN_PX = 12;
const SLASH_MENU_MAX_HEIGHT_PX = 360;
const SLASH_MENU_MIN_HEIGHT_PX = 160;

export function applySlashMenuPosition(
  editorView: EditorView,
  menuElement: HTMLElement,
  positionRoot: HTMLElement | null,
) {
  const viewportPosition = getSlashMenuPosition(editorView);
  const containerPosition = toContainerPosition(viewportPosition, positionRoot);
  const layout = getContentLayoutContext(editorView, positionRoot);
  const menuWidth = menuElement.offsetWidth || 320;
  const menuHeight = menuElement.offsetHeight || SLASH_MENU_MAX_HEIGHT_PX;
  const horizontalBounds = positionRoot
    ? {
        left: layout.containerBounds?.left ?? SLASH_MENU_MARGIN_PX,
        right: layout.containerBounds?.right ?? positionRoot.clientWidth,
      }
    : {
        left: layout.viewportBounds.left,
        right: layout.viewportBounds.right,
      };
  const minX = horizontalBounds.left + SLASH_MENU_MARGIN_PX;
  const maxX = horizontalBounds.right - SLASH_MENU_MARGIN_PX - menuWidth;
  const nextX = maxX < minX
    ? minX
    : Math.max(minX, Math.min(containerPosition.x, maxX));
  const availableBelow = positionRoot
    ? positionRoot.clientHeight - containerPosition.y - 24
    : window.innerHeight - viewportPosition.y - 24;
  const availableAbove = containerPosition.y - 24;
  const shouldPlaceAbove =
    availableBelow < Math.min(menuHeight, 220) &&
    availableAbove > availableBelow;
  const nextY = shouldPlaceAbove
    ? Math.max(24, containerPosition.y - menuHeight - 8)
    : containerPosition.y;
  const availableHeight = shouldPlaceAbove ? availableAbove : availableBelow;

  menuElement.style.left = `${Math.round(nextX)}px`;
  menuElement.style.top = `${Math.round(nextY)}px`;
  menuElement.style.maxHeight = `${Math.max(
    SLASH_MENU_MIN_HEIGHT_PX,
    Math.min(SLASH_MENU_MAX_HEIGHT_PX, availableHeight),
  )}px`;
}
