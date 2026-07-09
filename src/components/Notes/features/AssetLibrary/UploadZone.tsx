import { useState, useRef, useCallback, useEffect } from 'react';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui/icons';
import { useI18n } from '@/lib/i18n';
import { normalizeUserFacingErrorMessage } from '@/lib/i18n/userFacingErrors';
import { isImageFileLike } from '@/lib/assets/core/naming';
import { UploadZoneProps } from './types';

type UploadStatus = 'idle' | 'dragging' | 'uploading' | 'success' | 'duplicate' | 'error';
const MAX_ASSET_UPLOAD_BYTES = 50 * 1024 * 1024;

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
    if (!isImageFileLike(file)) {
      setStatus('error');
      setMessage(t('asset.onlyImageFilesSupported'));
      scheduleReset(3000);
      return;
    }

    if (!Number.isFinite(file.size) || file.size < 0 || file.size > MAX_ASSET_UPLOAD_BYTES) {
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
        setMessage(normalizeUserFacingErrorMessage(result.error, 'asset.uploadFailed'));
      }
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }
      setStatus('error');
      setMessage(normalizeUserFacingErrorMessage(error, 'asset.uploadFailed'));
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
    const input = fileInputRef.current;
    if (!input) return;

    input.value = '';
    if (typeof input.showPicker === 'function') {
      try {
        input.showPicker();
        return;
      } catch {
        input.click();
        return;
      }
    }
    input.click();
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
        return <Icon name="common.checkCircle" className={cn(iconSize, "text-[var(--vlaina-color-status-success-fg)]")} />;
      case 'duplicate':
        return <Icon name="file.image" className={cn(iconSize, "text-[var(--vlaina-color-status-info-fg)]")} />;
      case 'error':
        return <Icon name="common.error" className={cn(iconSize, "text-[var(--vlaina-color-status-danger-fg)]")} />;
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
        "border-2 border-dashed transition-all duration-[var(--vlaina-duration-200)]",
        compact ? "p-4" : "p-8",
        status === 'dragging' && "border-[var(--vlaina-accent)] bg-[var(--vlaina-color-accent-muted-bg)]",
        status === 'uploading' && "border-[var(--vlaina-accent)] bg-[var(--vlaina-color-accent-muted-bg)]",
        status === 'success' && "border-[var(--vlaina-color-status-success-border)] bg-[var(--vlaina-color-status-success-bg)]",
        status === 'duplicate' && "border-[var(--vlaina-color-status-info-border)] bg-[var(--vlaina-color-status-info-bg)]",
        status === 'error' && "border-[var(--vlaina-color-status-danger-border)] bg-[var(--vlaina-color-status-danger-bg)]",
        status === 'idle' && "border-[var(--vlaina-color-accent-border-muted)] bg-[var(--vlaina-color-accent-muted-bg)] hover:border-[var(--vlaina-accent)] hover:bg-[var(--vlaina-color-accent-soft-bg)]"
      )}
    >
      {getStatusIcon()}

      {statusText && (
        <p className={cn(
          "text-center",
          compact ? "mt-2 text-xs" : "mt-4 text-sm",
          status === 'error' ? "text-[var(--vlaina-color-status-danger-fg)]" : "text-[var(--vlaina-text-secondary)]"
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
        className="sr-only"
      />
    </div>
  );
}
