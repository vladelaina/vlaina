// Floating Toolbar Plugin - Core Plugin Logic
import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import type { FloatingToolbarState, ToolbarMeta } from './types';
import { TOOLBAR_ACTIONS } from './types';
import { getActiveMarks, getCurrentBlockType, getLinkUrl, getTextColor, getBgColor, calculatePosition, isSelectionInFirstH1 } from './selectionHelpers';
import { renderToolbarContent, cleanupToolbarEventDelegation } from './renderToolbar';
import { toggleMark } from './commands';

export const floatingToolbarKey = new PluginKey<FloatingToolbarState>('floatingToolbar');

let currentBlockElement: HTMLElement | null = null;

export function getCurrentBlockElement(): HTMLElement | null {
  return currentBlockElement;
}

function updateCurrentBlockElement(view: { state: { selection: { $from: { pos: number } } }; domAtPos: (pos: number) => { node: Node } }): void {
  try {
    const { $from } = view.state.selection;
    const domAtPos = view.domAtPos($from.pos);
    let node = domAtPos.node as Node;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentNode as Node;
    let el = node as HTMLElement;
    while (el && el.parentElement) {
      const tagName = el.tagName?.toUpperCase();
      if (tagName === 'P' || (tagName && /^H[1-6]$/.test(tagName))) { currentBlockElement = el; return; }
      if (el.classList?.contains('milkdown') || el.classList?.contains('editor')) break;
      el = el.parentElement;
    }
    currentBlockElement = null;
  } catch { currentBlockElement = null; }
}

function createInitialState(): FloatingToolbarState {
  return { isVisible: false, position: { x: 0, y: 0 }, placement: 'top', activeMarks: new Set(), currentBlockType: 'paragraph', linkUrl: null, textColor: null, bgColor: null, subMenu: null };
}

let toolbarElement: HTMLElement | null = null;
let lastRenderState: string = '';

function createToolbarElement(): HTMLElement {
  const toolbar = document.createElement('div');
  toolbar.className = 'floating-toolbar hidden';
  toolbar.setAttribute('role', 'toolbar');
  toolbar.setAttribute('aria-label', 'Text formatting');
  return toolbar;
}

function showToolbar(position: { x: number; y: number }, placement: 'top' | 'bottom') {
  if (!toolbarElement) return;
  toolbarElement.style.left = `${position.x}px`;
  toolbarElement.style.top = `${position.y}px`;
  toolbarElement.style.transform = `translateX(-50%) translateY(${placement === 'top' ? '-100%' : '0'})`;
  if (!toolbarElement.classList.contains('visible')) { toolbarElement.classList.add('visible'); toolbarElement.classList.remove('hidden'); }
}

function hideToolbar() {
  if (!toolbarElement) return;
  if (toolbarElement.classList.contains('visible')) { toolbarElement.classList.remove('visible'); toolbarElement.classList.add('hidden'); }
}

