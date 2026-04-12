import { useState, useEffect } from 'react';
import { loadImageAsBlob } from '@/lib/assets/io/reader';
import { getImageSourceBase, isVirtualImageSource, resolveImageSourcePath } from '../utils/imageSourcePath';

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

                const fullPath = await resolveImageSourcePath({
                    rawSrc,
                    notesPath,
                    currentNotePath,
                });

                if (fullPath) {
                    const blobUrl = await loadImageAsBlob(fullPath);
                    if (isMounted) {
                        setResolvedSrc(blobUrl);
                    }
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
