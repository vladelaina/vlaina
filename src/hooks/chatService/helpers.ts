import { convertToBase64, type Attachment } from '@/lib/storage/attachmentStorage';
import type { ChatMessageContent, ChatMessageContentPart } from '@/lib/ai/types';
import type { NoteMentionReference } from '@/lib/ai/noteMentions';
import { dedupeNoteMentions } from '@/lib/ai/noteMentions';
import {
  extractMarkdownImageSources,
  stripMarkdownImageTokens,
} from '@/components/Chat/common/messageClipboard';
import {
  isSvgDataUrl,
  rasterizeSvgDataUrlToPng,
} from '@/components/Chat/common/svgRasterize';
import { normalizeRenderableImageSrc } from '@/components/common/markdown/imagePolicy';
import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { extractStoredAttachmentFilename } from '@/lib/storage/attachmentUrl';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { findNode } from '@/stores/notes/fileTreeUtils';
import type { FileTreeNode } from '@/stores/notes/types';
import { isManagedProviderId } from '@/lib/ai/managedService';
import { useAccountSessionStore } from '@/stores/accountSession';
import { useManagedAIStore } from '@/stores/useManagedAIStore';
import { stripManagedFrontmatter } from '@/stores/notes/frontmatter';
import { flushCurrentPendingEditorMarkdown } from '@/stores/notes/pendingEditorMarkdownFlusher';
import { isSupportedMarkdownPath, stripSupportedMarkdownExtension } from '@/lib/notes/markdownFile';
import {
  normalizeVaultRelativePath,
  resolveVaultRelativeFullPath,
} from '@/stores/notes/utils/fs/vaultPathContainment';
import {
  escapeMarkdownAngleDestination,
  formatMarkdownImage,
} from '@/lib/markdown/markdownImageMarkdown';

