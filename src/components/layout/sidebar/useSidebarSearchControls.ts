import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type UIEvent,
  type RefObject,
} from 'react';

const OVERSCROLL_OPEN_THRESHOLD = 56;

interface UseSidebarSearchControlsOptions {
  isOpen: boolean;
  query: string;
  onOpen: () => void;
  onClose: () => void;
  interactionScopeRef?: RefObject<HTMLElement | null>;
}

export function useSidebarSearchControls({
  isOpen,
  query,
  onOpen,
  onClose,
  interactionScopeRef,
}: UseSidebarSearchControlsOptions) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  const overscrollDistanceRef = useRef(0);
  const shouldResetScrollTopOnCloseRef = useRef(false);

  useLayoutEffect(() => {
    if (!isOpen) {
      if (shouldResetScrollTopOnCloseRef.current) {
        const scrollRoot = scrollRootRef.current;
        if (scrollRoot) {
          scrollRoot.scrollTop = 0;
          window.requestAnimationFrame(() => {
            if (scrollRootRef.current) {
              scrollRootRef.current.scrollTop = 0;
            }
          });
        }
        shouldResetScrollTopOnCloseRef.current = false;
      }
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [isOpen]);

  const hideSearch = useCallback(() => {
    overscrollDistanceRef.current = 0;
    onClose();
  }, [onClose]);

  const handleScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    if (event.currentTarget.scrollTop > 0) {
      overscrollDistanceRef.current = 0;
    }
  }, []);

  useEffect(() => {
    const interactionScope = interactionScopeRef?.current ?? scrollRootRef.current;
    const scrollRoot = scrollRootRef.current;
    if (!interactionScope || !scrollRoot) {
      return;
    }

    const handleWheel = (event: WheelEvent) => {
      if (isOpen) {
        if (!query.trim() && event.deltaY > 0) {
          event.preventDefault();
          shouldResetScrollTopOnCloseRef.current = true;
          hideSearch();
          return;
        }

        if (scrollRoot.scrollTop === 0 && event.deltaY < 0) {
          event.preventDefault();
        }
        return;
      }

      if (scrollRoot.scrollTop > 0) {
        overscrollDistanceRef.current = 0;
        return;
      }
      if (event.deltaY >= 0) {
        overscrollDistanceRef.current = 0;
        return;
      }

      overscrollDistanceRef.current += Math.abs(event.deltaY);
      if (overscrollDistanceRef.current < OVERSCROLL_OPEN_THRESHOLD) {
        return;
      }

      event.preventDefault();
      onOpen();
    };

    interactionScope.addEventListener('wheel', handleWheel, {
      capture: true,
      passive: false,
    });

    return () => {
      interactionScope.removeEventListener('wheel', handleWheel, true);
    };
  }, [hideSearch, interactionScopeRef, isOpen, onOpen, query]);

  return {
    inputRef,
    scrollRootRef,
    hideSearch,
    handleScroll,
  };
}
