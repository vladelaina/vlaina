import type { NoteMentionReference } from '@/lib/ai/noteMentions';
import type { Attachment } from '@/lib/storage/attachmentStorage';
import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { findNode } from '@/stores/notes/fileTreeUtils';
import { IMAGE_NAME_REGEX } from './attachmentKinds';
import {
  IMAGE_EXTENSION_MIME_TYPES,
  MAX_FOLDER_IMAGE_ATTACHMENTS,
  MAX_FOLDER_IMAGE_ATTACHMENT_BYTES,
  MAX_FOLDER_IMAGE_ATTACHMENT_SCAN_ENTRIES,
} from './noteMentionConfig';
import { resolveMentionedFolderPath } from './noteMentionPaths';
import {
  getFolderImageScanPriority,
  isSafeFolderEntryName,
  prioritizeFolderScanEntries,
} from './folderScanUtils';

function inferImageMimeTypeFromName(name: string): string {
  const extension = name.split('.').pop()?.trim().toLowerCase() ?? '';
  return IMAGE_EXTENSION_MIME_TYPES[extension] ?? 'application/octet-stream';
}

function createFolderImageAttachment(entry: { path: string; name: string; size?: number }): Attachment {
  return {
    id: `folder-image:${entry.path}`,
    path: entry.path,
    previewUrl: '',
    assetUrl: '',
    name: entry.name,
    type: inferImageMimeTypeFromName(entry.name),
    size: entry.size ?? 0,
  };
}

function isKnownFolderImageAttachmentOversized(size: number | null | undefined): boolean {
  return typeof size === 'number' && (
    !Number.isFinite(size) ||
    size < 0 ||
    size > MAX_FOLDER_IMAGE_ATTACHMENT_BYTES
  );
}

export async function loadFolderImageAttachmentsForMention(
  mention: NoteMentionReference
): Promise<Attachment[]> {
  const notesState = useNotesStore.getState();
  const folderNode = notesState.rootFolder
    ? findNode(notesState.rootFolder.children, mention.path)
    : null;
  if (mention.kind !== 'folder' && !folderNode?.isFolder) {
    return [];
  }

  const folderPath = await resolveMentionedFolderPath(mention.path);
  if (!folderPath) {
    return [];
  }

  const storage = getStorageAdapter();
  const entries = await storage.listDir(folderPath).catch(() => []);
  const imageEntries = prioritizeFolderScanEntries(
    entries,
    getFolderImageScanPriority,
    MAX_FOLDER_IMAGE_ATTACHMENT_SCAN_ENTRIES,
  )
    .filter((entry) =>
      isSafeFolderEntryName(entry.name) &&
      entry.isFile &&
      IMAGE_NAME_REGEX.test(entry.name)
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  const attachments: Attachment[] = [];
  for (const entry of imageEntries) {
    if (attachments.length >= MAX_FOLDER_IMAGE_ATTACHMENTS) {
      break;
    }
    const entryPath = await joinPath(folderPath, entry.name);
    const stat = typeof entry.size === 'number'
      ? entry
      : await storage.stat(entryPath).catch(() => null);
    if (stat && stat.isFile === false) {
      continue;
    }
    const size = typeof stat?.size === 'number' ? stat.size : entry.size;
    if (isKnownFolderImageAttachmentOversized(size)) {
      continue;
    }
    attachments.push(createFolderImageAttachment({
      path: entryPath,
      name: entry.name,
      size,
    }));
  }
  return attachments;
}
