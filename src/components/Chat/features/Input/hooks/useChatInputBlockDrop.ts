import { useEffect, useState, type RefObject } from 'react';
import {
  getBlockDragComposerPayload,
  subscribeBlockDragVisualState,
} from '@/components/Notes/features/Editor/plugins/cursor/blockDragVisualState';
import { insertTextIntoComposer } from '@/lib/ui/composerFocusRegistry';

interface UseChatInputBlockDropOptions {
  acceptNotesBlockDrop: boolean;
  active: boolean;
  clearHistoryNavigationOnInput: () => void;
  composerRootRef: RefObject<HTMLDivElement | null>;
  resetHistoryNavigation: () => void;
}

export function useChatInputBlockDrop({
  acceptNotesBlockDrop,
  active,
  clearHistoryNavigationOnInput,
  composerRootRef,
  resetHistoryNavigation,
}: UseChatInputBlockDropOptions) {
  const [isBlockDropActive, setIsBlockDropActive] = useState(false);

  useEffect(() => {
    if (!acceptNotesBlockDrop || !active) {
      setIsBlockDropActive(false);
      return;
    }

    const isInsideDropTarget = (event: MouseEvent) => {
      const root = composerRootRef.current?.closest('[data-notes-block-drop-target="true"]') as HTMLElement | null;
      if (!root || !getBlockDragComposerPayload()) {
        return false;
      }
      const rect = root.getBoundingClientRect();
      return (
        event.clientX >= rect.left
        && event.clientX <= rect.right
        && event.clientY >= rect.top
        && event.clientY <= rect.bottom
      );
    };

    const syncDropActive = (event?: MouseEvent) => {
      if (!getBlockDragComposerPayload()) {
        setIsBlockDropActive(false);
        return;
      }
      if (event) {
        setIsBlockDropActive(isInsideDropTarget(event));
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      syncDropActive(event);
    };

    const handleMouseUp = (event: MouseEvent) => {
      const payload = getBlockDragComposerPayload();
      const shouldInsert = Boolean(payload?.text) && isInsideDropTarget(event);
      setIsBlockDropActive(false);
      if (!shouldInsert || !payload) {
        return;
      }

      event.preventDefault();
      insertTextIntoComposer(payload.text);
      resetHistoryNavigation();
      clearHistoryNavigationOnInput();
    };

    const unsubscribe = subscribeBlockDragVisualState(() => syncDropActive());
    window.addEventListener('mousemove', handleMouseMove, true);
    window.addEventListener('mouseup', handleMouseUp, true);

    return () => {
      unsubscribe();
      window.removeEventListener('mousemove', handleMouseMove, true);
      window.removeEventListener('mouseup', handleMouseUp, true);
      setIsBlockDropActive(false);
    };
  }, [
    acceptNotesBlockDrop,
    active,
    clearHistoryNavigationOnInput,
    composerRootRef,
    resetHistoryNavigation,
  ]);

  return isBlockDropActive;
}
