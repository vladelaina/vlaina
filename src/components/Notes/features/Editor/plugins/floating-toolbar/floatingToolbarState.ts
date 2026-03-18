import { TOOLBAR_ACTIONS, type FloatingToolbarState, type ToolbarMeta } from './types';

export function createInitialState(): FloatingToolbarState {
  return {
    isVisible: false,
    position: { x: 0, y: 0 },
    placement: 'top',
    dragPosition: null,
    activeMarks: new Set(),
    currentBlockType: 'paragraph',
    currentAlignment: 'left',
    copied: false,
    linkUrl: null,
    textColor: null,
    bgColor: null,
    subMenu: null,
    aiReview: null,
  };
}

export function applyToolbarMeta(
  prevState: FloatingToolbarState,
  meta: ToolbarMeta | undefined
): FloatingToolbarState | null {
  if (!meta) {
    return null;
  }

  switch (meta.type) {
    case TOOLBAR_ACTIONS.SHOW:
      return { ...prevState, isVisible: true, ...meta.payload };
    case TOOLBAR_ACTIONS.HIDE:
      return {
        ...prevState,
        isVisible: false,
        subMenu: null,
        copied: false,
        aiReview: null,
        dragPosition: null,
      };
    case TOOLBAR_ACTIONS.UPDATE_POSITION:
      return { ...prevState, ...meta.payload };
    case TOOLBAR_ACTIONS.SET_SUB_MENU:
      return { ...prevState, subMenu: meta.payload?.subMenu ?? null };
    case TOOLBAR_ACTIONS.SET_COPIED:
      return { ...prevState, copied: meta.payload?.copied ?? false };
    case TOOLBAR_ACTIONS.SET_AI_REVIEW:
      return {
        ...prevState,
        isVisible: true,
        subMenu: 'aiReview',
        dragPosition: meta.payload?.dragPosition ?? prevState.dragPosition,
        aiReview: meta.payload?.aiReview ?? null,
      };
    default:
      return { ...prevState, ...meta.payload };
  }
}
