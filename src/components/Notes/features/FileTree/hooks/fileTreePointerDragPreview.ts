import { NOTES_DRAG_RETURN_ANIMATION } from '../../common/NotesDragOverlay';
import {
  themeDomStyleTokens,
  themeIconTokens,
  themeMotionTokens,
  themeRenderingTokens,
  themeStyleResetTokens,
} from '@/styles/themeTokens';
import type { FileTreePointerDragSession } from './fileTreePointerDragTypes';

export function createPreviewElement(sourceElement: HTMLElement) {
  const rect = sourceElement.getBoundingClientRect();
  const previewElement = sourceElement.cloneNode(true) as HTMLElement;
  previewElement.style.position = themeDomStyleTokens.positionFixed;
  previewElement.style.left = themeDomStyleTokens.sizeZero;
  previewElement.style.top = themeDomStyleTokens.sizeZero;
  previewElement.style.width = `${Math.round(rect.width)}px`;
  previewElement.style.pointerEvents = themeStyleResetTokens.pointerEventsNone;
  previewElement.style.zIndex = themeDomStyleTokens.zIndexMax;
  previewElement.style.margin = themeDomStyleTokens.marginNone;
  previewElement.style.opacity = String(themeMotionTokens.opacityVisible);
  previewElement.style.backgroundColor = themeDomStyleTokens.fileTreePreviewSurface;
  previewElement.style.transform = themeRenderingTokens.translate3dOffscreen;
  previewElement.style.boxShadow = themeStyleResetTokens.boxShadowNone;
  previewElement.style.borderRadius = themeDomStyleTokens.previewBorderRadius;
  previewElement.style.filter = themeDomStyleTokens.previewSaturateFilter;
  previewElement.style.willChange = themeRenderingTokens.transformWillChange;
  previewElement.dataset.fileTreeDragOriginalPaddingRight = previewElement.style.paddingRight;
  document.body.appendChild(previewElement);
  return { previewElement, rect };
}

function createPreviewStarBadge() {
  const badge = document.createElement('span');
  badge.dataset.fileTreeDragStarBadge = 'true';
  badge.setAttribute('aria-hidden', 'true');
  badge.style.position = themeDomStyleTokens.positionAbsolute;
  badge.style.right = themeDomStyleTokens.badgeRight;
  badge.style.top = themeDomStyleTokens.badgeTop;
  badge.style.transform = themeRenderingTokens.translateYCenter;
  badge.style.display = themeDomStyleTokens.displayInlineFlex;
  badge.style.alignItems = themeDomStyleTokens.alignCenter;
  badge.style.justifyContent = themeDomStyleTokens.justifyCenter;
  badge.style.width = themeDomStyleTokens.badgeSize;
  badge.style.height = themeDomStyleTokens.badgeSize;
  badge.style.color = themeDomStyleTokens.fileTreePreviewBadgeColor;
  badge.innerHTML = `<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="${themeIconTokens.viewBoxStarBadge}" fill="${themeStyleResetTokens.currentColor}" width="${themeIconTokens.sizeStarBadge}" height="${themeIconTokens.sizeStarBadge}"><path d="M9.1 2.5a1 1 0 0 1 1.8 0l1.6 3.3 3.6.5a1 1 0 0 1 .6 1.7l-2.6 2.5.6 3.6a1 1 0 0 1-1.5 1.1L10 13.5l-3.2 1.7a1 1 0 0 1-1.5-1.1l.6-3.6L3.3 8a1 1 0 0 1 .6-1.7l3.6-.5 1.6-3.3Z"/></svg>`;
  return badge;
}

export function setPreviewStarred(session: FileTreePointerDragSession | null, starred: boolean) {
  const previewElement = session?.previewElement;
  if (!previewElement) return;

  const existing = previewElement.querySelector('[data-file-tree-drag-star-badge="true"]');
  if (!starred) {
    existing?.remove();
    previewElement.style.paddingRight = previewElement.dataset.fileTreeDragOriginalPaddingRight ?? '';
    return;
  }

  if (existing) return;
  previewElement.style.paddingRight = themeDomStyleTokens.starredPreviewPaddingRight;
  previewElement.appendChild(createPreviewStarBadge());
}

export function updatePreviewPosition(session: FileTreePointerDragSession | null) {
  if (!session?.previewElement) {
    return;
  }

  session.previewElement.style.transform = `translate3d(${Math.round(session.lastClientX - session.previewOffsetX)}px, ${Math.round(session.lastClientY - session.previewOffsetY)}px, 0)`;
}

export function animatePreviewBackToSource(
  previewElement: HTMLElement | null,
  sourceElement: HTMLElement | null,
) {
  if (!previewElement?.isConnected || !sourceElement?.isConnected) {
    previewElement?.remove();
    return;
  }

  const sourceRect = sourceElement.getBoundingClientRect();
  const currentTransform = previewElement.style.transform;
  const targetTransform = `translate3d(${Math.round(sourceRect.left)}px, ${Math.round(sourceRect.top)}px, 0)`;
  const animate = previewElement.animate?.bind(previewElement);

  if (!animate) {
    previewElement.remove();
    return;
  }

  previewElement.style.transform = targetTransform;
  previewElement.style.pointerEvents = themeStyleResetTokens.pointerEventsNone;

  const animation = animate(
    [
      { transform: currentTransform, opacity: previewElement.style.opacity || '1' },
      { transform: targetTransform, opacity: previewElement.style.opacity || '1' },
    ],
    {
      duration: NOTES_DRAG_RETURN_ANIMATION.duration,
      easing: NOTES_DRAG_RETURN_ANIMATION.easing,
      fill: 'forwards',
    },
  );

  void animation.finished.then(
    () => previewElement.remove(),
    () => previewElement.remove(),
  );
}
