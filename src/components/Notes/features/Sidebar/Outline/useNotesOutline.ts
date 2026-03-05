import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NotesOutlineHeading } from './types';
import {
  areOutlineHeadingsEqual,
  createOutlineHeadingId,
  getHeadingLevelFromTagName,
  normalizeHeadingText,
} from './outlineUtils';

const EDITOR_ROOT_SELECTOR = '.milkdown .ProseMirror';
const EDITOR_SCROLL_ROOT_SELECTOR = '[data-note-scroll-root="true"]';
const ACTIVE_OFFSET_PX = 72;
const POLL_INTERVAL_MS = 450;

function readOutlineFromEditor(editorRoot: HTMLElement): {
  headings: NotesOutlineHeading[];
  elementMap: Map<string, HTMLElement>;
} {
  const headingElements = Array.from(
    editorRoot.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6'),
  );

  const headings: NotesOutlineHeading[] = [];
  const elementMap = new Map<string, HTMLElement>();

  headingElements.forEach((element, index) => {
    const level = getHeadingLevelFromTagName(element.tagName);
    if (!level) return;

    const text = normalizeHeadingText(element.textContent ?? '');
    const id = createOutlineHeadingId(index, level, text);

    headings.push({ id, level, text });
    elementMap.set(id, element);
  });

  return { headings, elementMap };
}

function selectActiveHeadingId(
  headings: NotesOutlineHeading[],
  elementMap: Map<string, HTMLElement>,
  scrollRoot: HTMLElement | null,
): string | null {
  if (!scrollRoot || headings.length === 0) return null;

  const rootRect = scrollRoot.getBoundingClientRect();
  const anchorY = scrollRoot.scrollTop + ACTIVE_OFFSET_PX;
  let activeId: string | null = headings[0]?.id ?? null;

  for (const heading of headings) {
    const element = elementMap.get(heading.id);
    if (!element) continue;

    const y = element.getBoundingClientRect().top - rootRect.top + scrollRoot.scrollTop;
    if (y <= anchorY) {
      activeId = heading.id;
    } else {
      break;
    }
  }

  return activeId;
}

export function useNotesOutline(enabled: boolean) {
  const [headings, setHeadings] = useState<NotesOutlineHeading[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const headingsRef = useRef<NotesOutlineHeading[]>([]);
  const elementMapRef = useRef<Map<string, HTMLElement>>(new Map());
  const editorRootRef = useRef<HTMLElement | null>(null);
  const scrollRootRef = useRef<HTMLElement | null>(null);
  const updateOnScrollRef = useRef<(() => void) | null>(null);

  const syncActiveHeading = useCallback(() => {
    const nextActive = selectActiveHeadingId(
      headingsRef.current,
      elementMapRef.current,
      scrollRootRef.current,
    );
    setActiveId((prev) => (prev === nextActive ? prev : nextActive));
  }, []);

  updateOnScrollRef.current = syncActiveHeading;

  useEffect(() => {
    if (!enabled) {
      headingsRef.current = [];
      elementMapRef.current = new Map();
      editorRootRef.current = null;
      scrollRootRef.current = null;
      setHeadings([]);
      setActiveId(null);
      return;
    }

    let rafId = 0;
    let pollId = 0;
    let mutationObserver: MutationObserver | null = null;

    const attachMutationObserver = (editorRoot: HTMLElement | null) => {
      mutationObserver?.disconnect();
      mutationObserver = null;

      if (!editorRoot) return;

      mutationObserver = new MutationObserver(() => {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(refreshOutline);
      });

      mutationObserver.observe(editorRoot, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    };

    const updateScrollBinding = (scrollRoot: HTMLElement | null) => {
      if (scrollRootRef.current === scrollRoot) return;

      if (scrollRootRef.current && updateOnScrollRef.current) {
        scrollRootRef.current.removeEventListener('scroll', updateOnScrollRef.current);
      }

      scrollRootRef.current = scrollRoot;

      if (scrollRoot && updateOnScrollRef.current) {
        scrollRoot.addEventListener('scroll', updateOnScrollRef.current, { passive: true });
      }
    };

    const refreshOutline = () => {
      const editorRoot = document.querySelector<HTMLElement>(EDITOR_ROOT_SELECTOR);
      const scrollRoot = document.querySelector<HTMLElement>(EDITOR_SCROLL_ROOT_SELECTOR);

      if (editorRootRef.current !== editorRoot) {
        editorRootRef.current = editorRoot;
        attachMutationObserver(editorRoot);
      }

      updateScrollBinding(scrollRoot);

      if (!editorRoot) {
        headingsRef.current = [];
        elementMapRef.current = new Map();
        setHeadings((prev) => (prev.length === 0 ? prev : []));
        setActiveId(null);
        return;
      }

      const { headings: nextHeadings, elementMap } = readOutlineFromEditor(editorRoot);
      elementMapRef.current = elementMap;

      if (!areOutlineHeadingsEqual(headingsRef.current, nextHeadings)) {
        headingsRef.current = nextHeadings;
        setHeadings(nextHeadings);
      } else {
        headingsRef.current = nextHeadings;
      }

      syncActiveHeading();
    };

    refreshOutline();
    pollId = window.setInterval(refreshOutline, POLL_INTERVAL_MS);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (pollId) window.clearInterval(pollId);
      mutationObserver?.disconnect();
      if (scrollRootRef.current && updateOnScrollRef.current) {
        scrollRootRef.current.removeEventListener('scroll', updateOnScrollRef.current);
      }
      scrollRootRef.current = null;
      editorRootRef.current = null;
    };
  }, [enabled, syncActiveHeading]);

  const jumpToHeading = useCallback((headingId: string) => {
    const headingElement = elementMapRef.current.get(headingId);
    const scrollRoot = scrollRootRef.current;
    if (!headingElement || !scrollRoot) return;

    const rootRect = scrollRoot.getBoundingClientRect();
    const targetY =
      headingElement.getBoundingClientRect().top - rootRect.top + scrollRoot.scrollTop - ACTIVE_OFFSET_PX;

    scrollRoot.scrollTo({
      top: Math.max(0, targetY),
      behavior: 'smooth',
    });

    const editorRoot = document.querySelector<HTMLElement>(EDITOR_ROOT_SELECTOR);
    editorRoot?.focus({ preventScroll: true });
    setActiveId(headingId);
  }, []);

  return useMemo(
    () => ({
      headings,
      activeId,
      jumpToHeading,
    }),
    [headings, activeId, jumpToHeading],
  );
}
