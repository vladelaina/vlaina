import type { NoteMentionReference } from '@/lib/ai/noteMentions';
import { getStorageAdapter } from '@/lib/storage/adapter';
import { MAX_FOLDER_LISTING_ENTRIES, MAX_FOLDER_LISTING_SCAN_ENTRIES } from './noteMentionConfig';
import { resolveMentionedFolderPath } from './noteMentionPaths';
import {
  formatFolderEntrySize,
  formatPromptLabel,
  getFolderListingScanPriority,
  isSafeFolderListingEntryName,
  prioritizeFolderScanEntries,
} from './folderScanUtils';

export async function loadFolderListingReference(
  mention: NoteMentionReference
): Promise<NoteMentionReference & { content: string } | null> {
  const folderPath = await resolveMentionedFolderPath(mention.path);
  if (!folderPath) {
    return null;
  }

  const storage = getStorageAdapter();
  const entries = await storage.listDir(folderPath, { includeHidden: true }).catch(() => []);
  if (entries.length === 0) {
    return {
      ...mention,
      kind: 'folder',
      content: [
        `Folder: ${formatPromptLabel(mention.path, 'folder')}`,
        '',
        'Folder listing is empty or unavailable.',
      ].join('\n'),
    };
  }

  const scannedEntries = prioritizeFolderScanEntries(
    entries,
    getFolderListingScanPriority,
    MAX_FOLDER_LISTING_SCAN_ENTRIES,
  );
  const visibleEntries = scannedEntries
    .filter((entry) => isSafeFolderListingEntryName(entry.name))
    .sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  const listedEntries = visibleEntries.slice(0, MAX_FOLDER_LISTING_ENTRIES);
  const lines = listedEntries.map((entry) => {
    const kind = entry.isDirectory ? 'folder' : 'file';
    return `- ${formatPromptLabel(entry.name, 'unnamed')} (${kind}${formatFolderEntrySize(entry.size)})`;
  });
  const hiddenCount = entries.length > scannedEntries.length
    ? Math.max(entries.length - listedEntries.length, 0)
    : Math.max(visibleEntries.length - listedEntries.length, 0);

  return {
    ...mention,
    kind: 'folder',
    content: [
      `Folder: ${formatPromptLabel(mention.path, 'folder')}`,
      '',
      'Directory listing:',
      '',
      lines.join('\n'),
      hiddenCount > 0 ? `\n...and ${hiddenCount} more entries.` : '',
      '',
      'Top-level image files in this folder may be attached separately when supported; non-image binary contents are represented only by names, types, and sizes.',
    ].filter(Boolean).join('\n'),
  };
}
