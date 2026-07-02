import { openPathInFileManager, revealItemInFolder } from '@/lib/desktop/shell';
import { writeTextToClipboard } from '@/lib/clipboard';
import { desktopWindow } from '@/lib/desktop/window';
import { resolveNotesRootRelativeFullPath } from '@/stores/notes/utils/fs/notesRootPathContainment';

async function resolveAbsoluteTreeItemPath(notesPath: string, itemPath: string) {
  if (!notesPath) {
    throw new Error('Notes path is not available');
  }

  const { fullPath } = await resolveNotesRootRelativeFullPath(notesPath, itemPath, { allowEmpty: true });
  return fullPath;
}

export async function copyTreeItemPath(notesPath: string, itemPath: string) {
  const absolutePath = await resolveAbsoluteTreeItemPath(notesPath, itemPath);
  await writeTextToClipboard(absolutePath);
}

export async function openTreeItemLocation(
  notesPath: string,
  itemPath: string,
  itemKind: 'file' | 'folder' = 'file',
) {
  const absolutePath = await resolveAbsoluteTreeItemPath(notesPath, itemPath);
  if (itemKind === 'folder') {
    await openPathInFileManager(absolutePath);
    return;
  }
  await revealItemInFolder(absolutePath);
}

export async function openTreeItemInNewWindow(
  notesPath: string,
  itemPath: string,
  itemKind: 'file' | 'folder',
) {
  await resolveAbsoluteTreeItemPath(notesPath, itemPath);
  await desktopWindow.create({
    notesRootPath: notesPath,
    notePath: itemKind === 'file' ? itemPath : null,
    folderPath: itemKind === 'folder' ? itemPath : null,
    viewMode: 'notes',
  });
}
