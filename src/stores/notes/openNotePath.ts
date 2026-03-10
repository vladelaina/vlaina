import { isAbsolutePath } from '@/lib/storage/adapter';
import { isCloudNoteLogicalPath } from '@/stores/cloudRepos';

export async function openStoredNotePath(
  path: string,
  handlers: {
    openNote: (path: string) => Promise<void>;
    openNoteByAbsolutePath: (path: string) => Promise<void>;
  }
): Promise<void> {
  if (isCloudNoteLogicalPath(path) || !isAbsolutePath(path)) {
    await handlers.openNote(path);
    return;
  }

  await handlers.openNoteByAbsolutePath(path);
}
