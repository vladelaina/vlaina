import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { getNotesBasePath } from '../../storage';

export async function uploadNoteAssetImpl(
    notesPath: string,
    file: File
): Promise<string | null> {
    const storage = getStorageAdapter();
    const vaultPath = notesPath || await getNotesBasePath();

    const assetsDir = await joinPath(vaultPath, '.nekotick', 'assets', 'covers');
    if (!await storage.exists(assetsDir)) {
        await storage.mkdir(assetsDir, true);
    }

    let originalName = file.name;
    const isGenericName = /^image(\s\(\d+\))?\.(png|jpg|jpeg|webp)$/i.test(originalName) || 
                          /^Pasted Graphic/.test(originalName);

    if (isGenericName) {
        const now = new Date();
        const timestamp = now.getFullYear() + '-' +
            String(now.getMonth() + 1).padStart(2, '0') + '-' +
            String(now.getDate()).padStart(2, '0') + '_' +
            String(now.getHours()).padStart(2, '0') + '-' +
            String(now.getMinutes()).padStart(2, '0') + '-' +
            String(now.getSeconds()).padStart(2, '0');
        
        const ext = originalName.split('.').pop() || 'png';
        originalName = `${timestamp}.${ext}`;
    }

    const dotIndex = originalName.lastIndexOf('.');
    const nameWithoutExt = dotIndex !== -1 ? originalName.substring(0, dotIndex) : originalName;
    const ext = dotIndex !== -1 ? originalName.substring(dotIndex + 1) : 'jpg';
    
    let fileName = originalName;
    let fullPath = await joinPath(assetsDir, fileName);
    let counter = 1;

    while (await storage.exists(fullPath)) {
        fileName = `${nameWithoutExt} (${counter}).${ext}`;
        fullPath = await joinPath(assetsDir, fileName);
        counter++;
    }

    const buffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(buffer);

    await storage.writeBinaryFile(fullPath, uint8Array);

    return fileName;
}
