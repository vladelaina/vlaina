import {
  convertToBase64,
  createStoredAttachmentFromSource,
  isAttachmentDataUrlWithinSizeLimit,
  type Attachment,
} from '@/lib/storage/attachmentStorage';
import type { ChatMessageContent, ChatMessageContentPart } from '@/lib/ai/types';
import type { NoteMentionReference } from '@/lib/ai/noteMentions';
import {
  dedupeNoteMentions,
  isPotentiallyLoadableNoteMentionReference,
  MAX_NOTE_MENTION_SCAN_ITEMS,
} from '@/lib/ai/noteMentions';
import { isRenderedImageSource } from '@/components/Chat/common/messageClipboard';
import {
  parseMarkdownAndHtmlImageTokens,
  stripImageTokens,
  type ImageToken,
} from '@/components/Chat/common/messageImageTokens';
import {
  isSvgDataUrl,
  rasterizeSvgDataUrlToPng,
} from '@/components/Chat/common/svgRasterize';
import { isRenderableDataImageSrc, normalizeRenderableImageSrc } from '@/components/common/markdown/imagePolicy';
import {
  getStorageAdapter,
  isAbsolutePath as isStorageAbsolutePath,
  joinPath,
  normalizeAbsolutePath,
} from '@/lib/storage/adapter';
import {
  extractStoredAttachmentFilename,
  sanitizeAttachmentFilename,
} from '@/lib/storage/attachmentUrl';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { findNode } from '@/stores/notes/fileTreeUtils';
import type { FileTreeNode } from '@/stores/notes/types';
import { isManagedProviderId } from '@/lib/ai/managedService';
import { normalizeContainedAssetPath } from '@/lib/assets/core/pathContainment';
import { useAccountSessionStore } from '@/stores/accountSession';
import { useManagedAIStore } from '@/stores/useManagedAIStore';
import { stripManagedFrontmatter } from '@/stores/notes/frontmatter';
import { flushCurrentPendingEditorMarkdown } from '@/stores/notes/pendingEditorMarkdownFlusher';
import { isSupportedMarkdownPath, stripSupportedMarkdownExtension } from '@/lib/notes/markdownFile';
import {
  isSafeVaultPathSegment,
  normalizeVaultRelativePath,
  resolveVaultRelativeFullPath,
} from '@/stores/notes/utils/fs/vaultPathContainment';
import { hasInternalNotePathSegment } from '@/stores/notes/utils/fs/internalNotePaths';
import {
  escapeMarkdownAngleDestination,
  formatMarkdownImage,
} from '@/lib/markdown/markdownImageMarkdown';
import { scrubOverflowMarkdownDataImages } from '@/lib/markdown/overflowDataImageScrubber';
import { replaceRenderableMessageImageTokens } from '@/lib/markdown/renderableImageTokens';

const IMAGE_NAME_REGEX = /\.(png|jpe?g|webp|gif|bmp|avif|svg)(?:$|[?#])/i;
const MAX_NOTE_MENTION_COUNT = 3;
const MAX_NOTE_MENTION_CHARS = 12000;
const MAX_NOTE_MENTION_READ_BYTES = 512 * 1024;
const noteMentionUtf8Encoder = new TextEncoder();
export const MAX_MENTIONED_NOTES_CONTEXT_CHARS = 120_000;
const MAX_FOLDER_MENTION_NOTES = 20;
const MAX_FOLDER_MENTION_NOTE_CANDIDATES = MAX_FOLDER_MENTION_NOTES * 5;
export const MAX_CHAT_MENTION_LOAD_CONCURRENCY = 5;
const MAX_FOLDER_MARKDOWN_SCAN_DEPTH = 6;
const MAX_FOLDER_MARKDOWN_SCAN_ENTRIES = 500;
const MAX_FOLDER_MARKDOWN_TREE_SCAN_ENTRIES = 5000;
const MAX_FOLDER_MARKDOWN_LISTING_SCAN_ENTRIES = 5000;
const MAX_FOLDER_LISTING_ENTRIES = 80;
const MAX_FOLDER_LISTING_SCAN_ENTRIES = 5000;
const MAX_FOLDER_IMAGE_ATTACHMENTS = 8;
const MAX_FOLDER_IMAGE_ATTACHMENT_SCAN_ENTRIES = 5000;
const MAX_FOLDER_IMAGE_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const STREAM_CHUNK_FLUSH_MAX_DELAY_MS = 40;
const MAX_INFERRED_IMAGE_NAME_SOURCE_CHARS = 4096;
const MAX_INFERRED_IMAGE_NAME_SEGMENT_DECODE_CHARS = 2048;
const MAX_INFERRED_IMAGE_NAME_CHARS = 512;
const MAX_STORED_USER_MESSAGE_IMAGE_TOKENS = 2000;
export const MAX_CHAT_MESSAGE_IMAGE_ATTACHMENTS = 64;
const INLINE_DATA_IMAGE_TARGET_HINT_PATTERN = /\bdata(?:\\*:|&|&#)/i;
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
const LOW_PRIORITY_FOLDER_MARKDOWN_DIRECTORY_NAMES = new Set([
  'node_modules',
  'vendor',
  'dist',
  'build',
  'target',
  '__pycache__',
]);

async function mapWithConcurrencyLimit<T, R>(
  items: readonly T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(limit, items.length));
  const workers = Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  });

  await Promise.all(workers);
  return results;
}

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
  return dedupeNoteMentions(noteMentions)
    .filter((mention) => isPotentiallyLoadableNoteMentionReference(mention, mention.kind))
    .slice(0, MAX_NOTE_MENTION_COUNT);
}

