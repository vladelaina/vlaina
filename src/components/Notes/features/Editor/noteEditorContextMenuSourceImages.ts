import { translate } from '@/lib/i18n';
import { getMimeType, isImageFilename } from '@/lib/assets/core/naming';
import { getBaseName, getStorageAdapter } from '@/lib/storage/adapter';
import { openDialog } from '@/lib/storage/dialog';
import { useNotesStore } from '@/stores/useNotesStore';
import { formatSourceEditorUploadedImages, uploadSourceEditorImageFiles } from './sourceEditorImagePaste';

const MAX_PICKED_IMAGE_BYTES = 50 * 1024 * 1024;

export async function pickSourceContextMenuImage(): Promise<{ markdown: string; notePath: string } | null> {
  const notePath = useNotesStore.getState().currentNote?.path;
  if (!notePath) return null;

  try {
    const selected = await openDialog({
      title: translate('editor.insertImage'),
      authorizeParentDirectory: true,
      filters: [{
        name: translate('editor.images'),
        extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'],
      }],
    });
    const selectedPath = Array.isArray(selected) ? selected[0] : selected;
    if (!selectedPath || !isImageFilename(selectedPath)) return null;

    const storage = getStorageAdapter();
    const info = await storage.stat(selectedPath).catch(() => null);
    if (!info?.isFile || (info.size !== undefined && info.size !== null && info.size > MAX_PICKED_IMAGE_BYTES)) {
      return null;
    }
    const bytes = await storage.readBinaryFile(selectedPath, MAX_PICKED_IMAGE_BYTES);
    if (bytes.byteLength > MAX_PICKED_IMAGE_BYTES) return null;
    const fileName = getBaseName(selectedPath) || 'image';
    const file = new File([new Uint8Array(bytes)], fileName, { type: getMimeType(fileName) });
    const paths = await uploadSourceEditorImageFiles([file], notePath);
    if (paths.length === 0) return null;
    return { markdown: formatSourceEditorUploadedImages(paths), notePath };
  } catch {
    return null;
  }
}
