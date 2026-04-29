import { moveDesktopItemToTrash } from '@/lib/desktop/trash';
import { getStorageAdapter, isElectron } from '@/lib/storage/adapter';

export async function deleteNoteItemToRecoverableLocation(
  fullPath: string,
  kind: 'file' | 'folder'
): Promise<void> {
  if (isElectron()) {
    await moveDesktopItemToTrash(fullPath);
    return;
  }

  const storage = getStorageAdapter();
  if (kind === 'folder') {
    await storage.deleteDir(fullPath, true);
    return;
  }

  await storage.deleteFile(fullPath);
}
