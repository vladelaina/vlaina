import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/ui/icons";
import { cn, iconButtonStyles } from "@/lib/utils";
import { focusComposerInput, insertTextIntoComposer, isComposerFocusTarget } from "@/lib/ui/composerFocusRegistry";

interface SelectionInsertState {
  text: string;
  x: number;
  y: number;
  placeBelow: boolean;
}

interface OutsideMoveDecision {
  nextFrozen: boolean;
  shouldPreventDefault: boolean;
  shouldRestore: boolean;
}

export function resolveOutsideMoveDecision({
  isSelectingFromChat,
  pointerInsideChat,
  isSelectionFrozen,
}: {
  isSelectingFromChat: boolean;
  pointerInsideChat: boolean;
  isSelectionFrozen: boolean;
}): OutsideMoveDecision {
  if (!isSelectingFromChat) {
    return {
      nextFrozen: isSelectionFrozen,
      shouldPreventDefault: false,
      shouldRestore: false,
    };
  }
  if (pointerInsideChat) {
    return {
      nextFrozen: false,
      shouldPreventDefault: false,
      shouldRestore: false,
    };
  }
  return {
    nextFrozen: true,
    shouldPreventDefault: true,
    shouldRestore: !isSelectionFrozen,
  };
}

function setChatSelectionLock(active: boolean) {
  if (typeof document === "undefined") {
    return;
  }
  if (active) {
    document.body.setAttribute("data-chat-selection-lock", "1");
    return;
  }
  document.body.removeAttribute("data-chat-selection-lock");
}

function setChatSelectionFreeze(active: boolean) {
  if (typeof document === "undefined") {
    return;
  }
  if (active) {
    document.body.setAttribute("data-chat-selection-freeze", "1");
    return;
  }
  document.body.removeAttribute("data-chat-selection-freeze");
}

function normalizeSelectionText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, "\n\n")
    .trim();
}

function toElement(node: Node | null): Element | null {
  if (!node) return null;
  if (node instanceof Element) return node;
  return node.parentElement;
}

function isInsideMessageItem(element: Element | null): boolean {
  return !!element?.closest('[data-message-item="true"]');
}

function isInsideChatScrollable(element: Element | null): boolean {
  return !!element?.closest('[data-chat-scrollable="true"]');
}

function isSelectionInsideChatMessages(selection: Selection, range: Range): boolean {
  const anchorElement = toElement(selection.anchorNode);
  const focusElement = toElement(selection.focusNode);
  const ancestorElement = toElement(range.commonAncestorContainer);

  if (anchorElement && isComposerFocusTarget(anchorElement)) return false;
  if (focusElement && isComposerFocusTarget(focusElement)) return false;
  if (ancestorElement && isComposerFocusTarget(ancestorElement)) return false;

  const endpointInChat = [anchorElement, focusElement, ancestorElement].some((element) =>
    isInsideChatScrollable(element)
  );
  if (!endpointInChat) {
    return false;
  }

  const endpointInMessageItem = [anchorElement, focusElement, ancestorElement].some((element) =>
    isInsideMessageItem(element)
  );
  if (endpointInMessageItem) {
    return true;
  }

  const chatScrollable =
    ancestorElement?.closest('[data-chat-scrollable="true"]') ??
    anchorElement?.closest('[data-chat-scrollable="true"]') ??
    focusElement?.closest('[data-chat-scrollable="true"]') ??
    document.querySelector('[data-chat-scrollable="true"]');
  if (!chatScrollable) {
    return false;
  }

  const messageItems = chatScrollable.querySelectorAll('[data-message-item="true"]');
  for (const item of messageItems) {
    try {
      if (range.intersectsNode(item)) {
        return true;
      }
    } catch {}
  }

  return false;
}

function isSelectionFullyInsideChatMessages(selection: Selection, range: Range): boolean {
  const anchorElement = toElement(selection.anchorNode);
  const focusElement = toElement(selection.focusNode);

  if (!isInsideChatScrollable(anchorElement) || !isInsideChatScrollable(focusElement)) {
    return false;
  }

  const chatScrollable =
    anchorElement?.closest('[data-chat-scrollable="true"]') ??
    focusElement?.closest('[data-chat-scrollable="true"]') ??
    document.querySelector('[data-chat-scrollable="true"]');
  if (!chatScrollable) {
    return false;
  }

  const messageItems = chatScrollable.querySelectorAll('[data-message-item="true"]');
  for (const item of messageItems) {
    try {
      if (range.intersectsNode(item)) {
        return true;
      }
    } catch {}
  }

  return false;
}

function isSameRange(a: Range, b: Range): boolean {
  try {
    return (
      a.compareBoundaryPoints(Range.START_TO_START, b) === 0 &&
      a.compareBoundaryPoints(Range.END_TO_END, b) === 0
    );
  } catch {
    return false;
  }
}

function computeStateFromSelection(): SelectionInsertState | null {
  if (typeof window === "undefined") {
    return null;
  }
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }

  const text = normalizeSelectionText(selection.toString());
  if (!text) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (!isSelectionInsideChatMessages(selection, range)) {
    return null;
  }

  const rect = range.getBoundingClientRect();
  if (!rect || (rect.width === 0 && rect.height === 0)) {
    return null;
  }

  const minX = 24;
  const maxX = Math.max(24, window.innerWidth - 24);
  const centerX = rect.left + rect.width / 2;
  const x = Math.min(Math.max(centerX, minX), maxX);

  const placeBelow = rect.top < 64;
  const y = placeBelow ? rect.bottom + 10 : rect.top - 10;

  return { text, x, y, placeBelow };
}

