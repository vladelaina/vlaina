import { normalizeEditorStateMarkdownDocument } from '@/lib/notes/markdown/markdownSerializationUtils';
import { assertEditorSafeMarkdownContent } from '../document/noteDocumentPersistence';

const MAX_NOTE_DISK_SYNC_BYTES = 10 * 1024 * 1024;
const diskSyncUtf8Encoder = new TextEncoder();

interface DiskSyncFileInfo {
  isFile?: boolean;
  isDirectory?: boolean;
  modifiedAt?: number | null;
  size?: number | null;
}

export function canReadDiskSyncNote(fileInfo: DiskSyncFileInfo | null | undefined): boolean {
  const size = fileInfo?.size;
  return (
    fileInfo?.isDirectory !== true &&
    fileInfo?.isFile !== false &&
    Boolean(fileInfo) &&
    (
      typeof size !== 'number' ||
      (Number.isFinite(size) && size >= 0 && size <= MAX_NOTE_DISK_SYNC_BYTES)
    )
  );
}

export function getKnownFileSize(fileInfo: DiskSyncFileInfo | null | undefined): number | null {
  return typeof fileInfo?.size === 'number' && Number.isFinite(fileInfo.size) && fileInfo.size >= 0
    ? fileInfo.size
    : null;
}

export function getKnownModifiedAt(fileInfo: DiskSyncFileInfo | null | undefined): number | null {
  return typeof fileInfo?.modifiedAt === 'number' && Number.isFinite(fileInfo.modifiedAt)
    ? fileInfo.modifiedAt
    : null;
}

export function hasKnownFileSizeChanged(cachedSize: number | null, diskSize: number | null): boolean {
  return cachedSize !== null && diskSize !== null && cachedSize !== diskSize;
}

function assertDiskSyncContentWithinReadLimit(content: string): void {
  if (
    content.length > MAX_NOTE_DISK_SYNC_BYTES ||
    diskSyncUtf8Encoder.encode(content).length > MAX_NOTE_DISK_SYNC_BYTES
  ) {
    throw new Error('Current note is too large to reload from disk.');
  }
}

export async function readDiskSyncContent(
  storage: { readFile: (path: string, maxBytes?: number) => Promise<string> },
  fullPath: string,
): Promise<{ baselineContent: string; content: string }> {
  const rawDiskContent = await storage.readFile(fullPath, MAX_NOTE_DISK_SYNC_BYTES);
  assertDiskSyncContentWithinReadLimit(rawDiskContent);
  assertEditorSafeMarkdownContent(rawDiskContent);
  return {
    baselineContent: rawDiskContent,
    content: normalizeEditorStateMarkdownDocument(rawDiskContent),
  };
}
