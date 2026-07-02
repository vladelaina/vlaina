import { getParentPath, isAbsolutePath } from '@/lib/storage/adapter';
import { getCurrentNotesRootPath } from './storage';

export function resolveEffectiveNotesRootPath(args: {
  notesPath?: string | null;
  currentNotePath?: string | null;
}): string {
  const notesPath = args.notesPath?.trim();
  if (notesPath) {
    return notesPath;
  }

  const currentNotesRootPath = getCurrentNotesRootPath()?.trim();
  if (currentNotesRootPath) {
    return currentNotesRootPath;
  }

  const currentNotePath = args.currentNotePath?.trim();
  if (currentNotePath && isAbsolutePath(currentNotePath)) {
    return getParentPath(currentNotePath) ?? '';
  }

  return '';
}
