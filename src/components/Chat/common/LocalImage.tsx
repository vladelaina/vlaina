import { useState, useEffect, useRef, type CSSProperties } from 'react';
import { getStorageAdapter } from '@/lib/storage/adapter';
import { cn } from '@/lib/utils';
import { translate } from '@/lib/i18n';
import {
    extractStoredAttachmentFilename,
    inferAttachmentMimeTypeFromFilename,
} from '@/lib/storage/attachmentUrl';
import { getPrimaryAttachmentPath } from '@/lib/storage/attachmentPaths';
import { themeDomStyleTokens } from '@/styles/themeTokens';
import {
    isSvgDataUrl,
    rasterizeSvgDataUrlToPng,
} from './svgRasterize';

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

async function normalizeDisplaySrc(src: string): Promise<string | null> {
    return isSvgDataUrl(src) ? await rasterizeSvgDataUrlToPng(src) : src;
}

export function LocalImage({ src, alt, className, onClick, onResolvedSrc, style, 'data-vlaina-crop': cropData }: LocalImageProps) {
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
                const nextSrc = await normalizeDisplaySrc(src);
                if (!active) return;
                if (!nextSrc) {
                    setError(true);
                    onResolvedSrcRef.current?.(null);
                    return;
                }
                setDisplaySrc(nextSrc);
                onResolvedSrcRef.current?.(nextSrc);
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

                const nextSrc = await normalizeDisplaySrc(`data:${mime};base64,${base64}`);
                if (!active) return;
                if (!nextSrc) {
                    setError(true);
                    onResolvedSrcRef.current?.(null);
                    return;
                }
                setDisplaySrc(nextSrc);
                onResolvedSrcRef.current?.(nextSrc);
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
                    'inline-flex items-center justify-center text-xs text-[var(--vlaina-color-unavailable-fg)]',
                    className,
                )}
                style={{
                    minHeight: themeDomStyleTokens.localImageUnavailableSize,
                    minWidth: themeDomStyleTokens.localImageUnavailableSize,
                }}
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
                style={{
                    minHeight: themeDomStyleTokens.localImageLoadingSize,
                    minWidth: themeDomStyleTokens.localImageLoadingSize,
                }}
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
            data-vlaina-crop={cropData}
        />
    );
}
