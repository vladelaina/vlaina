import { isAbsolutePath, joinPath } from '@/lib/storage/adapter';
import { safeInvoke } from '@/lib/tauri/invoke';

async function resolveAbsoluteTreeItemPath(notesPath: string, itemPath: string) {
  if (!notesPath) {
    throw new Error('Notes path is not available');
  }

  return isAbsolutePath(itemPath) ? itemPath : joinPath(notesPath, itemPath);
}

export async function copyTreeItemPath(notesPath: string, itemPath: string) {
  const absolutePath = await resolveAbsoluteTreeItemPath(notesPath, itemPath);
  await navigator.clipboard.writeText(absolutePath);
}

export async function openTreeItemLocation(notesPath: string, itemPath: string) {
  const absolutePath = await resolveAbsoluteTreeItemPath(notesPath, itemPath);
  await safeInvoke('open_in_system_file_manager', { path: absolutePath }, {
    throwOnWeb: true,
    webErrorMessage: 'Opening the system file manager is only available in the desktop app.',
  });
}
