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
            if ((src.startsWith('http') && !src.includes('asset.localhost')) || src.startsWith('https')) {
                setDisplaySrc(src);
                return;
            }
            if (src.startsWith('data:')) {
                setDisplaySrc(src);
                return;
            }

            if (isTauri()) {
                try {
                    const decoded = decodeURIComponent(src);
                    
                    let filename = '';
                    if (decoded.includes('attachments')) {
                        const parts = decoded.split('attachments');
                        filename = parts.pop()?.replace(/^[\\/]/, '') || '';
                    } else {
                        filename = decoded.split(/[\\/]/).pop() || '';
                    }

                    if (!filename) throw new Error('Invalid filename parsing');

                    const data = await readFile(`attachments/${filename}`, { baseDir: BaseDirectory.AppData });
                    
                    let binary = '';
                    const len = data.byteLength;
                    for (let i = 0; i < len; i++) {
                        binary += String.fromCharCode(data[i]);
                    }
                    const base64 = window.btoa(binary);
                    
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