export const floatingToolbarPlugin = $prose(() => {
  let isMouseDown = false;
  let pendingShow = false;
  let pendingRaf: number | null = null;
  
  return new Plugin<FloatingToolbarState>({
    key: floatingToolbarKey,
    state: {
      init: () => createInitialState(),
      apply(tr, prevState, _oldState, newState) {
        const meta = tr.getMeta(floatingToolbarKey) as ToolbarMeta | undefined;
        if (meta) {
          switch (meta.type) {
            case TOOLBAR_ACTIONS.SHOW: return { ...prevState, isVisible: true, ...meta.payload };
            case TOOLBAR_ACTIONS.HIDE: return { ...prevState, isVisible: false, subMenu: null };
            case TOOLBAR_ACTIONS.UPDATE_POSITION: return { ...prevState, ...meta.payload };
            case TOOLBAR_ACTIONS.SET_SUB_MENU: return { ...prevState, subMenu: meta.payload?.subMenu ?? null };
            default: return { ...prevState, ...meta.payload };
          }
        }
        if (tr.selectionSet) {
          const { selection } = newState;
          if (selection.empty) { if (prevState.isVisible) return { ...prevState, isVisible: false, subMenu: null }; }
          else {
            if (!isMouseDown && !prevState.isVisible) return { ...prevState, isVisible: true };
            if (isMouseDown) pendingShow = true;
          }
        }
        return prevState;
      },
    },
    view(editorView) {
      toolbarElement = createToolbarElement();
      document.body.appendChild(toolbarElement);
      const handleMouseDown = () => { isMouseDown = true; pendingShow = false; };
      const handleMouseUp = () => {
        isMouseDown = false;
        if (pendingShow) {
          pendingShow = false;
          if (pendingRaf !== null) cancelAnimationFrame(pendingRaf);
          pendingRaf = requestAnimationFrame(() => {
            pendingRaf = null;
            if (isMouseDown) return;
            const { selection } = editorView.state;
            if (!selection.empty) editorView.dispatch(editorView.state.tr.setMeta(floatingToolbarKey, { type: TOOLBAR_ACTIONS.SHOW }));
          });
        }
      };
      document.addEventListener('mousedown', handleMouseDown);
      document.addEventListener('mouseup', handleMouseUp);
      const updateToolbar = () => {
        const { selection } = editorView.state;
        if (selection.empty) { hideToolbar(); lastRenderState = ''; currentBlockElement = null; return; }
        if (isSelectionInFirstH1(editorView)) { hideToolbar(); lastRenderState = ''; currentBlockElement = null; return; }
        updateCurrentBlockElement(editorView);
        const state = floatingToolbarKey.getState(editorView.state);
        if (!state?.isVisible) { hideToolbar(); lastRenderState = ''; return; }
        const { x, y, placement } = calculatePosition(editorView);
        const activeMarks = getActiveMarks(editorView);
        const currentBlockType = getCurrentBlockType(editorView);
        const linkUrl = getLinkUrl(editorView);
        const textColor = getTextColor(editorView);
        const bgColor = getBgColor(editorView);
        const cacheKey = [Array.from(activeMarks).sort().join(','), currentBlockType, linkUrl || '', textColor || '', bgColor || '', state.subMenu || ''].join('|');
        if (cacheKey !== lastRenderState) {
          lastRenderState = cacheKey;
          renderToolbarContent(toolbarElement!, editorView, { ...state, activeMarks, currentBlockType, linkUrl, textColor, bgColor });
        }
        showToolbar({ x, y }, placement);
      };
      const handleClickOutside = (e: MouseEvent) => {
        if (toolbarElement && !toolbarElement.contains(e.target as Node)) {
          const state = floatingToolbarKey.getState(editorView.state);
          if (state?.subMenu) editorView.dispatch(editorView.state.tr.setMeta(floatingToolbarKey, { type: TOOLBAR_ACTIONS.SET_SUB_MENU, payload: { subMenu: null } }));
        }
      };
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          const state = floatingToolbarKey.getState(editorView.state);
          if (state?.isVisible) editorView.dispatch(editorView.state.tr.setMeta(floatingToolbarKey, { type: TOOLBAR_ACTIONS.HIDE }));
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      return {
        update: updateToolbar,
        destroy() {
          if (pendingRaf !== null) { cancelAnimationFrame(pendingRaf); pendingRaf = null; }
          document.removeEventListener('mousedown', handleMouseDown);
          document.removeEventListener('mouseup', handleMouseUp);
          document.removeEventListener('mousedown', handleClickOutside);
          document.removeEventListener('keydown', handleKeyDown);
          if (toolbarElement) { cleanupToolbarEventDelegation(toolbarElement); toolbarElement.remove(); toolbarElement = null; }
          lastRenderState = ''; currentBlockElement = null; isMouseDown = false; pendingShow = false;
        },
      };
    },
    props: {
      handleKeyDown(view, event) {
        const isMod = event.ctrlKey || event.metaKey;
        if (isMod && !event.shiftKey) {
          const { selection } = view.state;
          if (selection.empty) return false;
          switch (event.key.toLowerCase()) {
            case 'b': event.preventDefault(); toggleMark(view, 'strong'); return true;
            case 'i': event.preventDefault(); toggleMark(view, 'emphasis'); return true;
            case 'u': event.preventDefault(); toggleMark(view, 'underline'); return true;
            case 'k': event.preventDefault(); view.dispatch(view.state.tr.setMeta(floatingToolbarKey, { type: TOOLBAR_ACTIONS.SET_SUB_MENU, payload: { subMenu: 'link' } })); return true;
            case 'h': event.preventDefault(); toggleMark(view, 'highlight'); return true;
          }
        }
        return false;
      },
    },
  });
});
