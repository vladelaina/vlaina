import { BaseDirectory, writeFile, mkdir, exists, readFile } from '@tauri-apps/plugin-fs';
import { appDataDir, join } from '@tauri-apps/api/path';
import { convertFileSrc } from '@tauri-apps/api/core';
import { isTauri } from './adapter';

export interface Attachment {
    id: string;
    path: string;
    previewUrl: string; // Base64 for immediate UI
    assetUrl: string;   // asset:// URL for efficient storage
    name: string;
    type: string;
    size: number;
}

const ATTACHMENT_DIR = 'attachments';

export async function saveAttachment(file: File): Promise<Attachment> {
    console.log(`[Attachment] Saving file: ${file.name}, size: ${file.size}`);

    const base64 = await fileToBase64(file);
    let absolutePath = '';
    let assetUrl = '';

    if (isTauri()) {
        try {
            const dirExists = await exists(ATTACHMENT_DIR, { baseDir: BaseDirectory.AppData });
            if (!dirExists) {
                await mkdir(ATTACHMENT_DIR, { baseDir: BaseDirectory.AppData, recursive: true });
            }

            const ext = file.name.split('.').pop() || 'bin';
            const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
            const relativePath = `${ATTACHMENT_DIR}/${filename}`;

            const buffer = await file.arrayBuffer();
            const data = new Uint8Array(buffer);

            await writeFile(relativePath, data, { baseDir: BaseDirectory.AppData });
            console.log(`[Attachment] Saved to ${relativePath}`);

            const appDataPath = await appDataDir();
            absolutePath = await join(appDataPath, relativePath);
            assetUrl = convertFileSrc(absolutePath);
        } catch (e) {
            console.error('[Attachment] Disk save failed:', e);
        }
    } else {
        assetUrl = base64; // Browser fallback
    }

    return {
        id: Math.random().toString(36).slice(2),
        path: absolutePath,
        previewUrl: base64,
        assetUrl: assetUrl || base64,
        name: file.name,
        type: file.type,
        size: file.size
    };
}

function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
}

export async function convertToBase64(attachment: Attachment): Promise<string> {
    if (attachment.previewUrl.startsWith('data:')) {
        return attachment.previewUrl;
    }
    
    if (isTauri() && attachment.path) {
        try {
            const filename = attachment.path.split(/[\\/]/).pop();
            if (filename) {
                 const data = await readFile(`${ATTACHMENT_DIR}/${filename}`, { baseDir: BaseDirectory.AppData });
                 const binary = String.fromCharCode(...data);
                 const base64 = window.btoa(binary);
                 return `data:${attachment.type};base64,${base64}`;
            }
        } catch (e) {
            console.error('[Attachment] Fallback disk read failed:', e);
        }
    }
    
    throw new Error('Cannot convert attachment to Base64');
}
