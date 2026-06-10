import { AllSelection, Plugin, PluginKey, TextSelection, type EditorState } from '@milkdown/kit/prose/state';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import { $prose } from '@milkdown/kit/utils';
import { hasSelectedBlocks } from '../cursor/blockSelectionPluginState';
import { floatingToolbarKey } from '../floating-toolbar/floatingToolbarKey';
import { TOOLBAR_ACTIONS } from '../floating-toolbar/types';
import { ATOMIC_TEXT_SELECTION_OVERLAY_NODE_NAMES } from '../shared/blockNodeTypes';
import { DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT } from '../shared/boundedProseNodeScan';

export const TEXT_SELECTION_OVERLAY_CLASS = 'editor-text-selection-overlay';
const TEXT_SELECTION_OVERLAY_ACTIVE_CLASS = 'editor-text-selection-overlay-active';
const POINTER_NATIVE_SELECTION_CLASS = 'editor-pointer-native-selection';
const KEYBOARD_SELECTION_PENDING_CLASS = 'editor-keyboard-selection-pending';
const POINTER_NATIVE_SELECTION_META = 'editorTextSelectionPointerNative';
const EDITOR_ONLY_TEXT_SELECTION_PLACEHOLDERS = new Set(['\u200B', '\u200C', '\u2800']);
const VISIBLE_TEXT_PATTERN = /\S/u;
const LINE_BREAK_PATTERN = /[\n\r\u2028\u2029]/u;
export const MAX_TEXT_SELECTION_OVERLAY_DECORATIONS = 1000;
export const MAX_TEXT_SELECTION_OVERLAY_SCAN_NODES = DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT;

interface TextSelectionOverlayState {
  decorations: DecorationSet;
  decorationCount: number;
  usePointerNativeSelection: boolean;
}

interface PointerCaretTarget {
  node?: Node;
  offset?: number;
  pos: number;
}

interface PointerClickRestoreSelectionRange {
  from: number;
  to: number;
  usePointerNativeSelection: boolean;
}

const textSelectionOverlayPluginKey = new PluginKey<TextSelectionOverlayState>('editorTextSelectionOverlay');
const NAVIGATION_KEYS_THAT_CLEAR_NATIVE_SELECTION = new Set([
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'End',
  'Home',
  'PageDown',
  'PageUp',
]);

function isModifiedNavigationKey(event: KeyboardEvent): boolean {
  return event.shiftKey || event.ctrlKey || event.metaKey || event.altKey;
}

export function getNativeSelectionMetrics() {
  if (typeof window === 'undefined') {
    return null;
  }

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const rects = range.getClientRects();

  return {
    isCollapsed: selection.isCollapsed,
    rectCount: rects.length,
  };
}

function clearNativeSelectionRange(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.getSelection()?.removeAllRanges();
}

function isTextSelectionOverlayEligible(state: EditorState): boolean {
  const { selection } = state;
  if (selection.empty) return false;
  if (!(selection instanceof TextSelection) && !(selection instanceof AllSelection)) return false;
  if (hasSelectedBlocks(state)) return false;
  return true;
}

export function addTextSelectionOverlayDecorations(
  decorations: Decoration[],
  text: string,
  nodeStart: number,
  selectionFrom: number,
  selectionTo: number
): void {
  const from = Math.max(selectionFrom, nodeStart);
  const to = Math.min(selectionTo, nodeStart + text.length);
  if (to <= from) return;

  const pushVisibleDecoration = (rangeFrom: number, rangeTo: number) => {
    if (decorations.length >= MAX_TEXT_SELECTION_OVERLAY_DECORATIONS) return;
    if (rangeTo <= rangeFrom) return;
    const selectedText = text.slice(rangeFrom - nodeStart, rangeTo - nodeStart);
    if (!VISIBLE_TEXT_PATTERN.test(selectedText)) {
      return;
    }
    decorations.push(Decoration.inline(rangeFrom, rangeTo, {
      class: TEXT_SELECTION_OVERLAY_CLASS,
    }));
  };

  let rangeStart: number | null = null;
  for (let pos = from; pos < to && decorations.length < MAX_TEXT_SELECTION_OVERLAY_DECORATIONS; pos += 1) {
    const char = text[pos - nodeStart];
    if (EDITOR_ONLY_TEXT_SELECTION_PLACEHOLDERS.has(char)) {
      if (rangeStart !== null) {
        pushVisibleDecoration(rangeStart, pos);
      }
      rangeStart = null;
      continue;
    }
    if (LINE_BREAK_PATTERN.test(char)) {
      if (rangeStart !== null) {
        pushVisibleDecoration(rangeStart, pos);
      }
      rangeStart = null;
      continue;
    }

    rangeStart ??= pos;
  }

  if (rangeStart !== null && to > rangeStart) {
    pushVisibleDecoration(rangeStart, to);
  }
}

