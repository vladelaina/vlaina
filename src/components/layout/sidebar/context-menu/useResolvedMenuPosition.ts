import { useLayoutEffect, useState, type RefObject } from 'react';
import { resolveMenuPosition, type SidebarMenuPosition } from './shared';

interface UseResolvedMenuPositionOptions {
  isOpen: boolean;
  menuRef: RefObject<HTMLDivElement | null>;
  position: SidebarMenuPosition;
}

interface ResolvedMenuPositionState {
  requestedPosition: SidebarMenuPosition;
  resolvedPosition: SidebarMenuPosition;
}

function isSamePosition(a: SidebarMenuPosition, b: SidebarMenuPosition) {
  return a.top === b.top && a.left === b.left;
}

export function useResolvedMenuPosition({
  isOpen,
  menuRef,
  position,
}: UseResolvedMenuPositionOptions) {
  const [state, setState] = useState<ResolvedMenuPositionState>(() => ({
    requestedPosition: position,
    resolvedPosition: position,
  }));

  useLayoutEffect(() => {
    if (!isOpen || !menuRef.current) {
      return;
    }

    const menuElement = menuRef.current;
    let frameId = 0;

    const updatePosition = () => {
      const nextPosition = resolveMenuPosition(menuElement, position);
      setState((current) => {
        if (
          isSamePosition(current.requestedPosition, position) &&
          isSamePosition(current.resolvedPosition, nextPosition)
        ) {
          return current;
        }

        return {
          requestedPosition: position,
          resolvedPosition: nextPosition,
        };
      });
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

  return isSamePosition(state.requestedPosition, position)
    ? state.resolvedPosition
    : position;
}