function isPotentiallyLoadableMentionReference(
  mention: NoteMentionReference,
  explicitKind: 'note' | 'folder' | undefined,
): boolean {
  return isPotentiallyLoadableNoteMentionReference(mention, explicitKind);
}

function normalizeNoteMentionsForLoading(noteMentions: unknown): NoteMentionReference[] {
  const mentionList = Array.isArray(noteMentions) ? noteMentions : [];
  const explicitKindsByPath = new Map<string, 'note' | 'folder'>();
  const scanLimit = Math.min(mentionList.length, MAX_NOTE_MENTION_SCAN_ITEMS);
  for (let index = 0; index < scanLimit; index += 1) {
    const mention = mentionList[index];
    if (
      !mention ||
      typeof mention.path !== 'string' ||
      (mention.kind !== 'note' && mention.kind !== 'folder')
    ) {
      continue;
    }
    const path = mention.path.trim();
    if (path) {
      explicitKindsByPath.set(path, mention.kind);
    }
  }

  return dedupeNoteMentions(mentionList)
    .map((mention) => {
      const explicitKind = explicitKindsByPath.get(mention.path);
      return explicitKind ? { ...mention, kind: explicitKind } : {
        path: mention.path,
        title: mention.title,
      };
    })
    .filter((mention) => isPotentiallyLoadableMentionReference(
      mention,
      explicitKindsByPath.get(mention.path),
    ))
    .slice(0, MAX_NOTE_MENTION_COUNT);
}

export function isImageAttachment(attachment: Attachment): boolean {
  const mimeType = attachment.type?.trim().toLowerCase() ?? '';
  if (mimeType.startsWith('image/')) {
    return true;
  }

  const previewUrl = attachment.previewUrl?.trim() ?? '';
  if (/^data:image\//i.test(previewUrl)) {
    return true;
  }

  const assetUrl = attachment.assetUrl?.trim() ?? '';
  if (IMAGE_NAME_REGEX.test(assetUrl)) {
    return true;
  }

  const name = attachment.name?.trim() ?? '';
  return IMAGE_NAME_REGEX.test(name);
}

function extractTrustedManagedAttachmentPathFilename(path: string | null | undefined): string | null {
  const normalizedPath = path?.trim().replace(/\\/g, '/') ?? '';
  if (!normalizedPath) {
    return null;
  }

  const segments = normalizedPath.split('/').filter(Boolean);
  const filename = sanitizeAttachmentFilename(segments.at(-1) ?? '');
  if (
    !filename ||
    segments.at(-2)?.toLowerCase() !== 'attachments' ||
    segments.at(-3)?.toLowerCase() !== '.vlaina'
  ) {
    return null;
  }

  return filename;
}

export function getAttachmentMessageImageSrc(attachment: Attachment): string {
  const mimeType = attachment.type?.trim().toLowerCase() ?? '';
  const previewUrl = attachment.previewUrl?.trim() ?? '';
  const assetUrl = attachment.assetUrl?.trim() ?? '';
  if (assetUrl) {
    const storedFilename = extractStoredAttachmentFilename(assetUrl);
    if (storedFilename) {
      return `attachment://${encodeURIComponent(storedFilename)}`;
    }
  }

  const trustedPathFilename = extractTrustedManagedAttachmentPathFilename(attachment.path);
  if (trustedPathFilename) {
    return `attachment://${encodeURIComponent(trustedPathFilename)}`;
  }

  if (assetUrl) {
    return assetUrl;
  }
  if (mimeType === 'image/svg+xml' && /^data:image\//i.test(previewUrl)) {
    return previewUrl;
  }
  return previewUrl;
}