function forEachTextSelectionOverlayNode(
  doc: ProseNode,
  from: number,
  to: number,
  visit: (node: ProseNode, pos: number) => boolean | void,
  maxScanNodes: number
): void {
  let scannedNodes = 0;
  const stack: Array<{
    contentStart: number;
    index: number;
    node: ProseNode;
    offset: number;
  }> = [{
    contentStart: 0,
    index: 0,
    node: doc,
    offset: 0,
  }];

  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    if (frame.index >= frame.node.childCount) {
      stack.pop();
      continue;
    }
    if (scannedNodes >= maxScanNodes) {
      return;
    }

    const node = frame.node.child(frame.index);
    const pos = frame.contentStart + frame.offset;
    frame.index += 1;
    frame.offset += node.nodeSize;

    if (pos >= to) {
      frame.index = frame.node.childCount;
      continue;
    }
    if (pos + node.nodeSize <= from) {
      continue;
    }

    scannedNodes += 1;
    const shouldDescend = visit(node, pos);
    if (shouldDescend === false || node.childCount === 0) {
      continue;
    }

    stack.push({
      contentStart: pos + 1,
      index: 0,
      node,
      offset: 0,
    });
  }
}

export function addTextSelectionOverlayDecorationsForRange(
  decorations: Decoration[],
  doc: ProseNode,
  from: number,
  to: number,
  options: {
    includeAtomicBlocks?: boolean;
    maxScanNodes?: number;
  } = {}
): void {
  forEachTextSelectionOverlayNode(doc, from, to, (node, pos) => {
    if (decorations.length >= MAX_TEXT_SELECTION_OVERLAY_DECORATIONS) {
      return false;
    }

    if (
      options.includeAtomicBlocks &&
      ATOMIC_TEXT_SELECTION_OVERLAY_NODE_NAMES.has(node.type.name) &&
      from <= pos &&
      pos + node.nodeSize <= to
    ) {
      if (decorations.length >= MAX_TEXT_SELECTION_OVERLAY_DECORATIONS) {
        return false;
      }
      decorations.push(Decoration.node(pos, pos + node.nodeSize, {
        class: 'editor-block-selected md-focus editor-atomic-selected',
      }));
      return false;
    }

    if (!node.isText) return undefined;
    addTextSelectionOverlayDecorations(
      decorations,
      node.text ?? '',
      pos,
      from,
      to
    );
    return undefined;
  }, options.maxScanNodes ?? MAX_TEXT_SELECTION_OVERLAY_SCAN_NODES);
}

export function createTextSelectionDecorationState(
  state: EditorState,
  maxScanNodes = MAX_TEXT_SELECTION_OVERLAY_SCAN_NODES
): Pick<TextSelectionOverlayState, 'decorationCount' | 'decorations'> {
  const { doc, selection } = state;
  if (!isTextSelectionOverlayEligible(state)) {
    return { decorationCount: 0, decorations: DecorationSet.empty };
  }

  const decorations: Decoration[] = [];
  addTextSelectionOverlayDecorationsForRange(
    decorations,
    doc,
    selection.from,
    selection.to,
    {
      includeAtomicBlocks: selection instanceof AllSelection,
      maxScanNodes,
    }
  );

  return {
    decorationCount: decorations.length,
    decorations: decorations.length > 0 ? DecorationSet.create(doc, decorations) : DecorationSet.empty,
  };
}

