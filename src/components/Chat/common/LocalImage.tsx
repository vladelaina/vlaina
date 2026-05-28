import { useState, useEffect, useRef, type CSSProperties } from 'react';
import { getStorageAdapter } from '@/lib/storage/adapter';
import { cn } from '@/lib/utils';
import { translate } from '@/lib/i18n';
import {
    extractStoredAttachmentFilename,
    inferAttachmentMimeTypeFromFilename,
} from '@/lib/storage/attachmentUrl';
import { getPrimaryAttachmentPath } from '@/lib/storage/attachmentPaths';

interface LocalImageProps {
    src: string;
    alt?: string;
    className?: string;
    'data-vlaina-crop'?: string;
    onClick?: () => void;
    onResolvedSrc?: (src: string | null) => void;
    style?: CSSProperties;
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

function uint8ArrayToBase64(data: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < data.length; i++) {
        binary += String.fromCharCode(data[i]);
    }
    return window.btoa(binary);
}

export function LocalImage({ src, alt, className, onClick, onResolvedSrc, style, 'data-vlaina-crop': dataVlainaCrop }: LocalImageProps) {
    const [displaySrc, setDisplaySrc] = useState<string | null>(null);
    const [error, setError] = useState(false);
    const onResolvedSrcRef = useRef(onResolvedSrc);

    useEffect(() => {
        onResolvedSrcRef.current = onResolvedSrc;
    }, [onResolvedSrc]);

    useEffect(() => {
        let active = true;
        setDisplaySrc(null);
        onResolvedSrcRef.current?.(null);
        setError(false);

        const loadLocalImage = async () => {
            if (isDirectRenderableSrc(src)) {
                setDisplaySrc(src);
                onResolvedSrcRef.current?.(src);
                return;
            }

            const filename = extractStoredAttachmentFilename(src);

            if (!filename) {
                setError(true);
                return;
            }

            try {
                const storage = getStorageAdapter();
                const basePath = await storage.getBasePath();
                const data = await storage.readBinaryFile(await getPrimaryAttachmentPath(basePath, filename));
                const base64 = uint8ArrayToBase64(data);
                const mime = inferAttachmentMimeTypeFromFilename(filename);

                if (active) {
                    const nextSrc = `data:${mime};base64,${base64}`;
                    setDisplaySrc(nextSrc);
                    onResolvedSrcRef.current?.(nextSrc);
                }
            } catch {
                if (active) {
                    setError(true);
                    onResolvedSrcRef.current?.(null);
                }
            }
        };

        void loadLocalImage();

        return () => { active = false; };
    }, [src]);

    if (error) {
        return (
            <span
                className={cn(
                    'inline-flex items-center justify-center text-xs text-gray-500 dark:text-gray-400',
                    className,
                )}
                style={{ minHeight: '100px', minWidth: '100px' }}
            >
                {translate('chat.imageUnavailable')}
            </span>
        );
    }
    if (!displaySrc) {
        return (
            <span
                aria-hidden="true"
                className={cn(
                    'inline-block bg-transparent',
                    className,
                )}
                style={{ minHeight: '72px', minWidth: '72px' }}
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
