import { useState, useRef, useCallback, useEffect } from 'react';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui/icons';
import { useI18n } from '@/lib/i18n';
import { UploadZoneProps } from './types';

type UploadStatus = 'idle' | 'dragging' | 'uploading' | 'success' | 'duplicate' | 'error';

interface ExtendedUploadZoneProps extends UploadZoneProps {
  currentNotePath?: string;
}

export function UploadZone({ onUploadComplete, onDuplicateDetected, compact, currentNotePath }: ExtendedUploadZoneProps) {
  const { t } = useI18n();

  const uploadAsset = useNotesStore((state) => state.uploadAsset);
  const uploadProgress = useNotesStore((state) => state.uploadProgress);
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [message, setMessage] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const scheduleReset = useCallback((delayMs: number) => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
    }

    resetTimerRef.current = setTimeout(() => {
      resetTimerRef.current = null;
      setStatus('idle');
      setMessage('');
    }, delayMs);
  }, []);

  useEffect(() => () => {
    mountedRef.current = false;
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  }, []);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setStatus('error');
      setMessage(t('asset.onlyImageFilesSupported'));
      scheduleReset(3000);
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setStatus('error');
      setMessage(t('asset.fileExceedsMaxSize', { size: '50MB' }));
      scheduleReset(3000);
      return;
    }

    setStatus('uploading');
    setMessage(t('asset.uploading'));

    try {
      const result = await uploadAsset(file, currentNotePath);
      if (!mountedRef.current) {
        if (result.success && result.path) {
          onUploadComplete(result.path);
        }
        return;
      }

      if (result.success) {
        if (result.isDuplicate) {
          setStatus('duplicate');
          setMessage(t('asset.alreadyInLibrary', { filename: result.existingFilename || '' }));
          onDuplicateDetected?.(result.existingFilename!);
        } else {
          setStatus('success');
          setMessage(t('asset.uploadComplete'));
        }

        if (result.path) {
          onUploadComplete(result.path);
        }
      } else {
        setStatus('error');
        setMessage(result.error || t('asset.uploadFailed'));
      }
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }
      setStatus('error');
      setMessage(error instanceof Error ? error.message : t('asset.uploadFailed'));
    }

    scheduleReset(2000);
  }, [uploadAsset, onUploadComplete, onDuplicateDetected, currentNotePath, scheduleReset, t]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setStatus('idle');

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setStatus('dragging');
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setStatus('idle');
  }, []);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
    e.target.value = '';
  }, [handleFile]);

  const getStatusIcon = () => {
    const iconSize = compact ? "w-6 h-6" : "w-10 h-10";
    switch (status) {
      case 'uploading':
        return (
          <div className="relative">
            <Icon name="common.upload" className={cn(iconSize, "text-[var(--vlaina-accent)]")} />
            {uploadProgress !== null && !compact && (
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-[var(--vlaina-text-secondary)]">
                {uploadProgress}%
              </div>
            )}
          </div>
        );
      case 'success':
        return <Icon name="common.checkCircle" className={cn(iconSize, "text-green-500")} />;
      case 'duplicate':
        return <Icon name="file.image" className={cn(iconSize, "text-blue-500")} />;
      case 'error':
        return <Icon name="common.error" className={cn(iconSize, "text-red-500")} />;
      default:
        return <Icon name="common.upload" className={cn(iconSize, "text-[var(--vlaina-accent)]")} />;
    }
  };

  const getStatusText = () => {
    if (message) return message;
    if (status === 'dragging') return t('asset.dropImageHere');
    if (compact) return null;
    return t('asset.dragDropOrBrowse');
  };

  const statusText = getStatusText();

  return (
    <div
      onClick={handleClick}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={cn(
        "flex flex-col items-center justify-center rounded-lg cursor-pointer",
        "border-2 border-dashed transition-all duration-200",
        compact ? "p-4" : "p-8",
        status === 'dragging' && "border-[var(--vlaina-accent)] bg-[var(--vlaina-accent)]/5",
        status === 'uploading' && "border-[var(--vlaina-accent)] bg-[var(--vlaina-accent)]/5",
        status === 'success' && "border-green-500 bg-green-500/5",
        status === 'duplicate' && "border-blue-500 bg-blue-500/5",
        status === 'error' && "border-red-500 bg-red-500/5",
        status === 'idle' && "border-[var(--vlaina-accent)]/40 bg-[var(--vlaina-accent)]/5 hover:border-[var(--vlaina-accent)] hover:bg-[var(--vlaina-accent)]/10"
      )}
    >
      {getStatusIcon()}

      {statusText && (
        <p className={cn(
          "text-center",
          compact ? "mt-2 text-xs" : "mt-4 text-sm",
          status === 'error' ? "text-red-500" : "text-[var(--vlaina-text-secondary)]"
        )}>
          {statusText}
        </p>
      )}

      {status === 'idle' && !compact && (
        <p className="mt-1 text-xs text-[var(--vlaina-text-tertiary)]">
          {t('asset.supportsImageFormats')}
        </p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
