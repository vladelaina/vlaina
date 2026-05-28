import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/ui/icons";
import { focusComposerInput, insertTextIntoComposer } from "@/lib/ui/composerFocusRegistry";
import { cn, iconButtonStyles } from "@/lib/utils";
import {
  canStartChatSelection,
  computeStateFromSelection,
  createSelectionSnapshot,
  getSelectionTextForComposer,
  getStateSignature,
  isInsideChatScrollable,
  isInsideSelectionSurface,
  isInsideMessageItem,
  isInsideSelectionExcluded,
  isSameRange,
  isSelectionFullyInsideChatMessages,
  restoreSelectionSnapshot,
  resolveOutsideMoveDecision,
  setChatSelectionLock,
  type LastValidSelectionSnapshot,
  type SelectionInsertState,
} from "./chatSelectionBehavior";
import {
  dispatchChatSelectionStreamFreeze,
} from "./chatSelectionStreamFreeze";
import { useI18n } from "@/lib/i18n";

export function SelectionInsertButton() {
  const { t } = useI18n();
  const [state, setState] = useState<SelectionInsertState | null>(null);
  const [mounted, setMounted] = useState(false);
  const isSelectingFromChatRef = useRef(false);
  const isPointerInsideSelectionSurfaceRef = useRef(true);
  const isPointerInsideMessageItemRef = useRef(true);
  const isSelectionFrozenRef = useRef(false);
  const lastValidSelectionRef = useRef<LastValidSelectionSnapshot | null>(null);
  const isRestoringRangeRef = useRef(false);
  const lastStateSignatureRef = useRef<string>("");
  const isChatSelectionLockedRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const restoreLastValidSelection = (options?: { force?: boolean }) => {
      const force = options?.force ?? false;
      if (typeof window === "undefined") {
        return false;
      }
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        return false;
      }
      const range = selection.getRangeAt(0);
      const isRangeInsideChat = isSelectionFullyInsideChatMessages(selection, range);
      if (isRangeInsideChat && isPointerInsideSelectionSurfaceRef.current) {
        const normalizedText = getSelectionTextForComposer(selection, range);
        if (!normalizedText) {
          return false;
        }
        lastValidSelectionRef.current = createSelectionSnapshot(selection, range, normalizedText);
        return false;
      }
      if (!lastValidSelectionRef.current) {
        return false;
      }
      const currentText = getSelectionTextForComposer(selection, range);
      if (!force && currentText && currentText === lastValidSelectionRef.current.text) {
        return false;
      }
      if (!force && isSameRange(range, lastValidSelectionRef.current.range)) {
        return false;
      }
      isRestoringRangeRef.current = true;
      const didRestore = restoreSelectionSnapshot(selection, lastValidSelectionRef.current);
      isRestoringRangeRef.current = false;
      return didRestore;
    };

    let outsideClampRaf: number | null = null;
    let mouseUpRaf: number | null = null;
    const stopOutsideClamp = () => {
      if (outsideClampRaf !== null) {
        cancelAnimationFrame(outsideClampRaf);
        outsideClampRaf = null;
      }
    };
    const stopMouseUpRaf = () => {
      if (mouseUpRaf !== null) {
        cancelAnimationFrame(mouseUpRaf);
        mouseUpRaf = null;
      }
    };
    const resetSelectionInteractionState = () => {
      isSelectingFromChatRef.current = false;
      isPointerInsideSelectionSurfaceRef.current = true;
      isPointerInsideMessageItemRef.current = true;
      isSelectionFrozenRef.current = false;
      lastValidSelectionRef.current = null;
      stopOutsideClamp();
      if (isChatSelectionLockedRef.current) {
        isChatSelectionLockedRef.current = false;
        setChatSelectionLock(false);
      }
    };
    const setSelectionLockIfChanged = (active: boolean) => {
      if (isChatSelectionLockedRef.current === active) {
        return;
      }
      isChatSelectionLockedRef.current = active;
      setChatSelectionLock(active);
    };
    const startOutsideClamp = () => {
      if (outsideClampRaf !== null) {
        return;
      }
      const tick = () => {
        if (!isSelectingFromChatRef.current || !isSelectionFrozenRef.current) {
          outsideClampRaf = null;
          return;
        }
        restoreLastValidSelection({ force: true });
        outsideClampRaf = requestAnimationFrame(tick);
      };
      outsideClampRaf = requestAnimationFrame(tick);
    };

    const handleMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) {
        return;
      }
      const target = event.target;
      isSelectingFromChatRef.current = target instanceof Element && canStartChatSelection(target);
      if (
        !isSelectingFromChatRef.current &&
        target instanceof Element &&
        isInsideChatScrollable(target) &&
        !isInsideSelectionExcluded(target)
      ) {
        window.getSelection()?.removeAllRanges();
        lastStateSignatureRef.current = "";
        setState(null);
      }
      if (isSelectingFromChatRef.current && target instanceof Element) {
        dispatchChatSelectionStreamFreeze({
          button: event.button,
          clientX: event.clientX,
          clientY: event.clientY,
          source: "mousedown",
          target,
        });
      }
      isPointerInsideSelectionSurfaceRef.current =
        target instanceof Element && isInsideSelectionSurface(target);
      isPointerInsideMessageItemRef.current =
        target instanceof Element && isInsideMessageItem(target);
      isSelectionFrozenRef.current = false;
      lastValidSelectionRef.current = null;
      stopOutsideClamp();
      setSelectionLockIfChanged(false);
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!isSelectingFromChatRef.current) {
        return;
      }
      const target = event.target;
      isPointerInsideSelectionSurfaceRef.current =
        target instanceof Element && isInsideSelectionSurface(target);
      isPointerInsideMessageItemRef.current =
        target instanceof Element && isInsideMessageItem(target);
      const pointerInsideSelectionBoundary =
        isPointerInsideSelectionSurfaceRef.current || isPointerInsideMessageItemRef.current;
      const decision = resolveOutsideMoveDecision({
        isSelectingFromChat: isSelectingFromChatRef.current,
        pointerInsideSelectionSurface: pointerInsideSelectionBoundary,
        isSelectionFrozen: isSelectionFrozenRef.current,
      });
      if (decision.nextFrozen !== isSelectionFrozenRef.current) {
        isSelectionFrozenRef.current = decision.nextFrozen;
        setSelectionLockIfChanged(decision.nextFrozen);
        if (decision.nextFrozen) {
          startOutsideClamp();
        } else {
          stopOutsideClamp();
        }
      }
      if (!decision.shouldPreventDefault) {
        return;
      }
      event.preventDefault();
      if (decision.shouldRestore) {
        restoreLastValidSelection({ force: true });
      }
    };

    const handleSelectStart = (event: Event) => {
      if (
        !isSelectingFromChatRef.current ||
        isPointerInsideSelectionSurfaceRef.current ||
        isPointerInsideMessageItemRef.current
      ) {
        return;
      }
      event.preventDefault();
    };

    const handleMouseUp = () => {
      if (isSelectingFromChatRef.current && !isPointerInsideMessageItemRef.current) {
        restoreLastValidSelection({ force: true });
      }
      stopMouseUpRaf();
      mouseUpRaf = requestAnimationFrame(() => {
        mouseUpRaf = null;
        resetSelectionInteractionState();
        const nextState = computeStateFromSelection();
        lastStateSignatureRef.current = getStateSignature(nextState);
        setState(nextState);
      });
    };

    const handleForceReset = () => {
      resetSelectionInteractionState();
      const nextState = computeStateFromSelection();
      lastStateSignatureRef.current = getStateSignature(nextState);
      setState(nextState);
    };

    const handleWindowBlur = () => {
      resetSelectionInteractionState();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        resetSelectionInteractionState();
        lastStateSignatureRef.current = "";
        setState(null);
        return;
      }
      syncState();
    };

    const syncState = () => {
      if (isRestoringRangeRef.current || typeof window === "undefined") {
        return;
      }

      if (isSelectingFromChatRef.current) {
        const pointerInsideSelectionBoundary =
          isPointerInsideSelectionSurfaceRef.current || isPointerInsideMessageItemRef.current;
        if (isPointerInsideSelectionSurfaceRef.current) {
          restoreLastValidSelection();
        } else if (!pointerInsideSelectionBoundary) {
          restoreLastValidSelection({ force: true });
          return;
        }
      }

      const nextState = computeStateFromSelection();
      const nextStateSignature = getStateSignature(nextState);
      if (nextStateSignature === lastStateSignatureRef.current) {
        return;
      }
      lastStateSignatureRef.current = nextStateSignature;
      setState(nextState);
    };

    window.addEventListener("mousedown", handleMouseDown, true);
    window.addEventListener("mousemove", handleMouseMove, true);
    window.addEventListener("mouseup", handleMouseUp, true);
    document.addEventListener("selectstart", handleSelectStart, true);
    document.addEventListener("selectionchange", syncState);
    window.addEventListener("mouseup", syncState);
    window.addEventListener("keyup", syncState);
    window.addEventListener("resize", syncState);
    window.addEventListener("scroll", syncState, true);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("pagehide", handleForceReset);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      resetSelectionInteractionState();
      stopMouseUpRaf();
      window.removeEventListener("mousedown", handleMouseDown, true);
      window.removeEventListener("mousemove", handleMouseMove, true);
      window.removeEventListener("mouseup", handleMouseUp, true);
      document.removeEventListener("selectstart", handleSelectStart, true);
      document.removeEventListener("selectionchange", syncState);
      window.removeEventListener("mouseup", syncState);
      window.removeEventListener("keyup", syncState);
      window.removeEventListener("resize", syncState);
      window.removeEventListener("scroll", syncState, true);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("pagehide", handleForceReset);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const transformClass = useMemo(() => {
    if (!state) return "";
    return state.placeBelow ? "-translate-x-1/2" : "-translate-x-1/2 -translate-y-full";
  }, [state]);

  if (!mounted || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[115]">
      {state && (
        <button
          type="button"
          aria-label={t('chat.insertSelection')}
          data-no-focus-input="true"
          className={cn(
            "pointer-events-auto absolute h-8 w-8 rounded-full border border-black/10 bg-white shadow-md dark:border-white/10 dark:bg-zinc-900",
            "flex items-center justify-center",
            transformClass,
            iconButtonStyles
          )}
          style={{ left: `${state.x}px`, top: `${state.y}px` }}
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            const inserted = insertTextIntoComposer(state.text);
            if (!inserted) {
              return;
            }
            requestAnimationFrame(() => {
              focusComposerInput();
            });
            window.getSelection()?.removeAllRanges();
            lastStateSignatureRef.current = "";
            setState(null);
          }}
        >
          <Icon name="common.quote" size="sm" />
        </button>
      )}
    </div>,
    document.body
  );
}
