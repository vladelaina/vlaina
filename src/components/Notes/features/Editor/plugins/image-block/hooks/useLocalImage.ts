import { useState, useEffect, useRef } from 'react';
import { loadImageAsBlob } from '@/lib/assets/imageLoader';
import { joinPath } from '@/lib/storage/adapter';

interface UseLocalImageResult {
    resolvedSrc: string;
    isLoading: boolean;
    error: Error | null;
}

const blobUrlCache = new Map<string, { url: string; refCount: number }>();

function acquireBlobUrl(key: string, url: string): void {
    const existing = blobUrlCache.get(key);
    if (existing) {
        existing.refCount++;
    } else {
        blobUrlCache.set(key, { url, refCount: 1 });
    }
}

function releaseBlobUrl(key: string): void {
    const existing = blobUrlCache.get(key);
    if (existing) {
        existing.refCount--;
        if (existing.refCount <= 0) {
            URL.revokeObjectURL(existing.url);
            blobUrlCache.delete(key);
        }
    }
}

function getCachedBlobUrl(key: string): string | null {
    return blobUrlCache.get(key)?.url || null;
}

export function useLocalImage(
    rawSrc: string,
    notesPath: string,
    currentNotePath: string | undefined
): UseLocalImageResult {
    const [resolvedSrc, setResolvedSrc] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const cacheKeyRef = useRef<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        const resolveImage = async () => {
            if (!rawSrc) {
                if (isMounted) {
                    setIsLoading(false);
                    setResolvedSrc('');
                }
                return;
            }

            setIsLoading(true);
            setError(null);

            try {
                const baseSrc = rawSrc.split('#')[0];

                if (baseSrc.startsWith('http') || baseSrc.startsWith('data:') || baseSrc.startsWith('blob:')) {
                    if (isMounted) {
                        setResolvedSrc(baseSrc);
                        setIsLoading(false);
                    }
                    return;
                }

                let fullPath = '';
                if (baseSrc.startsWith('./') || baseSrc.startsWith('../')) {
                    if (currentNotePath) {
                        const normalizedPath = currentNotePath.replace(/\\/g, '/');
                        const pathParts = normalizedPath.split('/');
                        pathParts.pop();

                        const parentDir = pathParts.join('/') || notesPath;
                        fullPath = await joinPath(parentDir, baseSrc);
                    }
                } else {
                    fullPath = await joinPath(notesPath, baseSrc);
                }

                if (fullPath) {
                    const cachedUrl = getCachedBlobUrl(fullPath);
                    if (cachedUrl) {
                        if (isMounted) {
                            if (cacheKeyRef.current && cacheKeyRef.current !== fullPath) {
                                releaseBlobUrl(cacheKeyRef.current);
                            }
                            cacheKeyRef.current = fullPath;
                            acquireBlobUrl(fullPath, cachedUrl);
                            setResolvedSrc(cachedUrl);
                        }
                    } else {
                        const blobUrl = await loadImageAsBlob(fullPath);
                        if (isMounted) {
                            if (cacheKeyRef.current && cacheKeyRef.current !== fullPath) {
                                releaseBlobUrl(cacheKeyRef.current);
                            }
                            cacheKeyRef.current = fullPath;
                            acquireBlobUrl(fullPath, blobUrl);
                            setResolvedSrc(blobUrl);
                        } else {
                            URL.revokeObjectURL(blobUrl);
                        }
                    }
                } else {
                    if (isMounted) {
                        setResolvedSrc(baseSrc);
                    }
                }
            } catch (err) {
                if (isMounted) {
                    setError(err instanceof Error ? err : new Error('Unknown error loading image'));
                    setResolvedSrc(rawSrc.split('#')[0]);
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        resolveImage();

        return () => {
            isMounted = false;
            if (cacheKeyRef.current) {
                releaseBlobUrl(cacheKeyRef.current);
                cacheKeyRef.current = null;
            }
        };
    }, [rawSrc, notesPath, currentNotePath]);

    return { resolvedSrc, isLoading, error };
}
