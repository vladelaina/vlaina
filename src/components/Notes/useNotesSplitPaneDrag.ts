import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
} from 'react';
import { requestNativeCaretOverlayRefresh } from '@/hooks/useNativeCaretOverlay';
import { useUIStore } from '@/stores/uiSlice';
import { themeDomStyleTokens, themeRenderingTokens } from '@/styles/themeTokens';
import {
  moveNotesSplitPaneLeaf,
  type NotesSplitPaneTree,
} from './features/Split/notesSplitLayout';
import { SPLIT_PANE_DRAG_THRESHOLD_PX } from './notesViewHelpers';
import type {
  ActiveNotesSplitPaneDrag,
  ActiveNotesSplitResize,
  NotesSplitDropTarget,
} from './notesViewSplitTypes';

export function useNotesSplitPaneDrag(args: {
  active: boolean;
  activeSplitResizeRef: MutableRefObject<ActiveNotesSplitResize | null>;
  hasSplitPanes: boolean;
  nextSplitPaneId: (prefix: 'preview' | 'split') => string;
  resolveSplitDropTarget: (detail: {
    path: string;
    clientX?: number;
    clientY?: number;
    sourceLeafId?: string;
  }) => NotesSplitDropTarget | null;
  setSplitDropTarget: Dispatch<SetStateAction<NotesSplitDropTarget | null>>;
  setSplitPaneTree: Dispatch<SetStateAction<NotesSplitPaneTree>>;
  stopSplitResize: () => void;
}) {
  const {
    active,
    activeSplitResizeRef,
    hasSplitPanes,
    nextSplitPaneId,
    resolveSplitDropTarget,
    setSplitDropTarget,
    setSplitPaneTree,
    stopSplitResize,
  } = args;
  const setLayoutPanelDragging = useUIStore((s) => s.setLayoutPanelDragging);
  const activeSplitPaneDragRef = useRef<ActiveNotesSplitPaneDrag | null>(null);
  const stopSplitPaneDragRef = useRef<((event?: PointerEvent, commit?: boolean) => void) | null>(null);

  const handleSplitPaneDragPointerMove = useCallback((event: PointerEvent) => {
    const drag = activeSplitPaneDragRef.current;
    if (!drag) {
      return;
    }

    event.preventDefault();
    const distance = Math.hypot(
      event.clientX - drag.initialClientX,
      event.clientY - drag.initialClientY,
    );
    if (!drag.hasMoved && distance < SPLIT_PANE_DRAG_THRESHOLD_PX) {
      return;
    }

    drag.hasMoved = true;
    setSplitDropTarget(resolveSplitDropTarget({
      path: '',
      sourceLeafId: drag.sourceLeafId,
      clientX: event.clientX,
      clientY: event.clientY,
    }));
  }, [resolveSplitDropTarget, setSplitDropTarget]);

  const handleSplitPaneDragPointerUp = useCallback((event: PointerEvent) => {
    event.preventDefault();
    stopSplitPaneDragRef.current?.(event, true);
  }, []);

  const handleSplitPaneDragPointerCancel = useCallback(() => {
    stopSplitPaneDragRef.current?.();
  }, []);

  const stopSplitPaneDrag = useCallback((
    event?: PointerEvent,
    commit = false,
  ) => {
    const drag = activeSplitPaneDragRef.current;
    if (!drag) {
      return;
    }

    document.removeEventListener('pointermove', handleSplitPaneDragPointerMove, true);
    document.removeEventListener('pointerup', handleSplitPaneDragPointerUp, true);
    document.removeEventListener('pointercancel', handleSplitPaneDragPointerCancel, true);
    document.body.style.cursor = drag.previousBodyCursor;
    document.body.style.userSelect = drag.previousBodyUserSelect;
    activeSplitPaneDragRef.current = null;
    setSplitDropTarget(null);
    setLayoutPanelDragging(false);
    requestNativeCaretOverlayRefresh();

    if (!commit || !event || !drag.hasMoved) {
      return;
    }

    const target = resolveSplitDropTarget({
      path: '',
      sourceLeafId: drag.sourceLeafId,
      clientX: event.clientX,
      clientY: event.clientY,
    });
    if (!target || target.leafId === drag.sourceLeafId) {
      return;
    }

    setSplitPaneTree((currentTree) => moveNotesSplitPaneLeaf(
      currentTree,
      drag.sourceLeafId,
      target.leafId,
      target.direction,
      nextSplitPaneId('split'),
    ));
  }, [
    handleSplitPaneDragPointerMove,
    handleSplitPaneDragPointerCancel,
    handleSplitPaneDragPointerUp,
    nextSplitPaneId,
    resolveSplitDropTarget,
    setLayoutPanelDragging,
    setSplitDropTarget,
    setSplitPaneTree,
  ]);
  stopSplitPaneDragRef.current = stopSplitPaneDrag;

  const beginSplitPaneDrag = useCallback((
    event: ReactPointerEvent<HTMLDivElement>,
    sourceLeafId: string,
  ) => {
    if (!active || !hasSplitPanes) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    if (activeSplitResizeRef.current) {
      stopSplitResize();
    }
    if (activeSplitPaneDragRef.current) {
      stopSplitPaneDrag();
    }

    activeSplitPaneDragRef.current = {
      hasMoved: false,
      initialClientX: event.clientX,
      initialClientY: event.clientY,
      previousBodyCursor: document.body.style.cursor,
      previousBodyUserSelect: document.body.style.userSelect,
      sourceLeafId,
    };
    document.body.style.cursor = themeDomStyleTokens.cursorGrabbing;
    document.body.style.userSelect = themeRenderingTokens.userSelectNone;
    setLayoutPanelDragging(true);
    document.addEventListener('pointermove', handleSplitPaneDragPointerMove, true);
    document.addEventListener('pointerup', handleSplitPaneDragPointerUp, true);
    document.addEventListener('pointercancel', handleSplitPaneDragPointerCancel, true);
  }, [
    active,
    activeSplitResizeRef,
    handleSplitPaneDragPointerCancel,
    handleSplitPaneDragPointerMove,
    handleSplitPaneDragPointerUp,
    hasSplitPanes,
    setLayoutPanelDragging,
    stopSplitPaneDrag,
    stopSplitResize,
  ]);

  useEffect(() => {
    return () => {
      stopSplitPaneDrag();
    };
  }, [stopSplitPaneDrag]);

  return { beginSplitPaneDrag };
}
