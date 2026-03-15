// Floating Toolbar Plugin - Core Plugin Logic
import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey, TextSelection } from '@milkdown/kit/prose/state';
import type { FloatingToolbarState, ToolbarMeta } from './types';
import { TOOLBAR_ACTIONS } from './types';
import {
  getActiveMarks,
  calculateBottomPosition,
  getCurrentAlignment,
  getCurrentBlockType,
  getLinkUrl,
  getTextColor,
  getBgColor,
  calculatePosition,
} from './selectionHelpers';
import { renderToolbarContent, cleanupToolbarEventDelegation, cleanupToolbarRendering } from './renderToolbar';
import { toggleMark } from './commands';

export const floatingToolbarKey = new PluginKey<FloatingToolbarState>('floatingToolbar');
const SCROLL_ROOT_SELECTOR = '[data-note-scroll-root="true"]';
const TOOLBAR_ROOT_SELECTOR = '[data-note-toolbar-root="true"]';
const TABLE_RESIZE_TOOLBAR_SUPPRESS_ATTR = 'data-table-resize-toolbar-suppress';

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
  return {
    isVisible: false,
    position: { x: 0, y: 0 },
    placement: 'top',
    activeMarks: new Set(),
    currentBlockType: 'paragraph',
    currentAlignment: 'left',
    copied: false,
    linkUrl: null,
    textColor: null,
    bgColor: null,
    subMenu: null,
  };
}

let toolbarElement: HTMLElement | null = null;
let lastRenderState: string = '';

function getScrollRoot(view: { dom: HTMLElement }): HTMLElement | null {
  return view.dom.closest(SCROLL_ROOT_SELECTOR) as HTMLElement | null;
}

function getToolbarRoot(view: { dom: HTMLElement }): HTMLElement | null {
  return view.dom.closest(TOOLBAR_ROOT_SELECTOR) as HTMLElement | null;
}

function isTableResizeToolbarSuppressed(): boolean {
  if (typeof document === 'undefined') return false;
  return (
    document.documentElement.hasAttribute(TABLE_RESIZE_TOOLBAR_SUPPRESS_ATTR) ||
    document.body.hasAttribute(TABLE_RESIZE_TOOLBAR_SUPPRESS_ATTR)
  );
}

function toContainerPosition(
  position: { x: number; y: number },
  container: HTMLElement | null
): { x: number; y: number } {
  if (!container) {
    return position;
  }

  const containerRect = container.getBoundingClientRect();
  return {
    x: position.x - containerRect.left,
    y: position.y - containerRect.top,
  };
}

