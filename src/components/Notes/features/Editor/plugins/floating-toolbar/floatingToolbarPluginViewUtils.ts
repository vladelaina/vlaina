import type { FloatingToolbarState } from './types';

export function hasVisibleNativeRange(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return false;
  }

  const range = selection.getRangeAt(0);
  return !selection.isCollapsed && range.getClientRects().length > 0;
}

export function isEditableShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
}

export function isDocumentFormatShortcut(event: KeyboardEvent): boolean {
  return (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && !event.isComposing;
}

export function shouldLockPreviewToolbarPosition(args: {
  subMenu: FloatingToolbarState['subMenu'];
  hasActivePreview: boolean;
}): boolean {
  return args.hasActivePreview || args.subMenu === 'block' || args.subMenu === 'alignment' || args.subMenu === 'color';
}

export interface FloatingToolbarInteractionState {
  isMouseDown: boolean;
  pendingShow: boolean;
  isPointerInsideToolbar: boolean;
}

