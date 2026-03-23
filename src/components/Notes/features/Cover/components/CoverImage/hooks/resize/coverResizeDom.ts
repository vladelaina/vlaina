import type { ResizeSnapshot } from '../../../../utils/coverResizeMath';

function setStyle(node: HTMLElement | null, key: string, value: string) {
  if (!node) return;
  node.style.setProperty(key, value);
}

export function applyFrozenSnapshot(
  frozenImg: HTMLImageElement | null,
  snapshot: ResizeSnapshot
) {
  if (!frozenImg) return;
  setStyle(frozenImg, 'top', `${snapshot.absoluteTop}px`);
  setStyle(frozenImg, 'left', `${snapshot.absoluteLeft}px`);
  setStyle(frozenImg, 'width', `${snapshot.scaledWidth}px`);
  setStyle(frozenImg, 'height', `${snapshot.scaledHeight}px`);
  setStyle(frozenImg, 'opacity', '1');
  setStyle(frozenImg, 'visibility', 'visible');
}

export function hideFrozenImage(frozenImg: HTMLImageElement | null) {
  if (!frozenImg) return;
  setStyle(frozenImg, 'opacity', '0');
  setStyle(frozenImg, 'visibility', 'hidden');
}

export function setFrozenTop(frozenImg: HTMLImageElement | null, top: number) {
  setStyle(frozenImg, 'top', `${top}px`);
}

export function setWrapperVisible(wrapper: HTMLDivElement | null, visible: boolean) {
  setStyle(wrapper, 'opacity', visible ? '1' : '0');
}

export function setContainerTransitionEnabled(
  container: HTMLDivElement | null,
  enabled: boolean
) {
  setStyle(container, 'transition', enabled ? '' : 'none');
}

export function setContainerHeight(container: HTMLDivElement | null, height: number) {
  setStyle(container, 'height', `${height}px`);
}