function getStateSignature(state: SelectionInsertState | null): string {
  if (!state) {
    return "";
  }
  return `${state.text}|${Math.round(state.x)}|${Math.round(state.y)}|${state.placeBelow ? "1" : "0"}`;
}

export function SelectionInsertButton() {
  const [state, setState] = useState<SelectionInsertState | null>(null);
  const [mounted, setMounted] = useState(false);
  const isSelectingFromChatRef = useRef(false);
  const isPointerInsideChatRef = useRef(true);
  const isSelectionFrozenRef = useRef(false);
  const lastValidRangeRef = useRef<Range | null>(null);
  const lastValidTextRef = useRef("");
  const isRestoringRangeRef = useRef(false);
  const lastStateSignatureRef = useRef<string>("");

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
      if (isRangeInsideChat && isPointerInsideChatRef.current) {
        const normalizedText = normalizeSelectionText(selection.toString());
        if (!normalizedText) {
          return false;
        }
        lastValidRangeRef.current = range.cloneRange();
        lastValidTextRef.current = normalizedText;
        return false;
      }
      if (!lastValidRangeRef.current) {
        return false;
      }
      const currentText = normalizeSelectionText(selection.toString());
      if (!force && currentText && currentText === lastValidTextRef.current) {
        return false;
      }
      if (!force && isSameRange(range, lastValidRangeRef.current)) {
        return false;
      }
      isRestoringRangeRef.current = true;
      selection.removeAllRanges();
      selection.addRange(lastValidRangeRef.current);
      isRestoringRangeRef.current = false;
      return true;
    };

    let outsideClampRaf: number | null = null;
    const stopOutsideClamp = () => {
      if (outsideClampRaf !== null) {
        cancelAnimationFrame(outsideClampRaf);
        outsideClampRaf = null;
      }
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
      isSelectingFromChatRef.current = target instanceof Element && !!target.closest('[data-message-item="true"]');
      isPointerInsideChatRef.current = target instanceof Element && !!target.closest('[data-chat-scrollable="true"]');
      isSelectionFrozenRef.current = false;
      lastValidRangeRef.current = null;
      lastValidTextRef.current = "";
      stopOutsideClamp();
      setChatSelectionLock(isSelectingFromChatRef.current);
      setChatSelectionFreeze(false);
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!isSelectingFromChatRef.current) {
        return;
      }
      const target = event.target;
      isPointerInsideChatRef.current = target instanceof Element && !!target.closest('[data-chat-scrollable="true"]');
      const decision = resolveOutsideMoveDecision({
        isSelectingFromChat: isSelectingFromChatRef.current,
        pointerInsideChat: isPointerInsideChatRef.current,
        isSelectionFrozen: isSelectionFrozenRef.current,
      });
      if (decision.nextFrozen !== isSelectionFrozenRef.current) {
        isSelectionFrozenRef.current = decision.nextFrozen;
        setChatSelectionFreeze(decision.nextFrozen);
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
      if (!isSelectingFromChatRef.current || isPointerInsideChatRef.current) {
        return;
      }
      event.preventDefault();
    };

    const handleMouseUp = () => {
      if (isSelectingFromChatRef.current) {
        restoreLastValidSelection({ force: true });
      }
      requestAnimationFrame(() => {
        isSelectingFromChatRef.current = false;
        isPointerInsideChatRef.current = true;
        isSelectionFrozenRef.current = false;
        lastValidRangeRef.current = null;
        lastValidTextRef.current = "";
        stopOutsideClamp();
        setChatSelectionLock(false);
        setChatSelectionFreeze(false);
        const nextState = computeStateFromSelection();
        lastStateSignatureRef.current = getStateSignature(nextState);
        setState(nextState);
      });
    };

    const syncState = () => {
      if (isRestoringRangeRef.current || typeof window === "undefined") {
        return;
      }

      if (isSelectingFromChatRef.current) {
        if (!isPointerInsideChatRef.current) {
          return;
        }
        restoreLastValidSelection();
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

    return () => {
      stopOutsideClamp();
      setChatSelectionLock(false);
      setChatSelectionFreeze(false);
      window.removeEventListener("mousedown", handleMouseDown, true);
      window.removeEventListener("mousemove", handleMouseMove, true);
      window.removeEventListener("mouseup", handleMouseUp, true);
      document.removeEventListener("selectstart", handleSelectStart, true);
      document.removeEventListener("selectionchange", syncState);
      window.removeEventListener("mouseup", syncState);
      window.removeEventListener("keyup", syncState);
      window.removeEventListener("resize", syncState);
      window.removeEventListener("scroll", syncState, true);
    };
  }, []);

  const transformClass = useMemo(() => {
    if (!state) return "";
    return state.placeBelow ? "-translate-x-1/2" : "-translate-x-1/2 -translate-y-full";
  }, [state]);

  if (!mounted || !state || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[115]">
      <button
        type="button"
        aria-label="Insert selection to input"
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
    </div>,
    document.body
  );
}
