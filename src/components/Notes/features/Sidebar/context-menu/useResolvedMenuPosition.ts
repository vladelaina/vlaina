import { useLayoutEffect, useState, type RefObject } from 'react';
import { resolveMenuPosition, type NotesSidebarMenuPosition } from './shared';

interface UseResolvedMenuPositionOptions {
  isOpen: boolean;
  menuRef: RefObject<HTMLDivElement | null>;
  position: NotesSidebarMenuPosition;
}

export function useResolvedMenuPosition({
  isOpen,
  menuRef,
  position,
}: UseResolvedMenuPositionOptions) {
  const [resolvedPosition, setResolvedPosition] = useState(position);

  useLayoutEffect(() => {
    if (!isOpen || !menuRef.current) {
      return;
    }

    const menuElement = menuRef.current;
    let frameId = 0;

    const updatePosition = () => {
      const nextPosition = resolveMenuPosition(menuElement, position);
      setResolvedPosition((current) =>
        current.top === nextPosition.top && current.left === nextPosition.left
          ? current
          : nextPosition,
      );
    };

    updatePosition();
    frameId = window.requestAnimationFrame(updatePosition);

    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            updatePosition();
          });

    resizeObserver?.observe(menuElement);
    window.addEventListener('resize', updatePosition);

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen, menuRef, position]);

  return resolvedPosition;
}
