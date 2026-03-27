import {
  useCallback,
  useLayoutEffect,
  useRef,
  type UIEvent,
  type WheelEvent,
} from 'react';

const OVERSCROLL_OPEN_THRESHOLD = 56;

interface UseSidebarSearchControlsOptions {
  isOpen: boolean;
  query: string;
  onOpen: () => void;
  onClose: () => void;
}

export function useSidebarSearchControls({
  isOpen,
  query,
  onOpen,
  onClose,
}: UseSidebarSearchControlsOptions) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  const overscrollDistanceRef = useRef(0);

  useLayoutEffect(() => {
    if (!isOpen) {
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

  const handleWheelCapture = useCallback((event: WheelEvent<HTMLDivElement>) => {
    const currentTarget = event.currentTarget;

    if (isOpen) {
      if (currentTarget.scrollTop === 0 && event.deltaY < 0) {
        event.preventDefault();
        return;
      }
      if (currentTarget.scrollTop === 0 && event.deltaY > 0 && !query.trim()) {
        hideSearch();
      }
      return;
    }

    if (currentTarget.scrollTop > 0) {
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
  }, [hideSearch, isOpen, onOpen, query]);

  return {
    inputRef,
    scrollRootRef,
    hideSearch,
    handleScroll,
    handleWheelCapture,
  };
}
