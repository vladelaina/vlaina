import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { themeDomStyleTokens, themeRenderingTokens, themeStyleResetTokens } from '@/styles/themeTokens';

type ResizeDragEventType = 'mouse' | 'pointer';
type ResizeDragListenTarget = 'document' | 'window';
type ResizeDragLiveUpdateMode = 'animation-frame' | 'sync';
type NativeResizeDragEvent = MouseEvent | PointerEvent;
type ResizeDragCursor<TContext> = string | ((context: TContext) => string);

export type ResizeDragStartEvent<TElement extends Element = HTMLElement> =
  | ReactMouseEvent<TElement>
  | ReactPointerEvent<TElement>;

interface ResizeDragComputeParams<TValue, TContext> {
  context: TContext;
  startValue: TValue;
  startClientX: number;
  startClientY: number;
  clientX: number;
  clientY: number;
  event: NativeResizeDragEvent;
}

interface UseResizeDragSessionOptions<TValue, TContext = undefined> {
  value: TValue;
  defaultValue: TValue;
  onValueChange: (value: TValue) => void;
  onValueCommit?: (value: TValue) => void;
  onDragStateChange?: (isDragging: boolean) => void;
  computeNextValue: (params: ResizeDragComputeParams<TValue, TContext>) => TValue;
  valuesEqual?: (left: TValue, right: TValue) => boolean;
  cursor: ResizeDragCursor<TContext>;
  eventType?: ResizeDragEventType;
  listenTarget?: ResizeDragListenTarget;
  liveUpdateMode?: ResizeDragLiveUpdateMode;
  useOverlay?: boolean;
  allowDoubleClickReset?: boolean;
}

function defaultValuesEqual<TValue>(left: TValue, right: TValue): boolean {
  return Object.is(left, right);
}