function clampToolbarX(
  x: number,
  container: HTMLElement | null,
  isAiMode: boolean
): number {
  if (!container || !toolbarElement) {
    return x;
  }

  const margin = 12;
  const minX = margin;
  const maxX = container.clientWidth - margin;
  const toolbarWidth = toolbarElement.offsetWidth;

  if (isAiMode) {
    return Math.min(x, Math.max(minX, maxX - toolbarWidth));
  }

  const halfWidth = toolbarWidth / 2;
  return Math.max(minX + halfWidth, Math.min(x, maxX - halfWidth));
}

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
  const isAiMode = toolbarElement.querySelector('.floating-toolbar-ai-mode');
  toolbarElement.style.transform = isAiMode
    ? `translateX(0) translateY(${placement === 'top' ? '-100%' : '0'})`
    : `translateX(-50%) translateY(${placement === 'top' ? '-100%' : '0'})`;
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
  let layoutRaf: number | null = null;

  return new Plugin<FloatingToolbarState>({
    key: floatingToolbarKey,
    state: {
      init: () => createInitialState(),
      apply(tr, prevState, _oldState, newState) {
        const meta = tr.getMeta(floatingToolbarKey) as ToolbarMeta | undefined;
        if (meta) {
          switch (meta.type) {
            case TOOLBAR_ACTIONS.SHOW: return { ...prevState, isVisible: true, ...meta.payload };
            case TOOLBAR_ACTIONS.HIDE: return { ...prevState, isVisible: false, subMenu: null, copied: false };
            case TOOLBAR_ACTIONS.UPDATE_POSITION: return { ...prevState, ...meta.payload };
            case TOOLBAR_ACTIONS.SET_SUB_MENU: return { ...prevState, subMenu: meta.payload?.subMenu ?? null };
            case TOOLBAR_ACTIONS.SET_COPIED: return { ...prevState, copied: meta.payload?.copied ?? false };
            default: return { ...prevState, ...meta.payload };
          }
        }
        if (tr.selectionSet) {
          const { selection } = newState;
          if (selection.empty) { if (prevState.isVisible) return { ...prevState, isVisible: false, subMenu: null, copied: false }; }
          else {
            if (isTableResizeToolbarSuppressed()) {
              if (prevState.isVisible) return { ...prevState, isVisible: false, subMenu: null, copied: false };
              return prevState;
            }
            if (!isMouseDown && !prevState.isVisible) return { ...prevState, isVisible: true };
            if (isMouseDown) pendingShow = true;
          }
        }
        return prevState;
      },
    },
    view(editorView) {
      toolbarElement = createToolbarElement();
      const scrollRoot = getScrollRoot(editorView);
      const toolbarRoot = getToolbarRoot(editorView);
      (toolbarRoot ?? scrollRoot ?? document.body).appendChild(toolbarElement);
      const scheduleToolbarUpdate = () => {
        if (layoutRaf !== null) return;
        layoutRaf = requestAnimationFrame(() => {
          layoutRaf = null;
          updateToolbar();
        });
      };
      const handleMouseDown = () => { isMouseDown = true; pendingShow = false; };
      const handleMouseUp = () => {
        isMouseDown = false;
        if (isTableResizeToolbarSuppressed()) {
          pendingShow = false;
          hideToolbar();
          return;
        }
        if (pendingShow) {
          pendingShow = false;
          if (pendingRaf !== null) cancelAnimationFrame(pendingRaf);
          pendingRaf = requestAnimationFrame(() => {
            pendingRaf = null;
            if (isMouseDown) return;
            if (isTableResizeToolbarSuppressed()) return;
            const { selection } = editorView.state;
            if (!selection.empty) editorView.dispatch(editorView.state.tr.setMeta(floatingToolbarKey, { type: TOOLBAR_ACTIONS.SHOW }));
          });
        }
      };
      document.addEventListener('mousedown', handleMouseDown);
      document.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('resize', scheduleToolbarUpdate);
      scrollRoot?.addEventListener('scroll', scheduleToolbarUpdate, { passive: true });
      const resizeObserver = typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            scheduleToolbarUpdate();
          })
        : null;
      resizeObserver?.observe(editorView.dom);
      if (scrollRoot) {
        resizeObserver?.observe(scrollRoot);
      }
      if (toolbarRoot && toolbarRoot !== scrollRoot) {
        resizeObserver?.observe(toolbarRoot);
      }
      const updateToolbar = () => {
        if (isTableResizeToolbarSuppressed()) {
          hideToolbar();
          lastRenderState = '';
          currentBlockElement = null;
          return;
        }

        const { selection } = editorView.state;
        
        // Only show toolbar for TextSelection
        // This prevents it from showing on NodeSelections (like Images)
        // or when selection is explicitly empty
        if (selection.empty || !(selection instanceof TextSelection)) { 
            hideToolbar(); 
            lastRenderState = ''; 
            currentBlockElement = null; 
            return; 
        }

        // Don't show toolbar in code blocks
        const { $from } = selection;
        if ($from.parent.type.name === 'code_block') {
            hideToolbar();
            lastRenderState = '';
            currentBlockElement = null;
            return;
        }

        updateCurrentBlockElement(editorView);
        const state = floatingToolbarKey.getState(editorView.state);
        if (!state?.isVisible) { hideToolbar(); lastRenderState = ''; return; }
        const aiPosition = calculateBottomPosition(editorView);
        const nextPosition = state.subMenu === 'ai'
          ? {
              ...aiPosition,
              x: currentBlockElement?.getBoundingClientRect().left ?? aiPosition.x,
            }
          : calculatePosition(editorView);
        const containerPosition = toContainerPosition(nextPosition, toolbarRoot ?? scrollRoot);
        const activeMarks = getActiveMarks(editorView);
        const currentBlockType = getCurrentBlockType(editorView);
        const currentAlignment = getCurrentAlignment(editorView);
        const linkUrl = getLinkUrl(editorView);
        const textColor = getTextColor(editorView);
        const bgColor = getBgColor(editorView);
        const cacheKey = [
          Array.from(activeMarks).sort().join(','),
          currentBlockType,
          currentAlignment,
          linkUrl || '',
          textColor || '',
          bgColor || '',
          state.copied ? 'copied' : '',
          state.subMenu || '',
        ].join('|');
        if (cacheKey !== lastRenderState) {
          lastRenderState = cacheKey;
          renderToolbarContent(toolbarElement!, editorView, {
            ...state,
            activeMarks,
            currentBlockType,
            currentAlignment,
            linkUrl,
            textColor,
            bgColor,
          });
        }
        const isAiMode = state.subMenu === 'ai';
        showToolbar(
          {
            x: clampToolbarX(containerPosition.x, toolbarRoot ?? scrollRoot, isAiMode),
            y: containerPosition.y,
          },
          nextPosition.placement
        );
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
          if (layoutRaf !== null) { cancelAnimationFrame(layoutRaf); layoutRaf = null; }
          document.removeEventListener('mousedown', handleMouseDown);
          document.removeEventListener('mouseup', handleMouseUp);
          document.removeEventListener('mousedown', handleClickOutside);
          document.removeEventListener('keydown', handleKeyDown);
          window.removeEventListener('resize', scheduleToolbarUpdate);
          scrollRoot?.removeEventListener('scroll', scheduleToolbarUpdate);
          resizeObserver?.disconnect();
          if (toolbarElement) { cleanupToolbarEventDelegation(toolbarElement); cleanupToolbarRendering(); toolbarElement.remove(); toolbarElement = null; }
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
