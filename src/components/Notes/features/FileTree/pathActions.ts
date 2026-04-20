import { isAbsolutePath, joinPath } from '@/lib/storage/adapter';
import { revealItemInFolder } from '@/lib/desktop/shell';

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
  await revealItemInFolder(absolutePath);
}