const IMAGE_NAME_REGEX = /\.(png|jpe?g|webp|gif|bmp|avif|svg)(?:$|[?#])/i;
const MAX_NOTE_MENTION_COUNT = 3;
const MAX_NOTE_MENTION_CHARS = 12000;
const MAX_NOTE_MENTION_READ_BYTES = 512 * 1024;
const MAX_FOLDER_MENTION_NOTES = 20;
const MAX_FOLDER_MARKDOWN_SCAN_DEPTH = 6;
const MAX_FOLDER_MARKDOWN_SCAN_ENTRIES = 500;
const MAX_FOLDER_LISTING_ENTRIES = 80;
const MAX_FOLDER_IMAGE_ATTACHMENTS = 8;
const MAX_FOLDER_IMAGE_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const STREAM_CHUNK_FLUSH_MAX_DELAY_MS = 40;
const PROMPT_LABEL_UNSAFE_PATTERN = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFD]+/g;
const MAX_PROMPT_LABEL_LENGTH = 240;
const IMAGE_EXTENSION_MIME_TYPES: Record<string, string> = {
  avif: 'image/avif',
  bmp: 'image/bmp',
  gif: 'image/gif',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  svg: 'image/svg+xml',
  webp: 'image/webp',
};

export function resolveAssistantContent(
  returnedContent: string,
  lastStreamedContent: string,
  applyResolvedContent: (content: string) => void,
  createEmptyResponseError: () => Error = () => new Error('The model returned an empty response.'),
) {
  const finalContent = returnedContent || lastStreamedContent;

  if (returnedContent && returnedContent !== lastStreamedContent) {
    applyResolvedContent(returnedContent);
  }

  if (!finalContent.trim()) {
    throw createEmptyResponseError();
  }

  return finalContent;
}

export function normalizeNoteMentions(noteMentions: NoteMentionReference[]): NoteMentionReference[] {
  return dedupeNoteMentions(noteMentions).slice(0, MAX_NOTE_MENTION_COUNT);
}

export function isImageAttachment(attachment: Attachment): boolean {
  const mimeType = attachment.type?.trim().toLowerCase() ?? '';
  if (mimeType.startsWith('image/')) {
    return true;
  }

  const previewUrl = attachment.previewUrl?.trim().toLowerCase() ?? '';
  if (previewUrl.startsWith('data:image/')) {
    return true;
  }

  const assetUrl = attachment.assetUrl?.trim() ?? '';
  if (IMAGE_NAME_REGEX.test(assetUrl)) {
    return true;
  }

  const name = attachment.name?.trim() ?? '';
  return IMAGE_NAME_REGEX.test(name);
}

export function getAttachmentMessageImageSrc(attachment: Attachment): string {
  const mimeType = attachment.type?.trim().toLowerCase() ?? '';
  const previewUrl = attachment.previewUrl?.trim() ?? '';
  const attachmentPath = attachment.path?.trim() ?? '';
  const pathFilename = attachmentPath.split(/[\\/]/).pop()?.trim();
  if (pathFilename) {
    return `attachment://${encodeURIComponent(pathFilename)}`;
  }

  const assetUrl = attachment.assetUrl?.trim() ?? '';
  if (assetUrl) {
    const storedFilename = extractStoredAttachmentFilename(assetUrl);
    if (storedFilename) {
      return `attachment://${encodeURIComponent(storedFilename)}`;
    }
    return assetUrl;
  }
  if (mimeType === 'image/svg+xml' && previewUrl.startsWith('data:image/')) {
    return previewUrl;
  }
  return previewUrl;
}

export function toImageMarkdown(src: string): string {
  return formatMarkdownImage(src);
}

function inferImageMimeType(src: string): string {
  if (src.startsWith('data:image/')) {
    const match = /^data:(image\/[^;,]+)/i.exec(src);
    return match?.[1]?.toLowerCase() ?? 'image/*';
  }

  const pathname = src.split(/[?#]/)[0]?.toLowerCase() ?? '';
  if (pathname.endsWith('.png')) return 'image/png';
  if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) return 'image/jpeg';
  if (pathname.endsWith('.webp')) return 'image/webp';
  if (pathname.endsWith('.gif')) return 'image/gif';
  if (pathname.endsWith('.avif')) return 'image/avif';
  if (pathname.endsWith('.bmp')) return 'image/bmp';
  if (pathname.endsWith('.svg')) return 'image/svg+xml';
  return 'image/*';
}

function inferImageName(src: string, index: number): string {
  const fallback = `image-${index + 1}.png`;
  if (src.startsWith('data:image/')) {
    const mime = inferImageMimeType(src);
    const ext = mime.split('/')[1]?.replace('svg+xml', 'svg') || 'png';
    return `image-${index + 1}.${ext}`;
  }

  try {
    const url = new URL(src);
    const base = decodeURIComponent(url.pathname.split('/').pop() || '').trim();
    return base || fallback;
  } catch {
    const base = src.split(/[?#]/)[0]?.split('/').pop()?.trim();
    return base || fallback;
  }
}

function imageSourceToAttachment(src: string, index: number): Attachment {
  return {
    id: `stored-image-${index}`,
    path: '',
    previewUrl: src,
    assetUrl: src,
    name: inferImageName(src, index),
    type: inferImageMimeType(src),
    size: 0,
  };
}

export async function buildStoredUserMessageContent(content: string): Promise<ChatMessageContent> {
  const imageSources = extractMarkdownImageSources(content);
  if (imageSources.length === 0) {
    return content;
  }

  const text = stripMarkdownImageTokens(content).trim();
  const parts: ChatMessageContentPart[] = text ? [{ type: 'text', text }] : [];

  for (const [index, src] of imageSources.entries()) {
    const imagePart = await normalizeVisionAttachment(imageSourceToAttachment(src, index));
    if (imagePart) {
      parts.push(imagePart);
    }
  }

  return parts.length > 0 ? parts : text;
}

function isAbsolutePath(path: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(path) || path.startsWith('/');
}

function normalizeAbsoluteMentionPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/g, '');
}

function getStarredAbsoluteMentionPath(entry: {
  kind: 'note' | 'folder';
  vaultPath: string;
  relativePath: string;
}): string | null {
  const vaultPath = normalizeAbsoluteMentionPath(entry.vaultPath);
  const relativePath = normalizeVaultRelativePath(entry.relativePath);
  if (!vaultPath || !isAbsolutePath(vaultPath) || !relativePath) {
    return null;
  }
  return vaultPath === '/'
    ? `/${relativePath}`
    : `${vaultPath}/${relativePath}`.replace(/\/+/g, '/');
}

function resolveStarredAbsoluteMentionPath(
  mentionPath: string,
  kind: 'note' | 'folder',
): string | null {
  const targetPath = normalizeAbsoluteMentionPath(mentionPath);
  const entries = useNotesStore.getState().starredEntries ?? [];
  for (const entry of entries) {
    if (entry.kind !== kind) {
      continue;
    }
    const absolutePath = getStarredAbsoluteMentionPath(entry);
    if (absolutePath && normalizeAbsoluteMentionPath(absolutePath) === targetPath) {
      return absolutePath;
    }
  }
  return null;
}

async function resolveMentionedPath(
  mentionPath: string,
  kind: 'note' | 'folder',
): Promise<{ cachePath: string; fullPath: string } | null> {
  if (isAbsolutePath(mentionPath)) {
    const fullPath = resolveStarredAbsoluteMentionPath(mentionPath, kind);
    return fullPath ? { cachePath: fullPath, fullPath } : null;
  }

  const notesPath = useNotesStore.getState().notesPath;
  if (!notesPath) {
    return null;
  }

  try {
    const { relativePath, fullPath } = await resolveVaultRelativeFullPath(notesPath, mentionPath);
    return { cachePath: relativePath, fullPath };
  } catch {
    return null;
  }
}

function isSafeFolderEntryName(name: string): boolean {
  return (
    !!name &&
    name !== '.' &&
    name !== '..' &&
    !name.startsWith('.') &&
    !name.includes('\0') &&
    !/[\\/]/.test(name)
  );
}

async function readResolvedMentionedNoteContent(
  resolvedPath: { cachePath: string; fullPath: string },
  cacheAliases: readonly string[] = [],
): Promise<string> {
  const notesState = useNotesStore.getState();
  const cachePaths = Array.from(new Set([
    resolvedPath.cachePath,
    resolvedPath.fullPath,
    ...cacheAliases,
  ]));

  if (notesState.currentNote && cachePaths.includes(notesState.currentNote.path)) {
    return notesState.currentNote.content || '';
  }

  for (const cachePath of cachePaths) {
    const cached = notesState.noteContentsCache.get(cachePath);
    if (cached?.content.trim()) {
      return cached.content;
    }
  }

  const storage = getStorageAdapter();
  try {
    const fileInfo = await storage.stat(resolvedPath.fullPath).catch(() => null);
    if (typeof fileInfo?.size === 'number' && fileInfo.size > MAX_NOTE_MENTION_READ_BYTES) {
      return '';
    }
    const content = await storage.readFile(resolvedPath.fullPath);
    return typeof content === 'string' ? content : '';
  } catch {
    return '';
  }
}

async function resolveMentionedNoteContent(notePath: string): Promise<string> {
  const resolvedPath = await resolveMentionedPath(notePath, 'note');
  if (!resolvedPath) {
    return '';
  }
  return readResolvedMentionedNoteContent(resolvedPath, [notePath]);
}

function collectMarkdownNodes(nodes: readonly FileTreeNode[], result: FileTreeNode[] = []): FileTreeNode[] {
  for (const node of nodes) {
    if (node.isFolder) {
      collectMarkdownNodes(node.children, result);
    } else if (isSupportedMarkdownPath(node.path)) {
      result.push(node);
    }
  }
  return result;
}

async function resolveMentionedFolderPath(folderPath: string): Promise<string | null> {
  return (await resolveMentionedPath(folderPath, 'folder'))?.fullPath ?? null;
}

interface FolderMarkdownScanEntry {
  cachePath: string;
  fullPath: string;
  relativePath: string;
}

interface FolderMarkdownScanBudget {
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
): Promise<FolderMarkdownScanEntry[]> {
  if (
    depth > MAX_FOLDER_MARKDOWN_SCAN_DEPTH ||
    budget.visitedEntries >= MAX_FOLDER_MARKDOWN_SCAN_ENTRIES ||
    result.length >= MAX_FOLDER_MENTION_NOTES
  ) {
    return result;
  }

  const storage = getStorageAdapter();
  const entries = await storage.listDir(folderFullPath).catch(() => []);
  const visibleEntries = entries
    .filter((entry) => isSafeFolderEntryName(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of visibleEntries) {
    if (
      budget.visitedEntries >= MAX_FOLDER_MARKDOWN_SCAN_ENTRIES ||
      result.length >= MAX_FOLDER_MENTION_NOTES
    ) {
      break;
    }
    budget.visitedEntries += 1;

    const childFullPath = await joinPath(folderFullPath, entry.name);
    const childCachePath = joinRelativePath(folderCachePath, entry.name);
    const childRelativePath = joinRelativePath(relativePrefix, entry.name);

    if (entry.isDirectory) {
      await collectFolderMarkdownScanEntries(
        childFullPath,
        childCachePath,
        childRelativePath,
        budget,
        depth + 1,
        result,
      );
      continue;
    }

    if (entry.isFile && isSupportedMarkdownPath(entry.name)) {
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

async function loadScannedFolderMarkdownReferences(
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
    { visitedEntries: 0 },
  );
  const loaded = await Promise.all(
    entries.map(async (entry) => {
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
    }),
  );
  return loaded.filter((note) => note.content.length > 0);
}

function formatFolderEntrySize(size: number | undefined): string {
  if (typeof size !== 'number' || !Number.isFinite(size) || size < 0) {
    return '';
  }
  if (size < 1024) {
    return `, ${size} B`;
  }
  if (size < 1024 * 1024) {
    return `, ${(size / 1024).toFixed(1)} KB`;
  }
  return `, ${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatPromptLabel(value: string, fallback: string): string {
  const label = value
    .replace(PROMPT_LABEL_UNSAFE_PATTERN, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return (label || fallback).slice(0, MAX_PROMPT_LABEL_LENGTH);
}

async function loadFolderListingReference(
  mention: NoteMentionReference
): Promise<NoteMentionReference & { content: string } | null> {
  const folderPath = await resolveMentionedFolderPath(mention.path);
  if (!folderPath) {
    return null;
  }

  const storage = getStorageAdapter();
  const entries = await storage.listDir(folderPath).catch(() => []);
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

  const visibleEntries = entries
    .filter((entry) => isSafeFolderEntryName(entry.name))
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
  const hiddenCount = Math.max(visibleEntries.length - listedEntries.length, 0);

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

async function loadFolderImageAttachmentsForMention(
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
  const imageEntries = entries
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
    const size = typeof stat?.size === 'number' ? stat.size : entry.size;
    if (typeof size === 'number' && size > MAX_FOLDER_IMAGE_ATTACHMENT_BYTES) {
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

async function loadMentionReference(
  mention: NoteMentionReference
): Promise<Array<NoteMentionReference & { content: string }>> {
  const notesState = useNotesStore.getState();
  const folderNode = notesState.rootFolder
    ? findNode(notesState.rootFolder.children, mention.path)
    : null;
  const isFolderMention = mention.kind === 'folder' || Boolean(folderNode?.isFolder);

  if (!isFolderMention) {
    const content = stripManagedFrontmatter(
      await resolveMentionedNoteContent(mention.path),
    ).trim();
    return content ? [{ ...mention, content }] : [];
  }

  if (!folderNode?.isFolder) {
    if (mention.kind === 'folder') {
      const listing = await loadFolderListingReference(mention);
      const scannedReferences = await loadScannedFolderMarkdownReferences(mention);
      return listing ? [listing, ...scannedReferences] : scannedReferences;
    }
    return [];
  }

  const markdownNodes = collectMarkdownNodes(folderNode.children)
    .slice(0, MAX_FOLDER_MENTION_NOTES);
  const listing = await loadFolderListingReference(mention);
  if (markdownNodes.length === 0) {
    const scannedReferences = await loadScannedFolderMarkdownReferences(mention);
    return listing ? [listing, ...scannedReferences] : scannedReferences;
  }

  const loaded = await Promise.all(
    markdownNodes.map(async (node) => {
      const title = notesState.getDisplayName?.(node.path) ?? node.name;
      const content = stripManagedFrontmatter(
        await resolveMentionedNoteContent(node.path),
      ).trim();
      return {
        path: node.path,
        title: `${mention.title.replace(/\/+$/, '')}/${title}`,
        kind: 'note' as const,
        content,
      };
    }),
  );
  const markdownReferences = loaded.filter((note) => note.content.length > 0);
  return listing ? [listing, ...markdownReferences] : markdownReferences;
}

export async function loadMentionedNotes(
  noteMentions: NoteMentionReference[]
): Promise<Array<NoteMentionReference & { content: string }>> {
  flushCurrentPendingEditorMarkdown();
  return (await Promise.all(noteMentions.map(loadMentionReference))).flat();
}

export async function loadMentionedFolderImageAttachments(
  noteMentions: NoteMentionReference[]
): Promise<Attachment[]> {
  const attachments = (await Promise.all(noteMentions.map(loadFolderImageAttachmentsForMention))).flat();
  const seenPaths = new Set<string>();
  return attachments.filter((attachment) => {
    if (!attachment.path || seenPaths.has(attachment.path)) {
      return false;
    }
    seenPaths.add(attachment.path);
    return true;
  });
}

export function buildMentionedNotesContext(
  mentionedNotes: Array<NoteMentionReference & { content: string }>
): string {
  if (mentionedNotes.length === 0) {
    return '';
  }

  const sections = mentionedNotes.map((note) => {
    const boundedContent = note.content.slice(0, MAX_NOTE_MENTION_CHARS);
    return `## ${formatPromptLabel(note.title, note.path || 'note')}\n${boundedContent}`;
  });

  return [
    'Referenced notes and folders:',
    '',
    sections.join('\n\n---\n\n'),
    '',
    'Answer based on these references plus the user request.',
  ].join('\n');
}

export async function normalizeVisionAttachment(
  attachment: Attachment
): Promise<ChatMessageContentPart | null> {
  if (!isImageAttachment(attachment)) {
    return null;
  }

  try {
    const base64 = await convertToBase64(attachment);
    const normalizedBase64 = isSvgDataUrl(base64)
      ? await rasterizeSvgDataUrlToPng(base64)
      : base64;
    if (!normalizedBase64) {
      return null;
    }

    return {
      type: 'image_url',
      image_url: { url: normalizedBase64 },
    };
  } catch (error) {
    return null;
  }
}

export function createChunkScheduler(onFlush: (content: string) => void) {
  let pendingContent: string | null = null;
  let frameId: number | null = null;
  let frameKind: 'raf' | 'timeout' | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let hasFlushedOnce = false;

  const clearScheduledFlush = () => {
    if (frameId !== null) {
      if (frameKind === 'raf' && typeof window !== 'undefined') {
        window.cancelAnimationFrame(frameId);
      } else {
        clearTimeout(frameId);
      }
      frameId = null;
      frameKind = null;
    }

    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const flush = () => {
    if (pendingContent === null) {
      clearScheduledFlush();
      return;
    }

    const nextContent = pendingContent;
    pendingContent = null;
    clearScheduledFlush();
    hasFlushedOnce = true;
    onFlush(nextContent);
  };

  const scheduleFlush = () => {
    if (frameId === null) {
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        frameKind = 'raf';
        frameId = window.requestAnimationFrame(() => flush());
      } else {
        frameKind = 'timeout';
        frameId = setTimeout(() => flush(), 16) as unknown as number;
      }
    }

    if (timeoutId === null) {
      timeoutId = setTimeout(() => flush(), STREAM_CHUNK_FLUSH_MAX_DELAY_MS);
    }
  };

  return {
    push(content: string) {
      pendingContent = content;
      if (!hasFlushedOnce) {
        flush();
        return;
      }
      scheduleFlush();
    },
    flushNow() {
      flush();
    },
    cancel() {
      pendingContent = null;
      clearScheduledFlush();
    },
  };
}

export function refreshManagedBudgetIfNeeded(providerId: string): void {
  if (!isManagedProviderId(providerId)) {
    return;
  }
  if (!useAccountSessionStore.getState().isConnected) {
    return;
  }
  void useManagedAIStore.getState().refreshBudget();
}

async function getRenderableMessageImageSrc(attachment: Attachment): Promise<string | null> {
  const rawSrc = getAttachmentMessageImageSrc(attachment);
  const normalizedSrc = normalizeRenderableImageSrc(rawSrc);
  if (normalizedSrc) {
    return normalizedSrc;
  }

  const mimeType = attachment.type?.trim().toLowerCase() ?? '';
  if (mimeType !== 'image/svg+xml' || !rawSrc.trim().startsWith('data:image/svg+xml')) {
    return null;
  }

  const rasterizedSrc = await rasterizeSvgDataUrlToPng(rawSrc);
  return normalizeRenderableImageSrc(rasterizedSrc);
}

export async function buildMessageImageSources(attachments: Attachment[]): Promise<{ content: string; imageSources: string[] }> {
  const imageSources: string[] = [];
  const markdownParts: string[] = [];

  for (const attachment of attachments) {
    if (!isImageAttachment(attachment)) {
      continue;
    }

    const src = await getRenderableMessageImageSrc(attachment);
    if (!src) {
      continue;
    }

    const markdownSrc = escapeMarkdownAngleDestination(src);
    if (!markdownSrc) {
      continue;
    }

    imageSources.push(markdownSrc);
    markdownParts.push(toImageMarkdown(markdownSrc));
  }

  return { content: markdownParts.join('\n\n'), imageSources };
}