export const textSelectionOverlayPlugin = $prose(() => {
  return new Plugin({
    key: textSelectionOverlayPluginKey,
    state: {
      init(_, state) {
        const decorationState = createTextSelectionDecorationState(state);
        return {
          ...decorationState,
          usePointerNativeSelection: false,
        };
      },
      apply(tr, previous, _oldState, newState) {
        const pointerNativeMeta = tr.getMeta(POINTER_NATIVE_SELECTION_META) as boolean | undefined;
        const usePointerNativeSelection = pointerNativeMeta ?? (
          newState.selection instanceof TextSelection
            ? tr.docChanged && newState.selection.empty ? false : previous.usePointerNativeSelection
            : false
        );
        if (!tr.docChanged && !tr.selectionSet && pointerNativeMeta === undefined) return previous;
        const decorationState = usePointerNativeSelection
          ? { decorationCount: 0, decorations: DecorationSet.empty }
          : createTextSelectionDecorationState(newState);
        return {
          ...decorationState,
          usePointerNativeSelection,
        };
      },
    },
    props: {
      decorations(state) {
        return textSelectionOverlayPluginKey.getState(state)?.decorations ?? DecorationSet.empty;
      },
    },
    view(view) {
      let lastClassSignature = '';
      let keyClearFrame: number | null = null;
      let pointerNativeReleaseFrame: number | null = null;
      let pointerClickCollapseFrame: number | null = null;
      let pointerClickCollapseTimeout: number | null = null;
      let clearNativeSelectionFrame: number | null = null;
      let keyboardSelectionPendingCleanupTimeout: number | null = null;
      let isPointerSelectionActive = false;
      let pointerDownPoint: { x: number; y: number } | null = null;
      let pointerMovedSinceDown = false;
      let pointerClickCollapseTarget: PointerCaretTarget | null = null;
      let pendingPointerClickCollapseTarget: PointerCaretTarget | null = null;
      let pointerClickRestoreSelectionRange: PointerClickRestoreSelectionRange | null = null;
      let preserveNativeSelectionForKeyboard = false;

      const setPointerNativeSelection = (nextValue: boolean) => {
        const currentValue = Boolean(
          textSelectionOverlayPluginKey.getState(view.state)?.usePointerNativeSelection
        );
        if (currentValue === nextValue) return;
        view.dispatch(
          view.state.tr
            .setMeta(POINTER_NATIVE_SELECTION_META, nextValue)
            .setMeta('addToHistory', false)
        );
      };

      const getCaretTargetFromPoint = (event: MouseEvent): PointerCaretTarget | null => {
        const ownerDocument = view.dom.ownerDocument as Document & {
          caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
          caretRangeFromPoint?: (x: number, y: number) => Range | null;
        };
        const textNodeTarget = getTextNodeCaretTargetFromPoint(event);
        if (textNodeTarget !== null) {
          return textNodeTarget;
        }

        const caretPosition = ownerDocument.caretPositionFromPoint?.(event.clientX, event.clientY);
        const caretRange = caretPosition
          ? null
          : ownerDocument.caretRangeFromPoint?.(event.clientX, event.clientY);
        const node = caretPosition?.offsetNode ?? caretRange?.startContainer ?? null;
        const offset = caretPosition?.offset ?? caretRange?.startOffset ?? null;

        if (node && offset !== null && view.dom.contains(node)) {
          try {
            return {
              node,
              offset,
              pos: view.posAtDOM(node, offset),
            };
          } catch {
          }
        }

        const coordsPos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ?? null;
        return coordsPos === null ? null : { pos: coordsPos };
      };

      const getDomCaretTarget = (target: PointerCaretTarget): PointerCaretTarget | null => {
        if (target.node && target.offset !== undefined && view.dom.contains(target.node)) {
          return target;
        }

        try {
          const nextPos = Math.max(0, Math.min(view.state.doc.content.size, target.pos));
          const domTarget = view.domAtPos(nextPos);
          if (domTarget.node !== view.dom && !view.dom.contains(domTarget.node)) {
            return null;
          }

          return {
            node: domTarget.node,
            offset: domTarget.offset,
            pos: nextPos,
          };
        } catch {
          return null;
        }
      };

      const syncNativeSelectionToCaretTarget = (target: PointerCaretTarget) => {
        const domTarget = getDomCaretTarget(target);
        if (!domTarget?.node || domTarget.offset === undefined) return;
        const ownerDocument = view.dom.ownerDocument;
        const nativeSelection = ownerDocument.defaultView?.getSelection();
        if (!nativeSelection) return;

        const range = ownerDocument.createRange();
        try {
          range.setStart(domTarget.node, domTarget.offset);
          range.collapse(true);
          nativeSelection.removeAllRanges();
          nativeSelection.addRange(range);
        } catch {
        } finally {
          range.detach();
        }
      };

      const collapsePointerNativeSelectionAt = (target: PointerCaretTarget) => {
        const nextPos = Math.max(0, Math.min(view.state.doc.content.size, target.pos));
        const tr = view.state.tr
          .setSelection(TextSelection.create(view.state.doc, nextPos))
          .setMeta(floatingToolbarKey, {
            type: TOOLBAR_ACTIONS.HIDE,
          })
          .setMeta(POINTER_NATIVE_SELECTION_META, false)
          .setMeta('addToHistory', false)
          .scrollIntoView();
        view.dispatch(tr);
        if (!view.state.selection.eq(tr.selection)) {
          const nextState = view.state.apply(tr);
          view.updateState(nextState);
        }
        view.focus();
        syncNativeSelectionToCaretTarget({ ...target, pos: nextPos });
        syncActiveClass();
      };

      const cancelPointerClickCollapseReassertion = () => {
        if (pointerClickCollapseFrame !== null) {
          cancelAnimationFrame(pointerClickCollapseFrame);
          pointerClickCollapseFrame = null;
        }
        if (pointerClickCollapseTimeout !== null) {
          window.clearTimeout(pointerClickCollapseTimeout);
          pointerClickCollapseTimeout = null;
        }
      };

      const shouldReassertPointerClickCollapse = (target: PointerCaretTarget) =>
        pendingPointerClickCollapseTarget === target && !pointerMovedSinceDown;

      const reassertPointerClickCollapse = (target: PointerCaretTarget) => {
        if (!shouldReassertPointerClickCollapse(target)) return;
        collapsePointerNativeSelectionAt(target);
      };

      const schedulePointerClickCollapseReassertion = (target: PointerCaretTarget) => {
        cancelPointerClickCollapseReassertion();

        queueMicrotask(() => {
          reassertPointerClickCollapse(target);
        });
        pointerClickCollapseFrame = requestAnimationFrame(() => {
          pointerClickCollapseFrame = null;
          reassertPointerClickCollapse(target);
        });
        pointerClickCollapseTimeout = window.setTimeout(() => {
          pointerClickCollapseTimeout = null;
          reassertPointerClickCollapse(target);
        }, 0);
      };

      const restorePointerClickSelectionRange = () => {
        const range = pointerClickRestoreSelectionRange;
        pointerClickRestoreSelectionRange = null;
        if (!range) return;

        const maxPos = view.state.doc.content.size;
        const from = Math.max(0, Math.min(range.from, maxPos));
        const to = Math.max(from, Math.min(range.to, maxPos));
        try {
          view.dispatch(
            view.state.tr
              .setSelection(TextSelection.create(view.state.doc, from, to))
              .setMeta(POINTER_NATIVE_SELECTION_META, range.usePointerNativeSelection)
              .setMeta('addToHistory', false)
          );
        } catch {
        }
        syncActiveClass();
      };

      const getTextNodeCaretTargetFromPoint = (event: MouseEvent): PointerCaretTarget | null => {
        const ownerDocument = view.dom.ownerDocument;
        const hitElement = ownerDocument.elementFromPoint(event.clientX, event.clientY);
        const root = hitElement && view.dom.contains(hitElement) ? hitElement : view.dom;
        const walker = ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const range = ownerDocument.createRange();
        let best: { distance: number; node: Text; offset: number } | null = null;

        try {
          while (walker.nextNode()) {
            const textNode = walker.currentNode as Text;
            if (!textNode.data) continue;

            range.selectNodeContents(textNode);
            const textNodeRects = Array.from(range.getClientRects());
            const isOnClickedLine = textNodeRects.some((rect) =>
              rect.width > 0 &&
              rect.height > 0 &&
              event.clientY >= rect.top - 3 &&
              event.clientY <= rect.bottom + 3
            );
            if (!isOnClickedLine) continue;

            for (let offset = 0; offset < textNode.data.length; offset += 1) {
              range.setStart(textNode, offset);
              range.setEnd(textNode, offset + 1);
              for (const rect of Array.from(range.getClientRects())) {
                if (rect.width <= 0 || rect.height <= 0) continue;
                const verticalDistance = event.clientY < rect.top
                  ? rect.top - event.clientY
                  : event.clientY > rect.bottom
                    ? event.clientY - rect.bottom
                    : 0;
                if (verticalDistance > Math.max(4, rect.height / 2)) continue;

                const horizontalDistance = event.clientX < rect.left
                  ? rect.left - event.clientX
                  : event.clientX > rect.right
                    ? event.clientX - rect.right
                    : 0;
                const centerY = rect.top + rect.height / 2;
                const distance = horizontalDistance + Math.abs(event.clientY - centerY) * 2;
                if (best && distance >= best.distance) continue;

                best = {
                  distance,
                  node: textNode,
                  offset: event.clientX <= rect.left + rect.width / 2 ? offset : offset + 1,
                };
              }
            }
          }
        } finally {
          range.detach();
        }

        if (!best) return null;
        try {
          return {
            node: best.node,
            offset: best.offset,
            pos: view.posAtDOM(best.node, best.offset),
          };
        } catch {
          return null;
        }
      };

      const scheduleClearNativeSelection = () => {
        if (clearNativeSelectionFrame !== null) return;

        clearNativeSelectionFrame = requestAnimationFrame(() => {
          clearNativeSelectionFrame = null;
          const nativeSelection = getNativeSelectionMetrics();
          const shouldClearNativeRangeForOverlay =
            !isPointerSelectionActive &&
            !preserveNativeSelectionForKeyboard &&
            isTextSelectionOverlayEligible(view.state) &&
            nativeSelection &&
            !nativeSelection.isCollapsed &&
            nativeSelection.rectCount > 0 &&
            !textSelectionOverlayPluginKey.getState(view.state)?.usePointerNativeSelection;

          if (shouldClearNativeRangeForOverlay) {
            clearNativeSelectionRange();
          }
        });
      };

      const syncActiveClass = () => {
        const pluginState = textSelectionOverlayPluginKey.getState(view.state);
        const usePointerNativeSelection = Boolean(pluginState?.usePointerNativeSelection);
        const active = isTextSelectionOverlayEligible(view.state);
        if (!active) {
          preserveNativeSelectionForKeyboard = false;
        }
        view.dom.classList.toggle(TEXT_SELECTION_OVERLAY_ACTIVE_CLASS, active);
        view.dom.classList.toggle(POINTER_NATIVE_SELECTION_CLASS, usePointerNativeSelection);
        if (active || !usePointerNativeSelection) {
          view.dom.classList.remove(KEYBOARD_SELECTION_PENDING_CLASS);
        }
        const classSignature = [
          active ? 'overlay-active' : 'overlay-inactive',
          usePointerNativeSelection ? 'native-active' : 'native-inactive',
          pluginState?.decorationCount ?? 0,
        ].join(':');
        if (classSignature !== lastClassSignature) {
          lastClassSignature = classSignature;
          const nativeSelection = getNativeSelectionMetrics();
          if (
            active &&
            nativeSelection &&
            !nativeSelection.isCollapsed &&
            nativeSelection.rectCount > 0
          ) {
            scheduleClearNativeSelection();
          }
        }
      };

      const handleMouseDown = (event: MouseEvent) => {
        if (event.button !== 0) return;
        preserveNativeSelectionForKeyboard = false;
        isPointerSelectionActive = true;
        pointerMovedSinceDown = false;
        pointerDownPoint = { x: event.clientX, y: event.clientY };
        pointerClickCollapseTarget = null;
        pendingPointerClickCollapseTarget = null;
        pointerClickRestoreSelectionRange = null;
        const shouldMaybeCollapseTextSelectionClick =
          isTextSelectionOverlayEligible(view.state) &&
          (event.clientX !== 0 || event.clientY !== 0) &&
          !event.shiftKey &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey;
        if (shouldMaybeCollapseTextSelectionClick) {
          const restoreSelectionRange = {
            from: view.state.selection.from,
            to: view.state.selection.to,
            usePointerNativeSelection: Boolean(
              textSelectionOverlayPluginKey.getState(view.state)?.usePointerNativeSelection
            ),
          };
          const clickedTarget = getCaretTargetFromPoint(event);
          if (clickedTarget !== null) {
            pointerClickCollapseTarget = clickedTarget;
            pendingPointerClickCollapseTarget = clickedTarget;
            pointerClickRestoreSelectionRange = restoreSelectionRange;
            event.preventDefault();
            event.stopImmediatePropagation();
            collapsePointerNativeSelectionAt(clickedTarget);
            schedulePointerClickCollapseReassertion(clickedTarget);
            return;
          }
        }
        if (!pointerClickCollapseTarget) {
          setPointerNativeSelection(true);
        }
        syncActiveClass();
      };

      const handleMouseMove = (event: MouseEvent) => {
        if (!isPointerSelectionActive || !pointerDownPoint || pointerMovedSinceDown) return;
        const deltaX = event.clientX - pointerDownPoint.x;
        const deltaY = event.clientY - pointerDownPoint.y;
        pointerMovedSinceDown = Math.hypot(deltaX, deltaY) > 4;
        if (pointerMovedSinceDown) {
          cancelPointerClickCollapseReassertion();
          restorePointerClickSelectionRange();
          pointerClickCollapseTarget = null;
          pendingPointerClickCollapseTarget = null;
        }
      };

      const handleKeyDown = (event: KeyboardEvent) => {
        const isModifiedNavigation =
          NAVIGATION_KEYS_THAT_CLEAR_NATIVE_SELECTION.has(event.key) &&
          isModifiedNavigationKey(event);
        const shouldSuppressInitialKeyboardSelection =
          isModifiedNavigation &&
          event.shiftKey &&
          view.state.selection.empty;

        if (isModifiedNavigation && event.shiftKey) {
          preserveNativeSelectionForKeyboard = true;
        }

        if (shouldSuppressInitialKeyboardSelection) {
          view.dom.classList.add(KEYBOARD_SELECTION_PENDING_CLASS);
          if (keyboardSelectionPendingCleanupTimeout !== null) {
            window.clearTimeout(keyboardSelectionPendingCleanupTimeout);
          }
          keyboardSelectionPendingCleanupTimeout = window.setTimeout(() => {
            keyboardSelectionPendingCleanupTimeout = null;
            if (!isTextSelectionOverlayEligible(view.state)) {
              view.dom.classList.remove(KEYBOARD_SELECTION_PENDING_CLASS);
            }
          }, 160);
        }

        if (
          isModifiedNavigation &&
          isTextSelectionOverlayEligible(view.state) &&
          !textSelectionOverlayPluginKey.getState(view.state)?.usePointerNativeSelection
        ) {
          scheduleClearNativeSelection();
          return;
        }

        const shouldClearForKey =
          event.key === 'Escape' ||
          (
            NAVIGATION_KEYS_THAT_CLEAR_NATIVE_SELECTION.has(event.key) &&
            !isModifiedNavigationKey(event)
          );

        if (!shouldClearForKey) {
          return;
        }

        if (keyClearFrame !== null) {
          cancelAnimationFrame(keyClearFrame);
        }

        keyClearFrame = requestAnimationFrame(() => {
          keyClearFrame = null;
          setPointerNativeSelection(false);
          syncActiveClass();
        });
      };

      const handleMouseUp = (event: MouseEvent) => {
        isPointerSelectionActive = false;
        const clickCollapseTarget = pointerClickCollapseTarget;
        const shouldCollapsePointerClick = clickCollapseTarget !== null && !pointerMovedSinceDown;
        pointerClickCollapseTarget = null;
        pointerDownPoint = null;
        pointerMovedSinceDown = false;
        if (pointerNativeReleaseFrame !== null) {
          cancelAnimationFrame(pointerNativeReleaseFrame);
          pointerNativeReleaseFrame = null;
        }

        if (shouldCollapsePointerClick) {
          event.preventDefault();
          event.stopImmediatePropagation();
          pendingPointerClickCollapseTarget = clickCollapseTarget;
          pointerClickRestoreSelectionRange = null;
          collapsePointerNativeSelectionAt(clickCollapseTarget);
          schedulePointerClickCollapseReassertion(clickCollapseTarget);
          return;
        }

        pendingPointerClickCollapseTarget = null;
        pointerClickRestoreSelectionRange = null;
        cancelPointerClickCollapseReassertion();
        pointerNativeReleaseFrame = requestAnimationFrame(() => {
          pointerNativeReleaseFrame = null;
          const usePointerNativeSelection = Boolean(
            textSelectionOverlayPluginKey.getState(view.state)?.usePointerNativeSelection
          );
          if (!usePointerNativeSelection) return;

          if (isTextSelectionOverlayEligible(view.state)) return;

          const nativeSelection = getNativeSelectionMetrics();
          if (view.state.selection.empty && (!nativeSelection || nativeSelection.isCollapsed)) {
            setPointerNativeSelection(false);
            syncActiveClass();
          }
        });

        if (isTextSelectionOverlayEligible(view.state)) {
          scheduleClearNativeSelection();
        }
      };

      const handleClick = (event: MouseEvent) => {
        if (pendingPointerClickCollapseTarget === null) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const target = pendingPointerClickCollapseTarget;
        pendingPointerClickCollapseTarget = null;
        cancelPointerClickCollapseReassertion();
        if (pointerNativeReleaseFrame !== null) {
          cancelAnimationFrame(pointerNativeReleaseFrame);
          pointerNativeReleaseFrame = null;
        }
        syncNativeSelectionToCaretTarget(target);
        collapsePointerNativeSelectionAt(target);
      };

      const handleWindowBlur = () => {
        isPointerSelectionActive = false;
        pendingPointerClickCollapseTarget = null;
        pointerClickRestoreSelectionRange = null;
        cancelPointerClickCollapseReassertion();
        preserveNativeSelectionForKeyboard = false;
        syncActiveClass();
      };

      const ownerDocument = view.dom.ownerDocument;
      view.dom.addEventListener('mousedown', handleMouseDown, true);
      view.dom.addEventListener('keydown', handleKeyDown);
      ownerDocument.addEventListener('mousemove', handleMouseMove, true);
      ownerDocument.addEventListener('mouseup', handleMouseUp, true);
      view.dom.addEventListener('click', handleClick, true);
      window.addEventListener('blur', handleWindowBlur);
      syncActiveClass();
      return {
        update() {
          syncActiveClass();
        },
        destroy() {
          if (keyClearFrame !== null) {
            cancelAnimationFrame(keyClearFrame);
          }
          if (keyboardSelectionPendingCleanupTimeout !== null) {
            window.clearTimeout(keyboardSelectionPendingCleanupTimeout);
            keyboardSelectionPendingCleanupTimeout = null;
          }
          view.dom.classList.remove(KEYBOARD_SELECTION_PENDING_CLASS);
          if (pointerNativeReleaseFrame !== null) {
            cancelAnimationFrame(pointerNativeReleaseFrame);
          }
          cancelPointerClickCollapseReassertion();
          if (clearNativeSelectionFrame !== null) {
            cancelAnimationFrame(clearNativeSelectionFrame);
          }
          view.dom.removeEventListener('mousedown', handleMouseDown, true);
          view.dom.removeEventListener('keydown', handleKeyDown);
          ownerDocument.removeEventListener('mousemove', handleMouseMove, true);
          ownerDocument.removeEventListener('mouseup', handleMouseUp, true);
          view.dom.removeEventListener('click', handleClick, true);
          window.removeEventListener('blur', handleWindowBlur);
          view.dom.classList.remove(TEXT_SELECTION_OVERLAY_ACTIVE_CLASS);
          view.dom.classList.remove(POINTER_NATIVE_SELECTION_CLASS);
          view.dom.classList.remove(KEYBOARD_SELECTION_PENDING_CLASS);
        },
      };
    },
  });
});
