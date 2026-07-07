import { useCallback, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { Attachment } from '@/lib/storage/attachmentStorage';
import { MAX_CHAT_ATTACHMENT_INPUT_FILES } from './chatAttachmentInputFiles';
import { deleteAttachmentQuietly } from './chatAttachmentPersistence';

const MAX_CHAT_ATTACHMENT_REMOVAL_UNDO = 32;

interface RemovedAttachmentUndoEntry {
  attachment: Attachment;
  index: number;
}

interface UseChatAttachmentUndoStackOptions {
  attachmentsRef: MutableRefObject<Attachment[]>;
  setAttachments: Dispatch<SetStateAction<Attachment[]>>;
}

export function useChatAttachmentUndoStack({
  attachmentsRef,
  setAttachments,
}: UseChatAttachmentUndoStackOptions) {
  const removedAttachmentUndoStackRef = useRef<RemovedAttachmentUndoEntry[]>([]);

  const flushRemovedAttachmentUndoStack = useCallback((preserveIds?: ReadonlySet<string>) => {
    const removedEntries = removedAttachmentUndoStackRef.current;
    if (removedEntries.length === 0) {
      return;
    }
    removedAttachmentUndoStackRef.current = [];
    removedEntries.forEach(({ attachment }) => {
      if (!preserveIds?.has(attachment.id)) {
        deleteAttachmentQuietly(attachment);
      }
    });
  }, []);

  const removeAttachment = useCallback((id: string) => {
    const removedIndex = attachmentsRef.current.findIndex((item) => item.id === id);
    if (removedIndex < 0) {
      return;
    }

    const removedAttachment = attachmentsRef.current[removedIndex];
    if (!removedAttachment) {
      return;
    }

    const nextAttachments = attachmentsRef.current.filter((item) => item.id !== id);
    attachmentsRef.current = nextAttachments;
    setAttachments(nextAttachments);
    removedAttachmentUndoStackRef.current.push({
      attachment: removedAttachment,
      index: removedIndex,
    });

    while (removedAttachmentUndoStackRef.current.length > MAX_CHAT_ATTACHMENT_REMOVAL_UNDO) {
      const staleEntry = removedAttachmentUndoStackRef.current.shift();
      if (staleEntry) {
        deleteAttachmentQuietly(staleEntry.attachment);
      }
    }
  }, [attachmentsRef, setAttachments]);

  const undoLastRemovedAttachment = useCallback(() => {
    const removedEntry = removedAttachmentUndoStackRef.current.pop();
    if (!removedEntry) {
      return false;
    }

    const currentAttachments = attachmentsRef.current;
    if (currentAttachments.some((attachment) => attachment.id === removedEntry.attachment.id)) {
      return false;
    }

    if (currentAttachments.length >= MAX_CHAT_ATTACHMENT_INPUT_FILES) {
      deleteAttachmentQuietly(removedEntry.attachment);
      return false;
    }

    const insertIndex = Math.max(0, Math.min(removedEntry.index, currentAttachments.length));
    const nextAttachments = [
      ...currentAttachments.slice(0, insertIndex),
      removedEntry.attachment,
      ...currentAttachments.slice(insertIndex),
    ];
    attachmentsRef.current = nextAttachments;
    setAttachments(nextAttachments);
    return true;
  }, [attachmentsRef, setAttachments]);

  const discardRemovedAttachmentUndoStack = useCallback(() => {
    flushRemovedAttachmentUndoStack();
  }, [flushRemovedAttachmentUndoStack]);

  return {
    flushRemovedAttachmentUndoStack,
    removeAttachment,
    undoLastRemovedAttachment,
    discardRemovedAttachmentUndoStack,
  };
}
