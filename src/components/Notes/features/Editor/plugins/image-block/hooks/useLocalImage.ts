import { useState, useEffect } from 'react';
import { dirname, isAbsolute, join } from '@tauri-apps/api/path';
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

                let fullPath = '';
                
                if (await isAbsolute(baseSrc)) {
                    fullPath = baseSrc;
                } 
                else if (baseSrc.startsWith('./') || baseSrc.startsWith('../')) {
                    if (currentNotePath) {
                        const absoluteNotePath = await isAbsolute(currentNotePath) 
                            ? currentNotePath 
                            : await join(notesPath, currentNotePath);
                            
                        const parentDir = await dirname(absoluteNotePath);
                        fullPath = await join(parentDir, baseSrc);
                    } else {
                        fullPath = await join(notesPath, baseSrc);
                    }
                } 
                else {
                    if (currentNotePath) {
                         const absoluteNotePath = await isAbsolute(currentNotePath) 
                            ? currentNotePath 
                            : await join(notesPath, currentNotePath);
                        const parentDir = await dirname(absoluteNotePath);
                        fullPath = await join(parentDir, baseSrc);
                    } else {
                        fullPath = await join(notesPath, baseSrc);
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
