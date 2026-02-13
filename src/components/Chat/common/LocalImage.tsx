import { useState, useEffect } from 'react';
import { readFile, BaseDirectory } from '@tauri-apps/plugin-fs';
import { isTauri } from '@/lib/storage/adapter';

interface LocalImageProps {
    src: string;
    alt?: string;
    className?: string;
    onClick?: () => void;
}

export function LocalImage({ src, alt, className, onClick }: LocalImageProps) {
    const [displaySrc, setDisplaySrc] = useState<string>('');
    const [error, setError] = useState(false);

    useEffect(() => {
        let active = true;

        const loadLocalImage = async () => {
            // 1. Standard Web URL or Base64 -> Use directly
            if ((src.startsWith('http') && !src.includes('asset.localhost')) || src.startsWith('https')) {
                setDisplaySrc(src);
                return;
            }
            if (src.startsWith('data:')) {
                setDisplaySrc(src);
                return;
            }

            // 2. Tauri Asset URL -> Read from FS
            if (isTauri()) {
                try {
                    // Fix: Handle assetUrl correctly
                    // Src: http://asset.localhost/C%3A%5CUsers%5C...%5Cattachments%5Cfilename.png
                    const decoded = decodeURIComponent(src);
                    
                    let filename = '';
                    if (decoded.includes('attachments')) {
                        const parts = decoded.split('attachments');
                        // parts[1] is like '\filename.png' or '/filename.png'
                        filename = parts.pop()?.replace(/^[\\/]/, '') || '';
                    } else {
                        // Fallback
                        filename = decoded.split(/[\\/]/).pop() || '';
                    }

                    if (!filename) throw new Error('Invalid filename parsing');

                    // Read from AppData/attachments
                    const data = await readFile(`attachments/${filename}`, { baseDir: BaseDirectory.AppData });
                    
                    // Convert to Base64
                    let binary = '';
                    const len = data.byteLength;
                    for (let i = 0; i < len; i++) {
                        binary += String.fromCharCode(data[i]);
                    }
                    const base64 = window.btoa(binary);
                    
                    // Guess mime type from extension
                    const ext = filename.split('.').pop()?.toLowerCase();
                    const mime = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/webp';
                    
                    if (active) {
                        setDisplaySrc(`data:${mime};base64,${base64}`);
                    }
                } catch (e) {
                    console.error('[LocalImage] Failed to load local image:', src, e);
                    setError(true);
                }
            } else {
                // Browser fallback
                setDisplaySrc(src);
            }
        };

        loadLocalImage();

        return () => { active = false; };
    }, [src]);

    if (error) return null;
    if (!displaySrc) return <div className={`animate-pulse bg-gray-200 dark:bg-zinc-800 ${className}`} style={{ minHeight: '100px', minWidth: '100px' }} />;

    return (
        <img 
            src={displaySrc} 
            alt={alt} 
            className={className} 
            onClick={onClick}
            onError={() => setError(true)}
        />
    );
}