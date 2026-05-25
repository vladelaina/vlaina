import { useState, useEffect, type CSSProperties } from 'react';
import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { cn } from '@/lib/utils';
import { translate } from '@/lib/i18n';

interface LocalImageProps {
    src: string;
    alt?: string;
    className?: string;
    'data-vlaina-crop'?: string;
    onClick?: () => void;
    style?: CSSProperties;
}

function inferMimeTypeFromFilename(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'png') return 'image/png';
    if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
    if (ext === 'webp') return 'image/webp';
    if (ext === 'gif') return 'image/gif';
    if (ext === 'bmp') return 'image/bmp';
    if (ext === 'avif') return 'image/avif';
    if (ext === 'svg') return 'image/svg+xml';
    return 'application/octet-stream';
}

function isRelativePath(value: string): boolean {
    return value.startsWith('/') || value.startsWith('./') || value.startsWith('../');
}

function isDirectRenderableSrc(value: string): boolean {
    return (
        value.startsWith('http://') ||
        value.startsWith('https://') ||
        value.startsWith('data:') ||
        value.startsWith('blob:') ||
        isRelativePath(value)
    );
}

function sanitizeAttachmentFilename(value: string): string | null {
    const normalized = value.trim();
    if (!normalized || normalized === '.' || normalized === '..') {
        return null;
    }

    if (/[\\/]/.test(normalized)) {
        return null;
    }

    return normalized;
}

function decodeAttachmentFilename(value: string): string | null {
    try {
        return sanitizeAttachmentFilename(decodeURIComponent(value));
    } catch {
        return sanitizeAttachmentFilename(value);
    }
}

function extractAttachmentFilename(src: string): string | null {
    const trimmed = src.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith('attachment://')) {
        return decodeAttachmentFilename(trimmed.slice('attachment://'.length));
    }

    if (trimmed.startsWith('app-file://attachment/')) {
        return decodeAttachmentFilename(trimmed.slice('app-file://attachment/'.length));
    }

    if (/^[^/\\]+\.[a-z0-9]+$/i.test(trimmed)) {
        return sanitizeAttachmentFilename(trimmed);
    }

    try {
        const url = new URL(trimmed);
        const marker = '/attachments/';
        const markerIndex = url.pathname.lastIndexOf(marker);
        if (markerIndex === -1) return null;
        const filename = decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
        return sanitizeAttachmentFilename(filename);
    } catch {
        return null;
    }
}

function uint8ArrayToBase64(data: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < data.length; i++) {
        binary += String.fromCharCode(data[i]);
    }
    return window.btoa(binary);
}

export function LocalImage({ src, alt, className, onClick, style, 'data-vlaina-crop': dataVlainaCrop }: LocalImageProps) {
    const [displaySrc, setDisplaySrc] = useState<string | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        let active = true;
        setDisplaySrc(null);
        setError(false);

        const loadLocalImage = async () => {
            if (isDirectRenderableSrc(src)) {
                setDisplaySrc(src);
                return;
            }

            const filename = extractAttachmentFilename(src);

            if (!filename) {
                setError(true);
                return;
            }

            try {
                const storage = getStorageAdapter();
                const basePath = await storage.getBasePath();
                const fullPath = await joinPath(basePath, 'attachments', filename);
                const data = await storage.readBinaryFile(fullPath);
                const base64 = uint8ArrayToBase64(data);
                const mime = inferMimeTypeFromFilename(filename);

                if (active) {
                    setDisplaySrc(`data:${mime};base64,${base64}`);
                }
            } catch (e) {
                if (active) {
                    setError(true);
                }
            }
        };

        void loadLocalImage();

        return () => { active = false; };
    }, [src]);

    if (error) {
        return (
            <span
                className={`inline-flex items-center justify-center text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-zinc-800 ${className ?? ''}`}
                style={{ minHeight: '100px', minWidth: '100px' }}
            >
                {translate('chat.imageUnavailable')}
            </span>
        );
    }
    if (!displaySrc) {
        return (
            <span
                className={`inline-block animate-pulse bg-gray-200 dark:bg-zinc-800 ${className}`}
                style={{ minHeight: '100px', minWidth: '100px' }}
            />
        );
    }

    return (
        <img 
            src={displaySrc} 
            alt={alt} 
            className={cn(className, onClick && 'cursor-pointer')} 
            onClick={onClick}
            onError={() => setError(true)}
            style={style}
            data-vlaina-crop={dataVlainaCrop}
        />
    );
}
