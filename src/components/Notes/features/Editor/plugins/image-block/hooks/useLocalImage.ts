import { useState, useEffect } from 'react';
import { loadImageAsBlob } from '@/lib/assets/io/reader';
import { getStorageAdapter } from '@/lib/storage/adapter';
import { normalizePublicRemoteMediaUrl, sanitizeNoteMediaSrc } from '@/lib/notes/markdown/urlSecurity';
import { getImageSourceBase, isVirtualImageSource, resolveImageSourcePathCandidates } from '../utils/imageSourcePath';
import { resolveRemoteImageFromMemoryCache } from '../utils/remoteImageMemoryCache';

interface UseLocalImageResult {
    resolvedSrc: string;
    isLoading: boolean;
    error: Error | null;
}

export function useLocalImage(
    rawSrc: string,
    notesPath: string,
    currentNotePath: string | undefined,
    enabled = true
): UseLocalImageResult {
    const [resolvedSrc, setResolvedSrc] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        let isMounted = true;

        const resolveImage = async () => {
            if (!enabled) {
                if (isMounted) {
                    setIsLoading(false);
                    setError(null);
                    setResolvedSrc('');
                }
                return;
            }

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
                const baseSrc = getImageSourceBase(rawSrc);
                const safeBaseSrc = sanitizeNoteMediaSrc(baseSrc);
                if (!safeBaseSrc) {
                    if (isMounted) {
                        setResolvedSrc('');
                        setIsLoading(false);
                    }
                    return;
                }

                const normalizedRemoteSrc = normalizePublicRemoteMediaUrl(safeBaseSrc);
                if (normalizedRemoteSrc) {
                    const resolvedRemoteSrc = await resolveRemoteImageFromMemoryCache(normalizedRemoteSrc);
                    if (isMounted) {
                        setResolvedSrc(resolvedRemoteSrc);
                        setIsLoading(false);
                    }
                    return;
                }

                if (isVirtualImageSource(safeBaseSrc)) {
                    if (isMounted) {
                        setResolvedSrc(safeBaseSrc);
                        setIsLoading(false);
                    }
                    return;
                }

                const candidatePaths = await resolveImageSourcePathCandidates({
                    rawSrc: safeBaseSrc,
                    notesPath,
                    currentNotePath,
                });

                if (candidatePaths.length > 0) {
                    let pathsToTry = candidatePaths;

                    if (candidatePaths.length > 1) {
                        const storage = getStorageAdapter();
                        const existingPaths: string[] = [];

                        for (const candidatePath of candidatePaths) {
                            if (await storage.exists(candidatePath).catch(() => false)) {
                                existingPaths.push(candidatePath);
                            }
                        }

                        if (existingPaths.length > 0) {
                            pathsToTry = existingPaths;
                        }
                    }

                    let lastError: unknown = null;

                    for (const fullPath of pathsToTry) {
                        try {
                            const blobUrl = await loadImageAsBlob(fullPath);
                            if (isMounted) {
                                setResolvedSrc(blobUrl);
                            }
                            return;
                        } catch (err) {
                            lastError = err;
                        }
                    }

                    throw lastError ?? new Error(`Failed to load image: ${rawSrc}`);
                } else {
                    if (isMounted) {
                        setResolvedSrc(baseSrc);
                    }
                }
            } catch (err) {
                if (isMounted) {
                    setError(err instanceof Error ? err : new Error('Unknown error loading image'));
                    setResolvedSrc(getImageSourceBase(rawSrc));
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
        };
    }, [rawSrc, notesPath, currentNotePath, enabled]);

    return { resolvedSrc, isLoading, error };
}
