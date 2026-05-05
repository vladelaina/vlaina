import { useState, useEffect } from 'react';
import { loadImageAsBlob } from '@/lib/assets/io/reader';
import { getStorageAdapter } from '@/lib/storage/adapter';
import { getImageSourceBase, isVirtualImageSource, resolveImageSourcePathCandidates } from '../utils/imageSourcePath';

interface UseLocalImageResult {
    resolvedSrc: string;
    isLoading: boolean;
    error: Error | null;
}

export function useLocalImage(
    rawSrc: string,
    notesPath: string,
    currentNotePath: string | undefined
): UseLocalImageResult {
    const [resolvedSrc, setResolvedSrc] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

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
                const baseSrc = getImageSourceBase(rawSrc);

                if (isVirtualImageSource(baseSrc)) {
                    if (isMounted) {
                        setResolvedSrc(baseSrc);
                        setIsLoading(false);
                    }
                    return;
                }

                const candidatePaths = await resolveImageSourcePathCandidates({
                    rawSrc,
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
                    if (import.meta.env.DEV) console.warn(`Failed to resolve image: ${rawSrc}`, err);
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
    }, [rawSrc, notesPath, currentNotePath]);

    return { resolvedSrc, isLoading, error };
}
