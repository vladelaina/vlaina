import type { StarredKind } from '@/stores/notes/types';
import { hasInternalNotePathSegment } from '@/stores/notes/utils/fs/internalNotePaths';

export const MAX_EXTERNAL_MARKDOWN_IMPORT_ENTRIES = 2000;
export const MAX_EXTERNAL_MARKDOWN_SCAN_ENTRIES = 10_000;
export const MAX_EXTERNAL_MARKDOWN_STARRED_SCAN_ENTRIES = 10_000;
export const MAX_EXTERNAL_MARKDOWN_PRIORITY_SCAN_ENTRIES = MAX_EXTERNAL_MARKDOWN_SCAN_ENTRIES * 2;
export const MAX_EXTERNAL_MARKDOWN_IMPORT_DEPTH = 24;
export const MAX_EXTERNAL_MARKDOWN_FILE_SIZE = 10 * 1024 * 1024;

const externalMarkdownImportUtf8Encoder = new TextEncoder();

export interface ExternalMarkdownImportResult {
  importedNotePaths: string[];
  importedFolderPaths: string[];
  didImport: boolean;
}

export interface ExternalMarkdownStarredTarget {
  kind: StarredKind;
  notesRootPath: string;
  relativePath: string;
}

export interface ExternalMarkdownImportBudget {
  scannedEntries: number;
  visitedEntries: number;
}

export interface PreparedExternalMarkdownFileImport {
  contentToWrite: string | null;
}

export function shouldHideExternalMarkdownDirectory(name: string) {
  return hasInternalNotePathSegment(name);
}

export function isExternalMarkdownContentWithinReadLimit(content: string): boolean {
  return (
    content.length <= MAX_EXTERNAL_MARKDOWN_FILE_SIZE &&
    externalMarkdownImportUtf8Encoder.encode(content).length <= MAX_EXTERNAL_MARKDOWN_FILE_SIZE
  );
}

export function isKnownExternalMarkdownFileSizeWithinLimit(size: number): boolean {
  return (
    Number.isFinite(size) &&
    size >= 0 &&
    size <= MAX_EXTERNAL_MARKDOWN_FILE_SIZE
  );
}

export function hasInvalidExternalMarkdownFileSize(
  info: { size?: number | null } | null | undefined,
): boolean {
  return typeof info?.size === 'number' && !isKnownExternalMarkdownFileSizeWithinLimit(info.size);
}

export function spendExternalMarkdownScanBudget(budget: ExternalMarkdownImportBudget): boolean {
  if (budget.scannedEntries >= MAX_EXTERNAL_MARKDOWN_SCAN_ENTRIES) {
    return false;
  }
  budget.scannedEntries += 1;
  return true;
}
