import { useCallback, useEffect, useRef, useState } from 'react';
import { deleteAttachment, saveAttachment, type Attachment } from '@/lib/storage/attachmentStorage';
import { useAIUIStore } from '@/stores/ai/chatState';

export const MAX_CHAT_ATTACHMENT_INPUT_FILES = 64;
export const MAX_CHAT_ATTACHMENT_TRANSFER_ITEM_SCAN = 1024;
export const MAX_CHAT_ATTACHMENT_SAVE_CONCURRENCY = 4;

function getTransferType(types: DataTransfer['types'], index: number): string | null {
  const maybeTypes = types as DataTransfer['types'] & { item?: (index: number) => string | null };
  if (typeof maybeTypes.item === 'function') {
    return maybeTypes.item(index);
  }
  return maybeTypes[index] ?? null;
}

export function hasChatAttachmentFileType(types: DataTransfer['types'] | null | undefined): boolean {
  if (!types) {
    return false;
  }

  const length = Math.min(types.length, MAX_CHAT_ATTACHMENT_TRANSFER_ITEM_SCAN);
  for (let index = 0; index < length; index += 1) {
    if (getTransferType(types, index) === 'Files') {
      return true;
    }
  }
  return false;
}

export function hasChatAttachmentTransferItem(items: DataTransferItemList | null | undefined): boolean {
  if (!items) {
    return false;
  }

  const length = Math.min(items.length, MAX_CHAT_ATTACHMENT_TRANSFER_ITEM_SCAN);
  for (let index = 0; index < length; index += 1) {
    if (items[index]?.kind === 'file') {
      return true;
    }
  }
  return false;
}

export function collectChatAttachmentFiles(
  files: FileList | readonly File[] | null | undefined,
  maxFiles = MAX_CHAT_ATTACHMENT_INPUT_FILES
): File[] {
  if (!files) {
    return [];
  }

  const collected: File[] = [];
  const length = Math.min(files.length, maxFiles);
  for (let index = 0; index < length; index += 1) {
    const file = files[index];
    if (file instanceof File) {
      collected.push(file);
    }
  }
  return collected;
}

export function collectChatAttachmentClipboardFiles(items: DataTransferItemList | null | undefined): File[] {
  if (!items) {
    return [];
  }

  const files: File[] = [];
  const length = Math.min(items.length, MAX_CHAT_ATTACHMENT_TRANSFER_ITEM_SCAN);
  for (let index = 0; index < length; index += 1) {
    const item = items[index];
    if (item?.kind !== 'file') {
      continue;
    }

    const file = item.getAsFile();
    if (!file) {
      continue;
    }

    files.push(file);
    if (files.length >= MAX_CHAT_ATTACHMENT_INPUT_FILES) {
      break;
    }
  }
  return files;
}

async function settleWithConcurrencyLimit<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results = new Array<PromiseSettledResult<R>>(items.length);
  let nextIndex = 0;

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        try {
          results[index] = { status: 'fulfilled', value: await worker(items[index]!) };
        } catch (reason) {
          results[index] = { status: 'rejected', reason };
        }
      }
    }
  );

  await Promise.all(workers);
  return results;
}

function deleteAttachmentQuietly(attachment: Attachment): void {
  try {
    void Promise.resolve(deleteAttachment(attachment)).catch(() => {});
  } catch {
  }
}

