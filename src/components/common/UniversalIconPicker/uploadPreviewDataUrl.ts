import { sanitizeSvgBytes } from '@/lib/markdown/svgSanitizer';

const MAX_ICON_UPLOAD_PREVIEW_BYTES = 10 * 1024 * 1024;

function isSvgFile(file: File): boolean {
    return file.type.split(';')[0]?.trim().toLowerCase() === 'image/svg+xml'
        || /\.svg$/i.test(file.name);
}

export async function readUploadPreviewDataUrl(file: File): Promise<string | null> {
    if (file.size > MAX_ICON_UPLOAD_PREVIEW_BYTES) {
        return null;
    }

    if (isSvgFile(file)) {
        const bytes = sanitizeSvgBytes(new Uint8Array(await file.arrayBuffer()));
        if (bytes.byteLength > MAX_ICON_UPLOAD_PREVIEW_BYTES) {
            return null;
        }
        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new TextDecoder().decode(bytes))}`;
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener('load', () => {
            resolve(typeof reader.result === 'string' ? reader.result : null);
        });
        reader.addEventListener('error', () => reject(reader.error));
        reader.addEventListener('abort', () => reject(new Error('Icon preview file read was aborted')));
        reader.readAsDataURL(file);
    });
}
