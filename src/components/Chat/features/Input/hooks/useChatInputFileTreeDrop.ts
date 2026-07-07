import { useCallback, useEffect, useState, type RefObject } from 'react';
import type { NoteMentionReference } from '@/lib/ai/noteMentions';
import {
  FILE_TREE_CHAT_DROP_EVENT,
  FILE_TREE_CHAT_DROP_TARGET_SELECTOR,
  type FileTreeChatDropDetail,
} from '@/components/Notes/features/FileTree/hooks/fileTreePointerDragState';

interface UseChatInputFileTreeDropOptions {
  active: boolean;
  appendNoteMentions: (mentions: NoteMentionReference[]) => void;
  clearHistoryNavigationOnInput: () => void;
  composerRootRef: RefObject<HTMLDivElement | null>;
  getDisplayName: (path: string) => string;
  isFileTreeDragActive: boolean;
  resetHistoryNavigation: () => void;
}

export function useChatInputFileTreeDrop({
  active,
  appendNoteMentions,
  clearHistoryNavigationOnInput,
  composerRootRef,
  getDisplayName,
  isFileTreeDragActive,
  resetHistoryNavigation,
}: UseChatInputFileTreeDropOptions) {
  const [isFileTreeDropActive, setIsFileTreeDropActive] = useState(false);

  const buildDroppedFileTreeMentions = useCallback(
    (detail: FileTreeChatDropDetail): NoteMentionReference[] => {
      const title = detail.kind === 'folder'
        ? `${detail.path.split('/').filter(Boolean).pop() ?? detail.path}/`
        : getDisplayName(detail.path);
      return [{
        path: detail.path,
        title,
        kind: detail.kind === 'folder' ? 'folder' : 'note',
      }];
    },
    [getDisplayName],
  );

  useEffect(() => {
    if (!active) {
      setIsFileTreeDropActive(false);
      return;
    }

    const isInsideDropTarget = (event: PointerEvent | MouseEvent) => {
      const root = composerRootRef.current?.closest(FILE_TREE_CHAT_DROP_TARGET_SELECTOR) as HTMLElement | null;
      if (!root) {
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

    const handlePointerMove = (event: PointerEvent) => {
      setIsFileTreeDropActive(isFileTreeDragActive && isInsideDropTarget(event));
    };

    const handlePointerUp = () => {
      setIsFileTreeDropActive(false);
    };

    const handleFileTreeChatDrop = (event: Event) => {
      const detail = (event as CustomEvent<FileTreeChatDropDetail>).detail;
      if (!detail?.path) {
        return;
      }
      appendNoteMentions(buildDroppedFileTreeMentions(detail));
      resetHistoryNavigation();
      clearHistoryNavigationOnInput();
      setIsFileTreeDropActive(false);
    };

    window.addEventListener('pointermove', handlePointerMove, true);
    window.addEventListener('pointerup', handlePointerUp, true);
    window.addEventListener(FILE_TREE_CHAT_DROP_EVENT, handleFileTreeChatDrop);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove, true);
      window.removeEventListener('pointerup', handlePointerUp, true);
      window.removeEventListener(FILE_TREE_CHAT_DROP_EVENT, handleFileTreeChatDrop);
      setIsFileTreeDropActive(false);
    };
  }, [
    active,
    appendNoteMentions,
    buildDroppedFileTreeMentions,
    clearHistoryNavigationOnInput,
    composerRootRef,
    isFileTreeDragActive,
    resetHistoryNavigation,
  ]);

  return isFileTreeDropActive;
}