export function useResizeDragSession<TValue, TContext = undefined>({
  value,
  defaultValue,
  onValueChange,
  onValueCommit,
  onDragStateChange,
  computeNextValue,
  valuesEqual = defaultValuesEqual,
  cursor,
  eventType = 'mouse',
  listenTarget = 'document',
  liveUpdateMode = 'animation-frame',
  useOverlay = false,
  allowDoubleClickReset = true,
}: UseResizeDragSessionOptions<TValue, TContext>) {
  const [isDragging, setIsDragging] = useState(false);
  const currentValueRef = useRef(value);
  const pendingValueRef = useRef<TValue | null>(null);
  const rafRef = useRef<number | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const dragStateRef = useRef(false);
  const isMountedRef = useRef(true);
  const latestOptionsRef = useRef({
    value,
    defaultValue,
    onValueChange,
    onValueCommit,
    onDragStateChange,
    computeNextValue,
    valuesEqual,
    cursor,
    eventType,
    listenTarget,
    liveUpdateMode,
    useOverlay,
    allowDoubleClickReset,
  });

  latestOptionsRef.current = {
    value,
    defaultValue,
    onValueChange,
    onValueCommit,
    onDragStateChange,
    computeNextValue,
    valuesEqual,
    cursor,
    eventType,
    listenTarget,
    liveUpdateMode,
    useOverlay,
    allowDoubleClickReset,
  };

  const notifyDragState = useCallback((next: boolean) => {
    if (dragStateRef.current === next) {
      return;
    }
    dragStateRef.current = next;
    latestOptionsRef.current.onDragStateChange?.(next);
  }, []);

  useEffect(() => {
    if (!dragStateRef.current) {
      currentValueRef.current = value;
    }
  }, [value]);

  const flushPendingValue = useCallback(() => {
    if (pendingValueRef.current === null) {
      return currentValueRef.current;
    }

    const nextValue = pendingValueRef.current;
    pendingValueRef.current = null;
    latestOptionsRef.current.onValueChange(nextValue);
    currentValueRef.current = nextValue;
    return nextValue;
  }, []);

  const resetToDefaultValue = useCallback(() => {
    cleanupRef.current?.();
    const nextValue = latestOptionsRef.current.defaultValue;
    currentValueRef.current = nextValue;
    pendingValueRef.current = null;
    latestOptionsRef.current.onValueChange(nextValue);
    latestOptionsRef.current.onValueCommit?.(nextValue);
  }, []);

  const beginDrag = useCallback((
    event: ResizeDragStartEvent,
    context: TContext = undefined as TContext,
  ) => {
    event.preventDefault();

    const options = latestOptionsRef.current;
    if (options.allowDoubleClickReset && event.detail === 2) {
      resetToDefaultValue();
      return;
    }

    cleanupRef.current?.();

    const startClientX = event.clientX;
    const startClientY = event.clientY;
    const startValue = options.value;
    const dragCursor = typeof options.cursor === 'function' ? options.cursor(context) : options.cursor;
    const previousBodyCursor = document.body.style.cursor;
    const previousBodyUserSelect = document.body.style.userSelect;
    let didCreateOverlay = false;
    let cleanedUp = false;

    currentValueRef.current = startValue;
    setIsDragging(true);
    notifyDragState(true);

    document.body.style.userSelect = themeRenderingTokens.userSelectNone;
    document.body.style.cursor = dragCursor;

    if (options.useOverlay) {
      const overlay = document.createElement('div');
      overlay.id = 'resize-overlay';
      overlay.style.position = themeDomStyleTokens.positionFixed;
      overlay.style.inset = themeDomStyleTokens.sizeZero;
      overlay.style.zIndex = themeDomStyleTokens.zIndexResizeOverlay;
      overlay.style.cursor = dragCursor;
      overlay.style.pointerEvents = themeStyleResetTokens.pointerEventsNone;
      document.body.appendChild(overlay);
      didCreateOverlay = true;
    }

    const scheduleValueChange = (nextValue: TValue) => {
      pendingValueRef.current = nextValue;

      if (latestOptionsRef.current.liveUpdateMode === 'sync') {
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        flushPendingValue();
        return;
      }

      if (rafRef.current !== null) {
        return;
      }

      rafRef.current = requestAnimationFrame(() => {
        flushPendingValue();
        rafRef.current = null;
      });
    };

    const handleMove = (moveEvent: NativeResizeDragEvent) => {
      moveEvent.preventDefault();

      const latestOptions = latestOptionsRef.current;
      const nextValue = latestOptions.computeNextValue({
        context,
        startValue,
        startClientX,
        startClientY,
        clientX: moveEvent.clientX,
        clientY: moveEvent.clientY,
        event: moveEvent,
      });

      if (latestOptions.valuesEqual(currentValueRef.current, nextValue)) {
        return;
      }

      currentValueRef.current = nextValue;
      scheduleValueChange(nextValue);
    };

    const finishDrag = () => {
      cleanup();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        cleanup();
      }
    };

    const target = options.listenTarget === 'window' ? window : document;
    const moveEventName = options.eventType === 'pointer' ? 'pointermove' : 'mousemove';
    const endEventName = options.eventType === 'pointer' ? 'pointerup' : 'mouseup';
    const cancelEventName = options.eventType === 'pointer' ? 'pointercancel' : null;

    const cleanup = () => {
      if (cleanedUp) {
        return;
      }

      cleanedUp = true;
      target.removeEventListener(moveEventName, handleMove as EventListener);
      target.removeEventListener(endEventName, finishDrag);
      if (cancelEventName) {
        target.removeEventListener(cancelEventName, finishDrag);
      }
      window.removeEventListener('blur', finishDrag);
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      const committedValue = flushPendingValue();

      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      if (didCreateOverlay) {
        document.getElementById('resize-overlay')?.remove();
      }

      document.body.style.cursor = previousBodyCursor;
      document.body.style.userSelect = previousBodyUserSelect;
      if (isMountedRef.current) {
        setIsDragging(false);
      }
      notifyDragState(false);
      latestOptionsRef.current.onValueCommit?.(committedValue);

      if (cleanupRef.current === cleanup) {
        cleanupRef.current = null;
      }
    };

    cleanupRef.current = cleanup;
    target.addEventListener(moveEventName, handleMove as EventListener);
    target.addEventListener(endEventName, finishDrag);
    if (cancelEventName) {
      target.addEventListener(cancelEventName, finishDrag);
    }
    window.addEventListener('blur', finishDrag);
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }, [flushPendingValue, notifyDragState, resetToDefaultValue]);

  useEffect(() => () => {
    isMountedRef.current = false;
    cleanupRef.current?.();
    cleanupRef.current = null;
  }, []);

  return {
    isDragging,
    beginDrag,
    resetToDefaultValue,
  };
}
