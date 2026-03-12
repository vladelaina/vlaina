import { isAbsolutePath } from '@/lib/storage/adapter';

export async function openStoredNotePath(
  path: string,
  handlers: {
    openNote: (path: string) => Promise<void>;
    openNoteByAbsolutePath: (path: string) => Promise<void>;
  }
): Promise<void> {
  if (!isAbsolutePath(path)) {
    await handlers.openNote(path);
    return;
  }

  await handlers.openNoteByAbsolutePath(path);
}
