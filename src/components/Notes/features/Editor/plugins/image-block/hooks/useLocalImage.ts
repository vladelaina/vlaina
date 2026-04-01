import { useState, useEffect } from 'react';
import { getParentPath, isAbsolutePath, joinPath } from '@/lib/storage/adapter';
import { loadImageAsBlob } from '@/lib/assets/io/reader';

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

                if (baseSrc.startsWith('http') || baseSrc.startsWith('data:') || baseSrc.startsWith('blob:') || baseSrc.startsWith('asset:')) {
                    if (isMounted) {
                        setResolvedSrc(baseSrc);
                        setIsLoading(false);
                    }
                    return;
                }

                if (!notesPath && !isAbsolutePath(baseSrc)) {
                    if (isMounted) {
                        setResolvedSrc(baseSrc);
                        setIsLoading(false);
                    }
                    return;
                }

                let fullPath = '';
                
                if (isAbsolutePath(baseSrc)) {
                    fullPath = baseSrc;
                } 
                else if (baseSrc.startsWith('./') || baseSrc.startsWith('../')) {
                    if (currentNotePath) {
                        const absoluteNotePath = isAbsolutePath(currentNotePath) 
                            ? currentNotePath 
                            : await joinPath(notesPath, currentNotePath);
                            
                        const parentDir = getParentPath(absoluteNotePath) || notesPath;
                        fullPath = await joinPath(parentDir, baseSrc);
                    } else {
                        fullPath = await joinPath(notesPath, baseSrc);
                    }
                } 
                else {
                    if (currentNotePath) {
                         const absoluteNotePath = isAbsolutePath(currentNotePath) 
                            ? currentNotePath 
                            : await joinPath(notesPath, currentNotePath);
                        const parentDir = getParentPath(absoluteNotePath) || notesPath;
                        fullPath = await joinPath(parentDir, baseSrc);
                    } else {
                        fullPath = await joinPath(notesPath, baseSrc);
                    }
                }

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
                    console.warn(`Failed to resolve image: ${rawSrc}`, err);
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
        };
    }, [rawSrc, notesPath, currentNotePath]);

    return { resolvedSrc, isLoading, error };
}
