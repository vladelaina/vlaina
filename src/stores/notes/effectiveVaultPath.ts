import { getParentPath, isAbsolutePath } from '@/lib/storage/adapter';
import { getCurrentVaultPath } from './storage';

export function resolveEffectiveVaultPath(args: {
  notesPath?: string | null;
  currentNotePath?: string | null;
}): string {
  const notesPath = args.notesPath?.trim();
  if (notesPath) {
    return notesPath;
  }

  const currentVaultPath = getCurrentVaultPath()?.trim();
  if (currentVaultPath) {
    return currentVaultPath;
  }

  const currentNotePath = args.currentNotePath?.trim();
  if (currentNotePath && isAbsolutePath(currentNotePath)) {
    return getParentPath(currentNotePath) ?? '';
  }

  return '';
}
