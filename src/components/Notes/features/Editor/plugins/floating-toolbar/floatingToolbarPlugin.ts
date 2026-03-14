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
import { createToolbarRenderer } from './renderToolbar';
import { setLink, toggleMark } from './commands';
import { linkTooltipPluginKey } from '../links';

export const floatingToolbarKey = new PluginKey<FloatingToolbarState>('floatingToolbar');
const SCROLL_ROOT_SELECTOR = '[data-note-scroll-root="true"]';
const TOOLBAR_ROOT_SELECTOR = '[data-note-toolbar-root="true"]';

function getCurrentBlockElement(view: {
  state: { selection: { $from: { pos: number } } };
  domAtPos: (pos: number) => { node: Node };
}): HTMLElement | null {
  try {
    const { $from } = view.state.selection;
    const domAtPos = view.domAtPos($from.pos);
    let node = domAtPos.node as Node;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentNode as Node;
    let el = node as HTMLElement;
    while (el && el.parentElement) {
      const tagName = el.tagName?.toUpperCase();
      if (tagName === 'P' || tagName === 'PRE' || (tagName && /^H[1-6]$/.test(tagName))) {
        return el;
      }
      if (el.classList?.contains('milkdown') || el.classList?.contains('editor')) break;
      el = el.parentElement;
    }
    return null;
  } catch {
    return null;
  }
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

function getScrollRoot(view: { dom: HTMLElement }): HTMLElement | null {
  return view.dom.closest(SCROLL_ROOT_SELECTOR) as HTMLElement | null;
}

function getToolbarRoot(view: { dom: HTMLElement }): HTMLElement | null {
  return view.dom.closest(TOOLBAR_ROOT_SELECTOR) as HTMLElement | null;
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
  isAiMode: boolean,
  toolbarElement: HTMLElement
): {
  clampedX: number;
  toolbarWidth: number;
  minX: number;
  maxX: number;
} {
  if (!container) {
    return {
      clampedX: x,
      toolbarWidth: toolbarElement.offsetWidth,
      minX: Number.NEGATIVE_INFINITY,
      maxX: Number.POSITIVE_INFINITY,
    };
  }

  const margin = 12;
  const minX = margin;
  const maxX = container.clientWidth - margin;
  const toolbarBodyNode = toolbarElement.querySelector('.floating-toolbar-inner');
  const toolbarBody = toolbarBodyNode instanceof HTMLElement ? toolbarBodyNode : null;
  const toolbarWidth = toolbarBody?.offsetWidth || toolbarElement.offsetWidth;

  if (isAiMode) {
    return {
      clampedX: Math.min(x, Math.max(minX, maxX - toolbarWidth)),
      toolbarWidth,
      minX,
      maxX,
    };
  }

  const halfWidth = toolbarWidth / 2;
  return {
    clampedX: Math.max(minX + halfWidth, Math.min(x, maxX - halfWidth)),
    toolbarWidth,
    minX,
    maxX,
  };
}

function createToolbarElement(): HTMLElement {
  const toolbar = document.createElement('div');
  toolbar.className = 'floating-toolbar hidden';
  toolbar.setAttribute('role', 'toolbar');
  toolbar.setAttribute('aria-label', 'Text formatting');
  return toolbar;
}

function showToolbar(
  toolbarElement: HTMLElement,
  position: { x: number; y: number },
  placement: 'top' | 'bottom'
) {
  toolbarElement.style.left = `${position.x}px`;
  toolbarElement.style.top = `${position.y}px`;
  const isAiMode = toolbarElement.querySelector('.floating-toolbar-ai-mode');
  toolbarElement.style.transform = isAiMode
    ? `translateX(0) translateY(${placement === 'top' ? '-100%' : '0'})`
    : `translateX(-50%) translateY(${placement === 'top' ? '-100%' : '0'})`;
  if (!toolbarElement.classList.contains('visible')) { toolbarElement.classList.add('visible'); toolbarElement.classList.remove('hidden'); }
}

function hideToolbar(toolbarElement: HTMLElement) {
  if (toolbarElement.classList.contains('visible')) { toolbarElement.classList.remove('visible'); toolbarElement.classList.add('hidden'); }
}

export const floatingToolbarPlugin = $prose(() => {
  let isMouseDown = false;
  let pendingShow = false;
  let pendingRaf: number | null = null;
  let layoutRaf: number | null = null;
  let lastSelectionSignature = '';
  let lastToolbarX: number | null = null;
  let lastToolbarY: number | null = null;
  let lastContainerWidth: number | null = null;
  let lastPlacement: 'top' | 'bottom' | null = null;
  let isPointerInsideToolbar = false;
  let lastTextSelection: { from: number; to: number } | null = null;

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
          if (!selection.empty && selection instanceof TextSelection) {
            lastTextSelection = {
              from: selection.from,
              to: selection.to,
            };
          }

          if (selection.empty) {
            if (prevState.isVisible) {
              if (isPointerInsideToolbar) {
                return prevState;
              }

              return { ...prevState, isVisible: false, subMenu: null, copied: false };
            }
          }
          else {
            if (!isMouseDown && !prevState.isVisible) return { ...prevState, isVisible: true };
            if (isMouseDown) pendingShow = true;
          }
        }
        return prevState;
      },
    },
    view(editorView) {
      let currentBlockElement: HTMLElement | null = null;
      let lastRenderState = '';
      const toolbarElement = createToolbarElement();
      const toolbarRenderer = createToolbarRenderer(toolbarElement);
      const scrollRoot = getScrollRoot(editorView);
      const toolbarRoot = getToolbarRoot(editorView);
      (toolbarRoot ?? scrollRoot ?? document.body).appendChild(toolbarElement);

      const restoreLastSelection = () => {
        const selection = editorView.state.selection;
        if (!selection.empty || !lastTextSelection) {
          return;
        }

        const maxPos = editorView.state.doc.content.size;
        const from = Math.max(0, Math.min(lastTextSelection.from, maxPos));
        const to = Math.max(from, Math.min(lastTextSelection.to, maxPos));
        if (from === to) {
          return;
        }

        editorView.dispatch(
          editorView.state.tr
            .setSelection(TextSelection.create(editorView.state.doc, from, to))
            .setMeta('addToHistory', false)
        );
      };

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
      const handleToolbarPointerEnter = () => {
        isPointerInsideToolbar = true;
        restoreLastSelection();
      };
      const handleToolbarPointerLeave = () => {
        isPointerInsideToolbar = false;
        if (!editorView.state.selection.empty) {
          return;
        }

        editorView.dispatch(
          editorView.state.tr.setMeta(floatingToolbarKey, {
            type: TOOLBAR_ACTIONS.HIDE,
          })
        );
      };
      document.addEventListener('mousedown', handleMouseDown);
      document.addEventListener('mouseup', handleMouseUp);
      toolbarElement.addEventListener('mouseenter', handleToolbarPointerEnter);
      toolbarElement.addEventListener('mouseleave', handleToolbarPointerLeave);
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
        const restoreSelectionForToolbar = () => {
          if (!isPointerInsideToolbar) {
            return false;
          }

          restoreLastSelection();
          return true;
        };

        let { selection } = editorView.state;
        
        // Only show toolbar for TextSelection
        // This prevents it from showing on NodeSelections (like Images)
        // or when selection is explicitly empty
        if (selection.empty || !(selection instanceof TextSelection)) {
            if (restoreSelectionForToolbar()) {
              selection = editorView.state.selection;
            }
        }

        if (selection.empty || !(selection instanceof TextSelection)) { 
            hideToolbar(toolbarElement); 
            lastRenderState = ''; 
            currentBlockElement = null; 
            lastSelectionSignature = '';
            lastToolbarX = null;
            lastToolbarY = null;
            lastContainerWidth = null;
            lastPlacement = null;
            return; 
        }

        currentBlockElement = getCurrentBlockElement(editorView);
        const state = floatingToolbarKey.getState(editorView.state);
        if (!state?.isVisible) {
          hideToolbar(toolbarElement);
          lastRenderState = '';
          lastSelectionSignature = '';
          lastToolbarX = null;
          lastToolbarY = null;
          lastContainerWidth = null;
          lastPlacement = null;
          return;
        }
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
          toolbarRenderer.render(editorView, {
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
        const containerWidth = (toolbarRoot ?? scrollRoot)?.clientWidth ?? null;
        const selectionSignature = `${selection.from}:${selection.to}`;
        const clamped = clampToolbarX(
          containerPosition.x,
          toolbarRoot ?? scrollRoot,
          isAiMode,
          toolbarElement
        );
        const shouldFreezeX =
          !isAiMode &&
          lastToolbarX !== null &&
          lastSelectionSignature === selectionSignature &&
          lastContainerWidth === containerWidth;
        const shouldFreezePosition =
          shouldFreezeX &&
          state.subMenu !== null &&
          lastToolbarY !== null &&
          lastPlacement !== null;
        const finalX = shouldFreezeX && lastToolbarX !== null ? lastToolbarX : clamped.clampedX;
        const finalY =
          shouldFreezePosition && lastToolbarY !== null ? lastToolbarY : containerPosition.y;
        const finalPlacement =
          shouldFreezePosition && lastPlacement !== null ? lastPlacement : nextPosition.placement;
        showToolbar(toolbarElement, {
          x: finalX,
          y: finalY,
        }, finalPlacement);
        lastSelectionSignature = selectionSignature;
        lastToolbarX = finalX;
        lastToolbarY = finalY;
        lastContainerWidth = containerWidth;
        lastPlacement = finalPlacement;
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
          toolbarElement.removeEventListener('mouseenter', handleToolbarPointerEnter);
          toolbarElement.removeEventListener('mouseleave', handleToolbarPointerLeave);
          document.removeEventListener('mousedown', handleClickOutside);
          document.removeEventListener('keydown', handleKeyDown);
          window.removeEventListener('resize', scheduleToolbarUpdate);
          scrollRoot?.removeEventListener('scroll', scheduleToolbarUpdate);
          resizeObserver?.disconnect();
          toolbarRenderer.destroy();
          toolbarElement.remove();
          lastRenderState = '';
          currentBlockElement = null;
          isMouseDown = false;
          pendingShow = false;
          lastSelectionSignature = '';
          lastToolbarX = null;
          lastToolbarY = null;
          lastContainerWidth = null;
          lastPlacement = null;
          isPointerInsideToolbar = false;
          lastTextSelection = null;
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
            case 'k': {
              event.preventDefault();
              const linkUrl = getLinkUrl(view);
              if (linkUrl !== null && linkUrl !== '') {
                setLink(view, null);
                return true;
              }

              const { from, to } = view.state.selection;
              view.dispatch(
                view.state.tr.setMeta(linkTooltipPluginKey, {
                  type: 'SHOW_LINK_TOOLTIP',
                  from,
                  to,
                })
              );
              view.focus();
              return true;
            }
            case 'h': event.preventDefault(); toggleMark(view, 'highlight'); return true;
          }
        }
        return false;
      },
    },
  });
});
