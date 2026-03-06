import { useCallback, useEffect, useRef, useState } from 'react';
import { saveAttachment, type Attachment } from '@/lib/storage/attachmentStorage';

export function useChatAttachments() {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);

  const hasFileTransfer = useCallback((transfer: DataTransfer | null | undefined) => {
    if (!transfer) {
      return false;
    }
    const types = transfer.types;
    if (types && Array.from(types).includes('Files')) {
      return true;
    }
    const items = transfer.items;
    if (items && items.length > 0) {
      return Array.from(items).some((item) => item.kind === 'file');
    }
    return transfer.files.length > 0;
  }, []);

  const hasFileDrag = useCallback(
    (event: React.DragEvent) => hasFileTransfer(event.dataTransfer),
    [hasFileTransfer]
  );

  const processFiles = useCallback(async (files: File[]) => {
    const results = await Promise.allSettled(
      files.map(async (file) => saveAttachment(file))
    );

    const newAttachments: Attachment[] = [];
    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        newAttachments.push(result.value);
      } else {
        console.error(result.reason);
      }
    });

    if (newAttachments.length > 0) {
      setAttachments((prev) => [...prev, ...newAttachments]);
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
      const files = Array.from(event.dataTransfer?.files ?? []);
      if (files.length > 0) {
        void processFiles(files);
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
      const files = Array.from(e.clipboardData.items)
        .filter((item) => item.kind === 'file')
        .map((item) => item.getAsFile())
        .filter((file): file is File => !!file);

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
      await processFiles(Array.from(e.dataTransfer.files));
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
    setAttachments((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments([]);
  }, []);

  const triggerFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        await processFiles(Array.from(e.target.files));
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
  };
}
