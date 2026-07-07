import { getCroppedImg } from '@/lib/assets/processing/crop';

interface CreateUploadIconFileArgs {
    imageSrc: string;
    croppedAreaPixels: { x: number; y: number; width: number; height: number } | null;
    originalFile: File | null;
    isGif: boolean;
    isWebP: boolean;
}

export async function createUploadIconFile({
    imageSrc,
    croppedAreaPixels,
    originalFile,
    isGif,
    isWebP,
}: CreateUploadIconFileArgs): Promise<File> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T');
    const finalName = `icon_${timestamp[0]}_${timestamp[1].split('Z')[0]}`;

    if ((isGif || isWebP) && originalFile) {
        const ext = isGif ? 'gif' : 'webp';
        return new File([originalFile], `${finalName}.${ext}`, { type: originalFile.type });
    }

    if (!croppedAreaPixels) throw new Error('Missing crop area');

    const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
    if (!croppedBlob) throw new Error('Failed to crop image');

    return new File([croppedBlob], `${finalName}.png`, { type: 'image/png' });
}
