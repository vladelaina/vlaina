import type { NoteMentionReference } from '@/lib/ai/noteMentions';
import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { isSupportedMarkdownPath, stripSupportedMarkdownExtension } from '@/lib/notes/markdownFile';
import { stripManagedFrontmatter } from '@/stores/notes/frontmatter';
import { mapWithConcurrencyLimit } from './helperCore';
import {
  MAX_CHAT_MENTION_LOAD_CONCURRENCY,
  MAX_FOLDER_MARKDOWN_LISTING_SCAN_ENTRIES,
  MAX_FOLDER_MARKDOWN_SCAN_DEPTH,
  MAX_FOLDER_MARKDOWN_SCAN_ENTRIES,
  MAX_FOLDER_MENTION_NOTE_CANDIDATES,
  MAX_FOLDER_MENTION_NOTES,
} from './noteMentionConfig';
import { readResolvedMentionedNoteContent } from './noteMentionContent';
import { resolveMentionedPath } from './noteMentionPaths';
import {
  isSafeFolderMarkdownEntryName,
  prioritizeFolderMarkdownScanEntries,
  shouldHideFolderMarkdownDirectory,
} from './folderScanUtils';

interface FolderMarkdownScanEntry {
  cachePath: string;
  fullPath: string;
  relativePath: string;
}

interface FolderMarkdownScanBudget {
  scannedEntries: number;
  visitedEntries: number;
}

function joinRelativePath(basePath: string, name: string): string {
  return basePath ? `${basePath}/${name}` : name;
}

async function collectFolderMarkdownScanEntries(
  folderFullPath: string,
  folderCachePath: string,
  relativePrefix: string,
  budget: FolderMarkdownScanBudget,
  depth = 0,
  result: FolderMarkdownScanEntry[] = [],
  maxResults = MAX_FOLDER_MENTION_NOTES,
): Promise<FolderMarkdownScanEntry[]> {
  if (
    depth > MAX_FOLDER_MARKDOWN_SCAN_DEPTH ||
    budget.scannedEntries >= MAX_FOLDER_MARKDOWN_LISTING_SCAN_ENTRIES ||
    budget.visitedEntries >= MAX_FOLDER_MARKDOWN_SCAN_ENTRIES ||
    result.length >= maxResults
  ) {
    return result;
  }

  const storage = getStorageAdapter();
  const entries = await storage.listDir(folderFullPath, { includeHidden: true }).catch(() => []);
  const remainingListingEntries = MAX_FOLDER_MARKDOWN_LISTING_SCAN_ENTRIES - budget.scannedEntries;
  const visibleEntries = prioritizeFolderMarkdownScanEntries(entries, remainingListingEntries);

  for (const entry of visibleEntries) {
    if (
      budget.scannedEntries >= MAX_FOLDER_MARKDOWN_LISTING_SCAN_ENTRIES ||
      budget.visitedEntries >= MAX_FOLDER_MARKDOWN_SCAN_ENTRIES ||
      result.length >= maxResults
    ) {
      break;
    }
    budget.scannedEntries += 1;

    if (!isSafeFolderMarkdownEntryName(entry.name)) {
      continue;
    }

    const isMarkdownFile = entry.isFile && isSupportedMarkdownPath(entry.name);
    if (!entry.isDirectory && !isMarkdownFile) {
      continue;
    }

    if (entry.isDirectory) {
      if (shouldHideFolderMarkdownDirectory(entry.name)) {
        continue;
      }
      if (
        budget.visitedEntries >= MAX_FOLDER_MARKDOWN_SCAN_ENTRIES ||
        result.length >= maxResults
      ) {
        break;
      }
      budget.visitedEntries += 1;
      const childFullPath = await joinPath(folderFullPath, entry.name);
      const childCachePath = joinRelativePath(folderCachePath, entry.name);
      const childRelativePath = joinRelativePath(relativePrefix, entry.name);
      await collectFolderMarkdownScanEntries(
        childFullPath,
        childCachePath,
        childRelativePath,
        budget,
        depth + 1,
        result,
        maxResults,
      );
      continue;
    }

    if (isMarkdownFile) {
      if (
        budget.visitedEntries >= MAX_FOLDER_MARKDOWN_SCAN_ENTRIES ||
        result.length >= maxResults
      ) {
        break;
      }
      budget.visitedEntries += 1;
      const childFullPath = await joinPath(folderFullPath, entry.name);
      const childCachePath = joinRelativePath(folderCachePath, entry.name);
      const childRelativePath = joinRelativePath(relativePrefix, entry.name);
      result.push({
        cachePath: childCachePath,
        fullPath: childFullPath,
        relativePath: childRelativePath,
      });
    }
  }

  return result;
}

function buildFolderMarkdownTitle(folderTitle: string, relativePath: string): string {
  const folderLabel = folderTitle.replace(/\/+$/, '') || 'folder';
  const segments = relativePath.split('/').filter(Boolean);
  if (segments.length === 0) {
    return folderLabel;
  }

  const last = segments[segments.length - 1];
  segments[segments.length - 1] = stripSupportedMarkdownExtension(last);
  return `${folderLabel}/${segments.join('/')}`;
}

export async function loadScannedFolderMarkdownReferences(
  mention: NoteMentionReference
): Promise<Array<NoteMentionReference & { content: string }>> {
  const folderPath = await resolveMentionedPath(mention.path, 'folder');
  if (!folderPath) {
    return [];
  }

  const entries = await collectFolderMarkdownScanEntries(
    folderPath.fullPath,
    folderPath.cachePath,
    '',
    { scannedEntries: 0, visitedEntries: 0 },
    0,
    [],
    MAX_FOLDER_MENTION_NOTE_CANDIDATES,
  );
  const loaded = await mapWithConcurrencyLimit(
    entries,
    MAX_CHAT_MENTION_LOAD_CONCURRENCY,
    async (entry) => {
      const content = stripManagedFrontmatter(
        await readResolvedMentionedNoteContent({
          cachePath: entry.cachePath,
          fullPath: entry.fullPath,
        }),
      ).trim();
      return {
        path: entry.cachePath,
        title: buildFolderMarkdownTitle(mention.title, entry.relativePath),
        kind: 'note' as const,
        content,
      };
    },
  );
  return loaded
    .filter((note) => note.content.length > 0)
    .slice(0, MAX_FOLDER_MENTION_NOTES);
}
