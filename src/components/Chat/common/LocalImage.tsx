import { useState, useEffect, useRef, type CSSProperties } from 'react';
import { getStorageAdapter } from '@/lib/storage/adapter';
import { cn } from '@/lib/utils';
import { translate } from '@/lib/i18n';
import {
    extractStoredAttachmentFilename,
    inferAttachmentMimeTypeFromFilename,
} from '@/lib/storage/attachmentUrl';
import { MAX_ATTACHMENT_IMAGE_BYTES } from '@/lib/storage/attachmentStorage';
import { normalizeRenderableImageSrc } from '@/components/common/markdown/imagePolicy';
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

function normalizeDirectRenderableSrc(value: string): string | null {
    if (isSvgDataUrl(value)) {
        return value.trim();
    }

    const safeSrc = normalizeRenderableImageSrc(value);
    if (!safeSrc) {
        return null;
    }

    const normalized = safeSrc.toLowerCase();
    if (
        normalized.startsWith('attachment:') ||
        normalized.startsWith('app-file:') ||
        normalized.startsWith('asset:')
    ) {
        return null;
    }

    return (
        normalized.startsWith('http://') ||
        normalized.startsWith('https://') ||
        normalized.startsWith('data:') ||
        normalized.startsWith('blob:')
    ) ? safeSrc : null;
}

function uint8ArrayToBase64(data: Uint8Array): string {
    const CHUNK_SIZE = 0x8000;
    let binary = '';
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
        const chunk = data.subarray(i, i + CHUNK_SIZE);
        binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
    }
    return window.btoa(binary);
}

async function normalizeDisplaySrc(src: string): Promise<string | null> {
    return isSvgDataUrl(src) ? await rasterizeSvgDataUrlToPng(src) : src;
}

function assertStoredAttachmentSize(size: number | null | undefined): void {
    if (typeof size !== 'number' || size > MAX_ATTACHMENT_IMAGE_BYTES) {
        throw new Error('Attachment image is too large.');
    }
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
            const directSrc = normalizeDirectRenderableSrc(src);
            if (directSrc) {
                const nextSrc = await normalizeDisplaySrc(directSrc);
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
                const attachmentPath = await getPrimaryAttachmentPath(basePath, filename);
                const info = await storage.stat(attachmentPath).catch(() => null);
                assertStoredAttachmentSize(info?.size);
                const data = await storage.readBinaryFile(attachmentPath);
                assertStoredAttachmentSize(data.byteLength);
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
            referrerPolicy="no-referrer"
        />
    );
}
