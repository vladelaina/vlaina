import { isAbsolutePath } from '@/lib/storage/adapter';

export async function openStoredNotePath(
  path: string,
  handlers: {
    openNote: (path: string, openInNewTab?: boolean) => Promise<void>;
    openNoteByAbsolutePath: (path: string, openInNewTab?: boolean) => Promise<void>;
  },
  options?: {
    openInNewTab?: boolean;
  },
): Promise<void> {
  if (!isAbsolutePath(path)) {
    await handlers.openNote(path, options?.openInNewTab);
    return;
  }

  await handlers.openNoteByAbsolutePath(path, options?.openInNewTab);
}