function hasConvertibleAttachmentReference(attachment: Attachment, rawSrc: string): boolean {
  return Boolean(
    attachment.path?.trim() ||
    extractStoredAttachmentFilename(attachment.previewUrl) ||
    extractStoredAttachmentFilename(attachment.assetUrl) ||
    isSvgDataUrl(rawSrc)
  );
}

export function toImageMarkdown(src: string): string {
  return formatMarkdownImage(src);
}

function isSizedDataImageSrc(src: string): boolean {
  return /^data:/i.test(src.trim()) ? isAttachmentDataUrlWithinSizeLimit(src) : true;
}

function inferImageMimeType(src: string): string {
  if (isRenderableDataImageSrc(src) || isSvgDataUrl(src)) {
    const match = /^data:(image\/[^;,]+)/i.exec(src.trim());
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

function normalizeInferredImageName(value: string, fallback: string): string {
  const normalized = value.trim();
  return normalized && normalized.length <= MAX_INFERRED_IMAGE_NAME_CHARS
    ? normalized
    : fallback;
}

function decodeInferredImageNameSegment(value: string, fallback: string): string {
  if (value.length > MAX_INFERRED_IMAGE_NAME_SEGMENT_DECODE_CHARS) {
    return normalizeInferredImageName(value, fallback);
  }
  try {
    return normalizeInferredImageName(decodeURIComponent(value), fallback);
  } catch {
    return normalizeInferredImageName(value, fallback);
  }
}

function inferImageName(src: string, index: number): string {
  const fallback = `image-${index + 1}.png`;
  if (isRenderableDataImageSrc(src) || isSvgDataUrl(src)) {
    const mime = inferImageMimeType(src);
    const ext = mime.split('/')[1]?.replace('svg+xml', 'svg') || 'png';
    return `image-${index + 1}.${ext}`;
  }

  if (src.length > MAX_INFERRED_IMAGE_NAME_SOURCE_CHARS) {
    return fallback;
  }

  try {
    const url = new URL(src);
    return decodeInferredImageNameSegment(url.pathname.split('/').pop() || '', fallback);
  } catch {
    return normalizeInferredImageName(src.split(/[?#]/)[0]?.split('/').pop() ?? '', fallback);
  }
}

function imageSourceToAttachment(src: string, index: number): Attachment {
  const storedAttachment = createStoredAttachmentFromSource(src, `stored-image-${index}`);
  if (storedAttachment && isImageAttachment(storedAttachment)) {
    return storedAttachment;
  }

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

function isInlineDataImageMarkdownSource(src: string | null | undefined): boolean {
  return /^data:image\//i.test(src?.trim() ?? '');
}

function collectStoredUserMessageImages(content: string): {
  imageSources: string[];
  tokensToStrip: ImageToken[];
  reachedImageTokenBudget: boolean;
} {
  const imageSources: string[] = [];
  const tokensToStrip: ImageToken[] = [];
  const parsedTokens = parseMarkdownAndHtmlImageTokens(content, {
    maxTokens: MAX_STORED_USER_MESSAGE_IMAGE_TOKENS,
  });

  for (const token of parsedTokens) {
    const rawSrc = token.src?.trim() ?? '';
    const storedAttachment = createStoredAttachmentFromSource(rawSrc, 'stored-image-candidate');
    if (storedAttachment && isImageAttachment(storedAttachment)) {
      if (imageSources.length < MAX_CHAT_MESSAGE_IMAGE_ATTACHMENTS) {
        imageSources.push(rawSrc);
      }
      tokensToStrip.push(token);
      continue;
    }

    const normalizedSrc = normalizeDirectVisionImageUrl(rawSrc);
    if (normalizedSrc) {
      if (imageSources.length < MAX_CHAT_MESSAGE_IMAGE_ATTACHMENTS) {
        imageSources.push(normalizedSrc);
      }
      tokensToStrip.push(token);
      continue;
    }

    if (isSvgDataUrl(rawSrc) && isSizedDataImageSrc(rawSrc)) {
      if (imageSources.length < MAX_CHAT_MESSAGE_IMAGE_ATTACHMENTS) {
        imageSources.push(rawSrc);
      }
      tokensToStrip.push(token);
      continue;
    }

    if (isInlineDataImageMarkdownSource(rawSrc)) {
      tokensToStrip.push(token);
    }
  }

  return {
    imageSources,
    tokensToStrip,
    reachedImageTokenBudget: parsedTokens.length >= MAX_STORED_USER_MESSAGE_IMAGE_TOKENS,
  };
}

function scrubOverflowStoredInlineDataImageSyntax(content: string): string {
  const withoutMarkdownDataImages = scrubOverflowMarkdownDataImages(content, {
    replacement: '',
    maxTargetChars: MAX_NOTE_MENTION_READ_BYTES,
  });
  return replaceRenderableMessageImageTokens(withoutMarkdownDataImages, '');
}

export async function buildStoredUserMessageContent(content: string): Promise<ChatMessageContent> {
  const { imageSources, tokensToStrip, reachedImageTokenBudget } = collectStoredUserMessageImages(content);
  if (imageSources.length === 0 && tokensToStrip.length === 0) {
    if (reachedImageTokenBudget || INLINE_DATA_IMAGE_TARGET_HINT_PATTERN.test(content)) {
      const scrubbed = scrubOverflowStoredInlineDataImageSyntax(content).trim();
      return scrubbed === content ? content : scrubbed ? [{ type: 'text', text: scrubbed }] : '';
    }
    return content;
  }

  const strippedText = stripImageTokens(content, tokensToStrip);
  const shouldScrubStrippedText = reachedImageTokenBudget || INLINE_DATA_IMAGE_TARGET_HINT_PATTERN.test(strippedText);
  const text = (shouldScrubStrippedText
    ? scrubOverflowStoredInlineDataImageSyntax(strippedText)
    : strippedText
  ).trim();
  const parts: ChatMessageContentPart[] = text ? [{ type: 'text', text }] : [];

  for (const [index, src] of imageSources.entries()) {
    const imagePart = await normalizeVisionAttachment(imageSourceToAttachment(src, index));
    if (imagePart) {
      parts.push(imagePart);
    }
  }

  return parts.length > 0 ? parts : text;
}

function normalizeAbsoluteMentionPathForCompare(path: string): string {
  const normalized = normalizeAbsolutePath(path.trim()).replace(/\\/g, '/');
  const withoutTrailingSlash = normalized === '/' || /^[A-Za-z]:\/$/i.test(normalized)
    ? normalized
    : normalized.replace(/\/+$/g, '');
  return /^[A-Za-z]:\//.test(withoutTrailingSlash) || withoutTrailingSlash.startsWith('//')
    ? withoutTrailingSlash.toLowerCase()
    : withoutTrailingSlash;
}

function hasUnsafeMentionPathSegment(path: string): boolean {
  return path
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean)
    .some((segment) => !isSafeVaultPathSegment(segment));
}

async function getStarredAbsoluteMentionPath(entry: {
  kind: 'note' | 'folder';
  vaultPath: string;
  relativePath: string;
}): Promise<string | null> {
  const vaultPath = normalizeAbsolutePath(entry.vaultPath.trim());
  const relativePath = normalizeVaultRelativePath(entry.relativePath);
  if (
    !vaultPath ||
    !isStorageAbsolutePath(vaultPath) ||
    isInsideInternalFolderMarkdownPath(vaultPath) ||
    hasUnsafeMentionPathSegment(vaultPath) ||
    !relativePath ||
    isInsideInternalFolderMarkdownPath(relativePath) ||
    (entry.kind === 'note' && !isSupportedMarkdownPath(relativePath))
  ) {
    return null;
  }
  return joinPath(vaultPath, relativePath);
}

async function resolveStarredAbsoluteMentionPath(
  mentionPath: string,
  kind: 'note' | 'folder',
): Promise<string | null> {
  const targetPath = normalizeAbsoluteMentionPathForCompare(mentionPath);
  const entries = useNotesStore.getState().starredEntries ?? [];
  for (const entry of entries) {
    if (entry.kind !== kind) {
      continue;
    }
    const absolutePath = await getStarredAbsoluteMentionPath(entry);
    if (absolutePath && normalizeAbsoluteMentionPathForCompare(absolutePath) === targetPath) {
      return absolutePath;
    }
  }
  return null;
}

async function resolveMentionedPath(
  mentionPath: string,
  kind: 'note' | 'folder',
): Promise<{ cachePath: string; fullPath: string } | null> {
  if (
    isInsideInternalFolderMarkdownPath(mentionPath) ||
    hasUnsafeMentionPathSegment(mentionPath) ||
    (kind === 'note' && !isSupportedMarkdownPath(mentionPath))
  ) {
    return null;
  }

  if (isStorageAbsolutePath(mentionPath)) {
    const fullPath = await resolveStarredAbsoluteMentionPath(mentionPath, kind);
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
    isSafeVaultPathSegment(name) &&
    !name.startsWith('.') &&
    !hasInternalNotePathSegment(name)
  );
}

function isSafeFolderListingEntryName(name: string): boolean {
  return (
    isSafeVaultPathSegment(name) &&
    !hasInternalNotePathSegment(name)
  );
}

function isSafeFolderMarkdownEntryName(name: string): boolean {
  return isSafeVaultPathSegment(name);
}

function shouldHideFolderMarkdownDirectory(name: string): boolean {
  return hasInternalNotePathSegment(name);
}

function isLowPriorityFolderMarkdownDirectory(name: string): boolean {
  return LOW_PRIORITY_FOLDER_MARKDOWN_DIRECTORY_NAMES.has(name.toLowerCase());
}

function prioritizeFolderScanEntries<T extends { name: string; isDirectory?: boolean; isFile?: boolean }>(
  entries: readonly T[],
  getPriority: (entry: T) => number,
): T[] {
  return entries
    .map((entry, index) => ({ entry, index, priority: getPriority(entry) }))
    .sort((left, right) => left.priority - right.priority || left.index - right.index)
    .map(({ entry }) => entry);
}

function prioritizeFolderMarkdownScanEntries<T extends { name: string; isDirectory?: boolean; isFile?: boolean }>(
  entries: readonly T[],
): T[] {
  return entries
    .map((entry, index) => ({ entry, index, priority: getFolderMarkdownScanPriority(entry) }))
    .sort((left, right) =>
      left.priority - right.priority ||
      left.entry.name.localeCompare(right.entry.name) ||
      left.index - right.index
    )
    .map(({ entry }) => entry);
}

function getFolderMarkdownScanPriority(entry: { name: string; isDirectory?: boolean; isFile?: boolean }) {
  if (!isSafeFolderMarkdownEntryName(entry.name)) {
    return 3;
  }
  if (entry.isFile && isSupportedMarkdownPath(entry.name)) {
    return 0;
  }
  if (entry.isDirectory && !isLowPriorityFolderMarkdownDirectory(entry.name)) {
    return 1;
  }
  if (entry.isDirectory) {
    return 2;
  }
  return 3;
}

function getMentionFolderMarkdownNodeScanPriority(node: FileTreeNode): number {
  if (!node.isFolder && isSupportedMarkdownPath(node.path)) {
    return 0;
  }
  if (node.isFolder && !isLowPriorityFolderMarkdownDirectory(node.name)) {
    return 1;
  }
  if (node.isFolder) {
    return 2;
  }
  return 3;
}

function prioritizeMentionFolderMarkdownNodes(nodes: readonly FileTreeNode[]): FileTreeNode[] {
  return nodes
    .map((node, index) => ({ node, index, priority: getMentionFolderMarkdownNodeScanPriority(node) }))
    .sort((left, right) => left.priority - right.priority || left.index - right.index)
    .map(({ node }) => node);
}

function getFolderListingScanPriority(entry: { name: string }) {
  return isSafeFolderListingEntryName(entry.name) ? 0 : 1;
}

function getFolderImageScanPriority(entry: { name: string; isFile?: boolean }) {
  if (!isSafeFolderEntryName(entry.name)) {
    return 2;
  }
  return entry.isFile && IMAGE_NAME_REGEX.test(entry.name) ? 0 : 1;
}

function isInsideInternalFolderMarkdownPath(path: string): boolean {
  return hasInternalNotePathSegment(path);
}

function canUseCachedMentionContent(cached: { modifiedAt?: number | null; size?: number | null }): boolean {
  return !(cached.modifiedAt == null && Object.prototype.hasOwnProperty.call(cached, 'size'));
}

function isNoteMentionContentWithinReadLimit(content: string): boolean {
  return (
    content.length <= MAX_NOTE_MENTION_READ_BYTES &&
    noteMentionUtf8Encoder.encode(content).length <= MAX_NOTE_MENTION_READ_BYTES
  );
}

function canReadNoteMentionFile(
  fileInfo: { isFile?: boolean; isDirectory?: boolean; size?: number | null } | null | undefined,
): boolean {
  if (!fileInfo || fileInfo.isDirectory === true || fileInfo.isFile === false) {
    return false;
  }

  if (typeof fileInfo.size !== 'number') {
    return true;
  }

  return (
    Number.isFinite(fileInfo.size) &&
    fileInfo.size >= 0 &&
    fileInfo.size <= MAX_NOTE_MENTION_READ_BYTES
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
    const content = notesState.currentNote.content || '';
    return isNoteMentionContentWithinReadLimit(content) ? content : '';
  }

  for (const cachePath of cachePaths) {
    const cached = notesState.noteContentsCache.get(cachePath);
    if (cached) {
      if (!isNoteMentionContentWithinReadLimit(cached.content)) {
        return '';
      }
      if (canUseCachedMentionContent(cached)) {
        return cached.content;
      }
    }
  }

  const storage = getStorageAdapter();
  try {
    const fileInfo = await storage.stat(resolvedPath.fullPath).catch(() => null);
    if (!canReadNoteMentionFile(fileInfo)) {
      return '';
    }
    const content = await storage.readFile(resolvedPath.fullPath, MAX_NOTE_MENTION_READ_BYTES);
    return typeof content === 'string' && isNoteMentionContentWithinReadLimit(content)
      ? content
      : '';
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

export function collectMentionFolderMarkdownNodes(
  nodes: readonly FileTreeNode[],
  options: { maxResults?: number } = {},
): FileTreeNode[] {
  const result: FileTreeNode[] = [];
  const maxResults = Math.max(0, Math.floor(options.maxResults ?? MAX_FOLDER_MENTION_NOTES));
  const stack: Array<{ nodes: readonly FileTreeNode[]; index: number; depth: number }> = [{
    nodes: prioritizeMentionFolderMarkdownNodes(nodes),
    index: 0,
    depth: 0,
  }];
  let visitedEntries = 0;
  let scannedEntries = 0;

  while (
    stack.length > 0 &&
    scannedEntries < MAX_FOLDER_MARKDOWN_TREE_SCAN_ENTRIES &&
    visitedEntries < MAX_FOLDER_MARKDOWN_SCAN_ENTRIES &&
    result.length < maxResults
  ) {
    const frame = stack[stack.length - 1];
    if (frame.index >= frame.nodes.length) {
      stack.pop();
      continue;
    }

    const node = frame.nodes[frame.index];
    frame.index += 1;
    if (!node) continue;
    scannedEntries += 1;

    if (node.isFolder) {
      if (
        shouldHideFolderMarkdownDirectory(node.name) ||
        isInsideInternalFolderMarkdownPath(node.path)
      ) {
        continue;
      }
      if (frame.depth >= MAX_FOLDER_MARKDOWN_SCAN_DEPTH) {
        continue;
      }
      stack.push({ nodes: prioritizeMentionFolderMarkdownNodes(node.children), index: 0, depth: frame.depth + 1 });
      continue;
    }

    if (isSupportedMarkdownPath(node.path) && !isInsideInternalFolderMarkdownPath(node.path)) {
      visitedEntries += 1;
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
  maxResults = MAX_FOLDER_MENTION_NOTES,
): Promise<FolderMarkdownScanEntry[]> {
  if (
    depth > MAX_FOLDER_MARKDOWN_SCAN_DEPTH ||
    budget.visitedEntries >= MAX_FOLDER_MARKDOWN_SCAN_ENTRIES ||
    result.length >= maxResults
  ) {
    return result;
  }

  const storage = getStorageAdapter();
  const entries = await storage.listDir(folderFullPath, { includeHidden: true }).catch(() => []);
  const visibleEntries = prioritizeFolderMarkdownScanEntries(entries)
    .slice(0, MAX_FOLDER_MARKDOWN_LISTING_SCAN_ENTRIES)
    .filter((entry) => isSafeFolderMarkdownEntryName(entry.name));

  for (const entry of visibleEntries) {
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

  const scannedEntries = prioritizeFolderScanEntries(entries, getFolderListingScanPriority)
    .slice(0, MAX_FOLDER_LISTING_SCAN_ENTRIES);
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
  const imageEntries = prioritizeFolderScanEntries(entries, getFolderImageScanPriority)
    .slice(0, MAX_FOLDER_IMAGE_ATTACHMENT_SCAN_ENTRIES)
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

  const markdownNodes = collectMentionFolderMarkdownNodes(folderNode.children, {
    maxResults: MAX_FOLDER_MENTION_NOTE_CANDIDATES,
  });
  const listing = await loadFolderListingReference(mention);
  if (markdownNodes.length === 0) {
    const scannedReferences = await loadScannedFolderMarkdownReferences(mention);
    return listing ? [listing, ...scannedReferences] : scannedReferences;
  }

  const loaded = await mapWithConcurrencyLimit(
    markdownNodes,
    MAX_CHAT_MENTION_LOAD_CONCURRENCY,
    async (node) => {
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
    },
  );
  const markdownReferences = loaded
    .filter((note) => note.content.length > 0)
    .slice(0, MAX_FOLDER_MENTION_NOTES);
  return listing ? [listing, ...markdownReferences] : markdownReferences;
}

export async function loadMentionedNotes(
  noteMentions: unknown
): Promise<Array<NoteMentionReference & { content: string }>> {
  flushCurrentPendingEditorMarkdown();
  const normalizedMentions = normalizeNoteMentionsForLoading(noteMentions);
  return (await mapWithConcurrencyLimit(
    normalizedMentions,
    MAX_CHAT_MENTION_LOAD_CONCURRENCY,
    loadMentionReference,
  )).flat();
}

export async function loadMentionedFolderImageAttachments(
  noteMentions: unknown
): Promise<Attachment[]> {
  const normalizedMentions = normalizeNoteMentionsForLoading(noteMentions);
  const attachments = (await mapWithConcurrencyLimit(
    normalizedMentions,
    MAX_CHAT_MENTION_LOAD_CONCURRENCY,
    loadFolderImageAttachmentsForMention,
  )).flat();
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

  const prefix = 'Referenced notes and folders:\n\n';
  const suffix = '\n\nAnswer based on these references plus the user request.';
  const sections: string[] = [];
  let usedChars = prefix.length + suffix.length;

  for (const note of mentionedNotes) {
    const separator = sections.length > 0 ? '\n\n---\n\n' : '';
    const heading = `## ${formatPromptLabel(note.title, note.path || 'note')}\n`;
    const remainingChars = MAX_MENTIONED_NOTES_CONTEXT_CHARS
      - usedChars
      - separator.length
      - heading.length;
    if (remainingChars <= 0) {
      break;
    }

    const boundedContent = note.content.slice(0, Math.min(MAX_NOTE_MENTION_CHARS, remainingChars));
    const section = `${heading}${boundedContent}`;
    sections.push(section);
    usedChars += separator.length + section.length;
  }

  if (sections.length === 0) {
    return '';
  }

  return `${prefix}${sections.join('\n\n---\n\n')}${suffix}`;
}

export async function normalizeVisionAttachment(
  attachment: Attachment
): Promise<ChatMessageContentPart | null> {
  if (!isImageAttachment(attachment)) {
    return null;
  }

  try {
    const rawSrc = getAttachmentMessageImageSrc(attachment);
    const directImageUrl = normalizeDirectVisionImageUrl(rawSrc);
    if (directImageUrl) {
      return {
        type: 'image_url',
        image_url: { url: directImageUrl },
      };
    }
    if (!hasConvertibleAttachmentReference(attachment, rawSrc)) {
      return null;
    }

    const base64 = await convertToBase64(attachment, {
      allowPath: isAllowedChatImageAttachmentPath,
    });
    const normalizedBase64 = isSvgDataUrl(base64)
      ? await rasterizeSvgDataUrlToPng(base64)
      : base64;
    const imageUrl = normalizeRenderableImageSrc(normalizedBase64);
    if (!imageUrl || !isSizedDataImageSrc(imageUrl)) {
      return null;
    }

    return {
      type: 'image_url',
      image_url: { url: imageUrl },
    };
  } catch (error) {
    return null;
  }
}

function isCurrentVaultImageAttachmentPath(path: string): boolean {
  const notesPath = useNotesStore.getState().notesPath?.trim();
  if (!notesPath) {
    return false;
  }

  const containedPath = normalizeContainedAssetPath(path, notesPath);
  return Boolean(containedPath && !isInsideInternalFolderMarkdownPath(containedPath));
}

function joinAbsolutePathSync(basePath: string, relativePath: string): string | null {
  const normalizedBasePath = normalizeAbsolutePath(basePath.trim()).replace(/\\/g, '/');
  const normalizedBase = normalizedBasePath === '/' || /^[A-Za-z]:\/$/i.test(normalizedBasePath)
    ? normalizedBasePath
    : normalizedBasePath.replace(/\/+$/g, '');
  const normalizedRelative = normalizeVaultRelativePath(relativePath);
  if (
    !normalizedBase ||
    !isStorageAbsolutePath(normalizedBase) ||
    hasUnsafeMentionPathSegment(normalizedBase) ||
    isInsideInternalFolderMarkdownPath(normalizedBase) ||
    !normalizedRelative ||
    isInsideInternalFolderMarkdownPath(normalizedRelative)
  ) {
    return null;
  }

  return normalizedBase.endsWith('/')
    ? `${normalizedBase}${normalizedRelative}`
    : `${normalizedBase}/${normalizedRelative}`;
}

function isStarredFolderImageAttachmentPath(path: string): boolean {
  const normalizedPath = normalizeAbsolutePath(path.trim());
  if (
    !normalizedPath ||
    !isStorageAbsolutePath(normalizedPath) ||
    hasUnsafeMentionPathSegment(normalizedPath) ||
    isInsideInternalFolderMarkdownPath(normalizedPath)
  ) {
    return false;
  }

  const starredEntries = useNotesStore.getState().starredEntries ?? [];
  return starredEntries.some((entry) => {
    if (
      entry.kind !== 'folder' ||
      isInsideInternalFolderMarkdownPath(entry.vaultPath) ||
      isInsideInternalFolderMarkdownPath(entry.relativePath)
    ) {
      return false;
    }
    const folderPath = joinAbsolutePathSync(entry.vaultPath, entry.relativePath);
    if (!folderPath) {
      return false;
    }
    const containedPath = normalizeContainedAssetPath(normalizedPath, folderPath);
    return Boolean(containedPath && !isInsideInternalFolderMarkdownPath(containedPath));
  });
}

export function isAllowedChatImageAttachmentPath(path: string): boolean {
  return isCurrentVaultImageAttachmentPath(path) || isStarredFolderImageAttachmentPath(path);
}

function normalizeDirectVisionImageUrl(src: string): string | null {
  const imageUrl = normalizeRenderableImageSrc(src);
  if (!imageUrl || !isRenderedImageSource(imageUrl)) {
    return null;
  }

  const normalized = imageUrl.toLowerCase();
  if (
    normalized.startsWith('http://') ||
    normalized.startsWith('https://') ||
    (isRenderableDataImageSrc(imageUrl) && isSizedDataImageSrc(imageUrl))
  ) {
    return imageUrl;
  }

  return null;
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
    return isSizedDataImageSrc(normalizedSrc) ? normalizedSrc : null;
  }

  if (!isSvgDataUrl(rawSrc) && !attachment.path?.trim()) {
    return null;
  }
  if (isSvgDataUrl(rawSrc) && !isSizedDataImageSrc(rawSrc)) {
    return null;
  }

  if (isSvgDataUrl(rawSrc)) {
    const rasterizedSrc = await rasterizeSvgDataUrlToPng(rawSrc);
    const normalizedRasterizedSrc = normalizeRenderableImageSrc(rasterizedSrc);
    if (normalizedRasterizedSrc && isSizedDataImageSrc(normalizedRasterizedSrc)) {
      return normalizedRasterizedSrc;
    }
  }

  if (!attachment.path?.trim()) {
    return null;
  }

  try {
    const base64 = await convertToBase64(attachment, {
      allowPath: isAllowedChatImageAttachmentPath,
    });
    const normalizedBase64 = isSvgDataUrl(base64)
      ? await rasterizeSvgDataUrlToPng(base64)
      : base64;
    const imageSrc = normalizeRenderableImageSrc(normalizedBase64);
    return imageSrc && isSizedDataImageSrc(imageSrc) ? imageSrc : null;
  } catch {
    return null;
  }
}

export async function buildMessageImageSources(attachments: Attachment[]): Promise<{ content: string; imageSources: string[] }> {
  const imageSources: string[] = [];
  const markdownParts: string[] = [];

  for (const attachment of attachments.slice(0, MAX_CHAT_MESSAGE_IMAGE_ATTACHMENTS)) {
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
