import { useState, useEffect } from 'react';
import { loadImageAsBlob } from '@/lib/assets/imageLoader';
import { joinPath } from '@/lib/storage/adapter';

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
                const baseSrc = rawSrc.split('#')[0];

                // Direct URL/Blob Check
                if (baseSrc.startsWith('http') || baseSrc.startsWith('data:') || baseSrc.startsWith('blob:')) {
                    if (isMounted) {
                        setResolvedSrc(baseSrc);
                        setIsLoading(false);
                    }
                    return;
                }

                // FS Path Resolution
                let fullPath = '';
                if (baseSrc.startsWith('./') || baseSrc.startsWith('../')) {
                    if (currentNotePath) {
                        // Handle Windows/Unix separators normalization
                        const normalizedPath = currentNotePath.replace(/\\/g, '/');
                        const pathParts = normalizedPath.split('/');
                        pathParts.pop(); // Remove filename
                        
                        const parentDir = pathParts.join('/') || notesPath;
                        fullPath = await joinPath(parentDir, baseSrc);
                    }
                } else {
                    fullPath = await joinPath(notesPath, baseSrc);
                }

                if (fullPath) {
                    const blobUrl = await loadImageAsBlob(fullPath);
                    if (isMounted) {
                        setResolvedSrc(blobUrl);
                    }
                } else {
                    // Fallback to original if path resolution failed (though unlikely if joinPath works)
                    if (isMounted) {
                        setResolvedSrc(baseSrc);
                    }
                }
            } catch (err) {
                console.error('Failed to load image:', rawSrc, err);
                if (isMounted) {
                    setError(err instanceof Error ? err : new Error('Unknown error loading image'));
                    // Fallback to original src on error, so at least it tries to render (e.g. if it was a valid URL after all)
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
        };
    }, [rawSrc, notesPath, currentNotePath]);

    return { resolvedSrc, isLoading, error };
}
