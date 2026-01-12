/**
 * UploadZone - Drag and drop upload area for assets
 */

import { useState, useRef, useCallback } from 'react';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { cn } from '@/lib/utils';
import { Upload, CheckCircle, AlertCircle, Image } from 'lucide-react';
import { UploadZoneProps } from './types';

type UploadStatus = 'idle' | 'dragging' | 'uploading' | 'success' | 'duplicate' | 'error';

export function UploadZone({ onUploadComplete, onDuplicateDetected }: UploadZoneProps) {
  const { uploadAsset, uploadProgress } = useNotesStore();
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [message, setMessage] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setStatus('error');
      setMessage('Only image files are supported');
      setTimeout(() => {
        setStatus('idle');
        setMessage('');
      }, 3000);
      return;
    }

    // Validate file size (50MB max)
    if (file.size > 50 * 1024 * 1024) {
      setStatus('error');
      setMessage('File exceeds maximum size of 50MB');
      setTimeout(() => {
        setStatus('idle');
        setMessage('');
      }, 3000);
      return;
    }

    setStatus('uploading');
    setMessage('Uploading...');

    const result = await uploadAsset(file);

    if (result.success) {
      if (result.isDuplicate) {
        setStatus('duplicate');
        setMessage(`Already in library: ${result.existingFilename}`);
        onDuplicateDetected?.(result.existingFilename!);
      } else {
        setStatus('success');
        setMessage('Upload complete!');
      }
      
      if (result.path) {
        onUploadComplete(result.path);
      }
    } else {
      setStatus('error');
      setMessage(result.error || 'Upload failed');
    }

    // Reset after delay
    setTimeout(() => {
      setStatus('idle');
      setMessage('');
    }, 2000);
  }, [uploadAsset, onUploadComplete, onDuplicateDetected]);

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
    // Reset input
    e.target.value = '';
  }, [handleFile]);

  const getStatusIcon = () => {
    switch (status) {
      case 'uploading':
        return (
          <div className="relative">
            <Upload className="w-10 h-10 text-[var(--neko-accent)]" />
            {uploadProgress !== null && (
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-[var(--neko-text-secondary)]">
                {uploadProgress}%
              </div>
            )}
          </div>
        );
      case 'success':
        return <CheckCircle className="w-10 h-10 text-green-500" />;
      case 'duplicate':
        return <Image className="w-10 h-10 text-blue-500" />;
      case 'error':
        return <AlertCircle className="w-10 h-10 text-red-500" />;
      default:
        return <Upload className="w-10 h-10 text-[var(--neko-text-tertiary)]" />;
    }
  };

  const getStatusText = () => {
    if (message) return message;
    if (status === 'dragging') return 'Drop image here';
    return 'Drag and drop an image, or click to browse';
  };

  return (
    <div
      onClick={handleClick}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={cn(
        "flex flex-col items-center justify-center p-8 rounded-lg cursor-pointer",
        "border-2 border-dashed transition-all duration-200",
        status === 'dragging' && "border-[var(--neko-accent)] bg-[var(--neko-accent)]/5",
        status === 'uploading' && "border-[var(--neko-accent)] bg-[var(--neko-accent)]/5",
        status === 'success' && "border-green-500 bg-green-500/5",
        status === 'duplicate' && "border-blue-500 bg-blue-500/5",
        status === 'error' && "border-red-500 bg-red-500/5",
        status === 'idle' && "border-[var(--neko-border)] hover:border-[var(--neko-accent)] hover:bg-[var(--neko-hover)]"
      )}
    >
      {getStatusIcon()}
      
      <p className={cn(
        "mt-4 text-sm text-center",
        status === 'error' ? "text-red-500" : "text-[var(--neko-text-secondary)]"
      )}>
        {getStatusText()}
      </p>

      {status === 'idle' && (
        <p className="mt-1 text-xs text-[var(--neko-text-tertiary)]">
          Supports JPG, PNG, GIF, WebP (max 50MB)
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
