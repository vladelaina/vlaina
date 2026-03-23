import { useState, useEffect } from 'react';
import { readFile, BaseDirectory } from '@tauri-apps/plugin-fs';
import { isTauri } from '@/lib/storage/adapter';

interface LocalImageProps {
    src: string;
    alt?: string;
    className?: string;
    onClick?: () => void;
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
    if (!/^[A-Za-z0-9._-]{1,255}$/.test(normalized)) {
        return null;
    }
    return normalized;
}

function extractAttachmentFilename(src: string): string | null {
    const decoded = decodeURIComponent(src);

    try {
        const parsed = new URL(decoded);
        const protocol = parsed.protocol.toLowerCase();
        const hostname = parsed.hostname.trim().toLowerCase();
        const pathname = parsed.pathname || '';

        if (
            protocol === 'asset:' &&
            (hostname === 'localhost' || hostname === 'asset.localhost')
        ) {
            const basename = pathname.split('/').pop() || '';
            return sanitizeAttachmentFilename(basename);
        }

        if (
            (protocol === 'http:' || protocol === 'https:') &&
            hostname === 'asset.localhost'
        ) {
            const basename = pathname.split('/').pop() || '';
            return sanitizeAttachmentFilename(basename);
        }
    } catch {
        return null;
    }

    return null;
}

export function LocalImage({ src, alt, className, onClick }: LocalImageProps) {
    const [displaySrc, setDisplaySrc] = useState<string>('');
    const [error, setError] = useState(false);

    useEffect(() => {
        let active = true;
        setError(false);
        setDisplaySrc('');

        const loadLocalImage = async () => {
            if (isDirectRenderableSrc(src)) {
                setDisplaySrc(src);
                return;
            }

            const filename = extractAttachmentFilename(src);

            if (isTauri() && filename) {
                try {
                    const data = await readFile(`attachments/${filename}`, { baseDir: BaseDirectory.AppData });
                    
                    let binary = '';
                    const len = data.byteLength;
                    for (let i = 0; i < len; i++) {
                        binary += String.fromCharCode(data[i]);
                    }
                    const base64 = window.btoa(binary);
                    
                    const mime = inferMimeTypeFromFilename(filename);
                    
                    if (active) {
                        setDisplaySrc(`data:${mime};base64,${base64}`);
                    }
                } catch (e) {
                    console.error('[LocalImage] Failed to load local image:', src, e);
                    if (active) {
                        setError(true);
                    }
                }
            } else {
                setError(true);
            }
        };

        loadLocalImage();

        return () => { active = false; };
    }, [src]);

    if (error) {
        return (
            <span
                className={`inline-flex items-center justify-center text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-zinc-800 ${className ?? ''}`}
                style={{ minHeight: '100px', minWidth: '100px' }}
            >
                Image unavailable
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
            className={className} 
            onClick={onClick}
            onError={() => setError(true)}
        />
    );
}
