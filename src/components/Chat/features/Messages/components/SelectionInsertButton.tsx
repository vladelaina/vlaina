import { useEffect, useMemo, useState } from "react";
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

export function SelectionInsertButton() {
  const [state, setState] = useState<SelectionInsertState | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const syncState = () => {
      setState(computeStateFromSelection());
    };

    document.addEventListener("selectionchange", syncState);
    window.addEventListener("mouseup", syncState);
    window.addEventListener("keyup", syncState);
    window.addEventListener("resize", syncState);
    window.addEventListener("scroll", syncState, true);

    return () => {
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
          setState(null);
        }}
      >
        <Icon name="common.quote" size="sm" />
      </button>
    </div>,
    document.body
  );
}