export function useChatAttachments() {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const attachmentsRef = useRef<Attachment[]>([]);
  const pendingAttachmentSaveCountRef = useRef(0);
  const attachmentGenerationRef = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => () => {
    isMountedRef.current = false;
    attachmentGenerationRef.current += 1;
    attachmentsRef.current = [];
  }, []);

  const hasFileTransfer = useCallback((transfer: DataTransfer | null | undefined) => {
    if (!transfer) {
      return false;
    }
    const types = transfer.types;
    if (hasChatAttachmentFileType(types)) {
      return true;
    }
    if (hasChatAttachmentTransferItem(transfer.items)) {
      return true;
    }
    return transfer.files.length > 0;
  }, []);

  const hasFileDrag = useCallback(
    (event: React.DragEvent) => hasFileTransfer(event.dataTransfer),
    [hasFileTransfer]
  );

  const processFiles = useCallback(async (files: File[]) => {
    const generation = attachmentGenerationRef.current;
    const remainingSlots = Math.max(
      MAX_CHAT_ATTACHMENT_INPUT_FILES
      - attachmentsRef.current.length
      - pendingAttachmentSaveCountRef.current,
      0
    );
    const limitedFiles = files.length > remainingSlots
      ? files.slice(0, remainingSlots)
      : files;
    if (limitedFiles.length === 0) {
      return;
    }

    pendingAttachmentSaveCountRef.current += limitedFiles.length;
    const shouldPersist = !useAIUIStore.getState().temporaryChatEnabled;
    let results: PromiseSettledResult<Attachment>[];
    try {
      results = await settleWithConcurrencyLimit(
        limitedFiles,
        MAX_CHAT_ATTACHMENT_SAVE_CONCURRENCY,
        (file) => saveAttachment(file, { persist: shouldPersist })
      );
    } finally {
      pendingAttachmentSaveCountRef.current = Math.max(
        pendingAttachmentSaveCountRef.current - limitedFiles.length,
        0
      );
    }

    const newAttachments: Attachment[] = [];
    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        newAttachments.push(result.value);
      } else {
      }
    });

    if (newAttachments.length > 0) {
      if (!isMountedRef.current || generation !== attachmentGenerationRef.current) {
        newAttachments.forEach((attachment) => {
          deleteAttachmentQuietly(attachment);
        });
        return;
      }

      setAttachments((prev) => {
        if (generation !== attachmentGenerationRef.current) {
          newAttachments.forEach((attachment) => {
            deleteAttachmentQuietly(attachment);
          });
          return prev;
        }

        const availableSlots = Math.max(MAX_CHAT_ATTACHMENT_INPUT_FILES - prev.length, 0);
        if (availableSlots <= 0) {
          newAttachments.forEach((attachment) => {
            deleteAttachmentQuietly(attachment);
          });
          return prev;
        }

        const acceptedAttachments = newAttachments.slice(0, availableSlots);
        newAttachments.slice(availableSlots).forEach((attachment) => {
          deleteAttachmentQuietly(attachment);
        });
        const nextAttachments = [...prev, ...acceptedAttachments];
        attachmentsRef.current = nextAttachments;
        return nextAttachments;
      });
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const onWindowDragOver = (event: DragEvent) => {
      if (!hasFileTransfer(event.dataTransfer)) {
        return;
      }
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy';
      }
      setIsDragging(true);
    };

    const onWindowDrop = (event: DragEvent) => {
      if (event.defaultPrevented || !hasFileTransfer(event.dataTransfer)) {
        return;
      }
      event.preventDefault();
      dragDepthRef.current = 0;
      setIsDragging(false);
      const files = collectChatAttachmentFiles(event.dataTransfer?.files);
      if (files.length > 0) {
        void processFiles(files).catch(() => undefined);
      }
    };

    const onWindowDragLeave = (event: DragEvent) => {
      if (!hasFileTransfer(event.dataTransfer)) {
        return;
      }
      if (event.clientX === 0 && event.clientY === 0) {
        dragDepthRef.current = 0;
        setIsDragging(false);
      }
    };

    window.addEventListener('dragover', onWindowDragOver);
    window.addEventListener('drop', onWindowDrop);
    window.addEventListener('dragleave', onWindowDragLeave);

    return () => {
      window.removeEventListener('dragover', onWindowDragOver);
      window.removeEventListener('drop', onWindowDrop);
      window.removeEventListener('dragleave', onWindowDragLeave);
    };
  }, [hasFileTransfer, processFiles]);

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent) => {
      const files = collectChatAttachmentClipboardFiles(e.clipboardData.items);

      if (files.length > 0) {
        e.preventDefault();
        await processFiles(files);
      }
    },
    [processFiles]
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      if (!hasFileDrag(e)) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      dragDepthRef.current = 0;
      setIsDragging(false);
      await processFiles(collectChatAttachmentFiles(e.dataTransfer.files));
    },
    [hasFileDrag, processFiles]
  );

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      if (!hasFileDrag(e)) {
        return;
      }
      e.preventDefault();
      dragDepthRef.current += 1;
      setIsDragging(true);
    },
    [hasFileDrag]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!hasFileDrag(e)) {
      return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragging(true);
  }, [hasFileDrag]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!hasFileDrag(e)) {
      return;
    }
    e.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDragging(false);
    }
  }, [hasFileDrag]);

  const removeAttachment = useCallback((id: string) => {
    const removedAttachment = attachmentsRef.current.find((item) => item.id === id);
    setAttachments((prev) => {
      const nextAttachments = prev.filter((item) => item.id !== id);
      attachmentsRef.current = nextAttachments;
      return nextAttachments;
    });
    if (removedAttachment) {
      deleteAttachmentQuietly(removedAttachment);
    }
  }, []);

  const clearAttachments = useCallback(() => {
    attachmentGenerationRef.current += 1;
    attachmentsRef.current = [];
    setAttachments([]);
  }, []);

  const restoreAttachments = useCallback((nextAttachments: Attachment[]) => {
    attachmentGenerationRef.current += 1;
    const restoredAttachments = nextAttachments.slice(0, MAX_CHAT_ATTACHMENT_INPUT_FILES);
    const restoredIds = new Set(restoredAttachments.map((attachment) => attachment.id));
    attachmentsRef.current = restoredAttachments;
    setAttachments((prev) => {
      prev
        .filter((attachment) => !restoredIds.has(attachment.id))
        .forEach((attachment) => {
          deleteAttachmentQuietly(attachment);
        });
      return restoredAttachments;
    });
  }, []);

  const triggerFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        await processFiles(collectChatAttachmentFiles(e.target.files));
      }
      e.target.value = '';
    },
    [processFiles]
  );

  return {
    attachments,
    isDragging,
    fileInputRef,
    handlePaste,
    handleDrop,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleFileChange,
    triggerFileSelect,
    removeAttachment,
    clearAttachments,
    restoreAttachments,
  };
}
