import type { StorageAdapter } from '@/lib/storage/adapter';
import { MAX_NOTE_DOCUMENT_BYTES, assertEditorSafeMarkdownContent } from './noteDocumentGuards';

function normalizeDiskEncoding(content: string): string {
  const withoutBom = content.startsWith('\uFEFF') ? content.slice(1) : content;
  return withoutBom.replace(/\r\n?/g, '\n');
}

export async function writeNoteFileIfSemanticallyUnchanged({
  storage,
  fullPath,
  expectedContent,
  content,
}: {
  storage: StorageAdapter;
  fullPath: string;
  expectedContent: string | null;
  content: string;
}): Promise<boolean> {
  if (!storage.writeFileIfUnchanged) return false;
  if (await storage.writeFileIfUnchanged(fullPath, expectedContent, content)) return true;
  if (expectedContent === null) return false;

  const currentDiskContent = await storage.readFile(fullPath, MAX_NOTE_DOCUMENT_BYTES);
  assertEditorSafeMarkdownContent(currentDiskContent);
  if (
    normalizeDiskEncoding(currentDiskContent)
    !== normalizeDiskEncoding(expectedContent)
  ) {
    return false;
  }

  return storage.writeFileIfUnchanged(fullPath, currentDiskContent, content);
}
