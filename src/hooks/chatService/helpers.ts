import { convertToBase64, type Attachment } from '@/lib/storage/attachmentStorage';
import type { ChatMessageContent, ChatMessageContentPart } from '@/lib/ai/types';
import type { NoteMentionReference } from '@/lib/ai/noteMentions';
import { dedupeNoteMentions } from '@/lib/ai/noteMentions';
import {
  extractMarkdownImageSources,
  stripMarkdownImageTokens,
} from '@/components/Chat/common/messageClipboard';
import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { findNode } from '@/stores/notes/fileTreeUtils';
import type { FileTreeNode } from '@/stores/notes/types';
import { isManagedProviderId } from '@/lib/ai/managedService';
import { useAccountSessionStore } from '@/stores/accountSession';
import { useManagedAIStore } from '@/stores/useManagedAIStore';
import { stripManagedFrontmatter } from '@/stores/notes/frontmatter';
import { flushCurrentPendingEditorMarkdown } from '@/stores/notes/pendingEditorMarkdownFlusher';

const SVG_DATA_URL_REGEX = /^data:image\/svg\+xml/i;
const IMAGE_NAME_REGEX = /\.(png|jpe?g|webp|gif|bmp|avif|svg)(?:$|[?#])/i;
const MAX_NOTE_MENTION_COUNT = 3;
const MAX_NOTE_MENTION_CHARS = 12000;
const MAX_NOTE_MENTION_READ_BYTES = 512 * 1024;
const MAX_FOLDER_MENTION_NOTES = 20;
const MAX_FOLDER_LISTING_ENTRIES = 80;
const MAX_FOLDER_IMAGE_ATTACHMENTS = 8;
const MAX_FOLDER_IMAGE_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const STREAM_CHUNK_FLUSH_MAX_DELAY_MS = 40;
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
  if (mimeType === 'image/svg+xml' && previewUrl.startsWith('data:image/')) {
    return previewUrl;
  }

  const attachmentPath = attachment.path?.trim() ?? '';
  const pathFilename = attachmentPath.split(/[\\/]/).pop()?.trim();
  if (pathFilename) {
    return `attachment://${encodeURIComponent(pathFilename)}`;
  }

  const assetUrl = attachment.assetUrl?.trim() ?? '';
  if (assetUrl) {
    try {
      const url = new URL(assetUrl);
      const marker = '/attachments/';
      const markerIndex = url.pathname.lastIndexOf(marker);
      if (markerIndex !== -1) {
        const filename = decodeURIComponent(url.pathname.slice(markerIndex + marker.length)).trim();
        if (filename && !/[\\/]/.test(filename)) {
          return `attachment://${encodeURIComponent(filename)}`;
        }
      }
    } catch {}
    return assetUrl;
  }
  return previewUrl;
}

export function toImageMarkdown(src: string): string {
  return `![image](<${src}>)`;
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

async function resolveMentionedNoteContent(notePath: string): Promise<string> {
  const notesState = useNotesStore.getState();

  if (notesState.currentNote?.path === notePath) {
    return notesState.currentNote.content || '';
  }

  const cached = notesState.noteContentsCache.get(notePath);
  if (cached?.content.trim()) {
    return cached.content;
  }

  const storage = getStorageAdapter();
  try {
    if (isAbsolutePath(notePath)) {
      const fileInfo = await storage.stat(notePath).catch(() => null);
      if (typeof fileInfo?.size === 'number' && fileInfo.size > MAX_NOTE_MENTION_READ_BYTES) {
        return '';
      }
      return await storage.readFile(notePath);
    }
    if (!notesState.notesPath) {
      return '';
    }
    const fullPath = await joinPath(notesState.notesPath, notePath);
    const fileInfo = await storage.stat(fullPath).catch(() => null);
    if (typeof fileInfo?.size === 'number' && fileInfo.size > MAX_NOTE_MENTION_READ_BYTES) {
      return '';
    }
    return await storage.readFile(fullPath);
  } catch {
    return '';
  }
}

function collectMarkdownNodes(nodes: readonly FileTreeNode[], result: FileTreeNode[] = []): FileTreeNode[] {
  for (const node of nodes) {
    if (node.isFolder) {
      collectMarkdownNodes(node.children, result);
    } else if (node.path.toLowerCase().endsWith('.md')) {
      result.push(node);
    }
  }
  return result;
}

async function resolveMentionedFolderPath(folderPath: string): Promise<string | null> {
  if (isAbsolutePath(folderPath)) {
    return folderPath;
  }
  const notesPath = useNotesStore.getState().notesPath;
  if (!notesPath) {
    return null;
  }
  return await joinPath(notesPath, folderPath);
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
        `Folder: ${mention.path}`,
        '',
        'Folder listing is empty or unavailable.',
      ].join('\n'),
    };
  }

  const visibleEntries = entries
    .filter((entry) => !entry.name.startsWith('.'))
    .sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  const listedEntries = visibleEntries.slice(0, MAX_FOLDER_LISTING_ENTRIES);
  const lines = listedEntries.map((entry) => {
    const kind = entry.isDirectory ? 'folder' : 'file';
    return `- ${entry.name} (${kind}${formatFolderEntrySize(entry.size)})`;
  });
  const hiddenCount = Math.max(visibleEntries.length - listedEntries.length, 0);

  return {
    ...mention,
    kind: 'folder',
    content: [
      `Folder: ${mention.path}`,
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
      !entry.name.startsWith('.') &&
      entry.isFile &&
      IMAGE_NAME_REGEX.test(entry.name)
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  const attachments: Attachment[] = [];
  for (const entry of imageEntries) {
    if (attachments.length >= MAX_FOLDER_IMAGE_ATTACHMENTS) {
      break;
    }
    const stat = typeof entry.size === 'number'
      ? entry
      : await storage.stat(entry.path).catch(() => null);
    const size = typeof stat?.size === 'number' ? stat.size : entry.size;
    if (typeof size === 'number' && size > MAX_FOLDER_IMAGE_ATTACHMENT_BYTES) {
      continue;
    }
    attachments.push(createFolderImageAttachment({
      path: entry.path,
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
      return listing ? [listing] : [];
    }
    return [];
  }

  const markdownNodes = collectMarkdownNodes(folderNode.children)
    .slice(0, MAX_FOLDER_MENTION_NOTES);
  const listing = await loadFolderListingReference(mention);
  if (markdownNodes.length === 0) {
    return listing ? [listing] : [];
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
    return `## ${note.title}\n${boundedContent}`;
  });

  return [
    'Referenced notes and folders:',
    '',
    sections.join('\n\n---\n\n'),
    '',
    'Answer based on these references plus the user request.',
  ].join('\n');
}

function decodeSvgDataUrl(dataUrl: string): string | null {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex < 0) {
    return null;
  }
  const meta = dataUrl.slice(0, commaIndex);
  const payload = dataUrl.slice(commaIndex + 1);
  try {
    if (/;base64/i.test(meta)) {
      return window.atob(payload);
    }
    return decodeURIComponent(payload);
  } catch {
    return null;
  }
}

function pickSvgRenderSize(svgText: string): { width: number; height: number } {
  const clamp = (value: number) => Math.max(1, Math.min(4096, Math.round(value)));
  const parsePositive = (value: string | undefined) => {
    if (!value) return null;
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  const widthMatch = /\bwidth=["']\s*([0-9.]+)(?:px)?\s*["']/i.exec(svgText);
  const heightMatch = /\bheight=["']\s*([0-9.]+)(?:px)?\s*["']/i.exec(svgText);
  const widthFromAttr = parsePositive(widthMatch?.[1]);
  const heightFromAttr = parsePositive(heightMatch?.[1]);
  if (widthFromAttr && heightFromAttr) {
    return { width: clamp(widthFromAttr), height: clamp(heightFromAttr) };
  }

  const viewBoxMatch = /\bviewBox=["']\s*[-0-9.]+\s+[-0-9.]+\s+([0-9.]+)\s+([0-9.]+)\s*["']/i.exec(svgText);
  const widthFromViewBox = parsePositive(viewBoxMatch?.[1]);
  const heightFromViewBox = parsePositive(viewBoxMatch?.[2]);
  if (widthFromViewBox && heightFromViewBox) {
    return { width: clamp(widthFromViewBox), height: clamp(heightFromViewBox) };
  }

  return { width: 1024, height: 1024 };
}

function rasterizeSvgDataUrlToPng(dataUrl: string): Promise<string> {
  if (typeof window === 'undefined') {
    return Promise.resolve(dataUrl);
  }

  const svgText = decodeSvgDataUrl(dataUrl);
  const { width, height } = pickSvgRenderSize(svgText ?? '');

  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(dataUrl);
      }
    };
    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });
}

export async function normalizeVisionAttachment(
  attachment: Attachment
): Promise<ChatMessageContentPart | null> {
  if (!isImageAttachment(attachment)) {
    return null;
  }

  try {
    const base64 = await convertToBase64(attachment);
    const normalizedBase64 = SVG_DATA_URL_REGEX.test(base64.trim())
      ? await rasterizeSvgDataUrlToPng(base64)
      : base64;

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

export function buildMessageImageSources(attachments: Attachment[]): { content: string; imageSources: string[] } {
  const imageSources: string[] = [];
  const content = attachments
    .filter(isImageAttachment)
    .map((attachment) => getAttachmentMessageImageSrc(attachment))
    .filter((src) => src.length > 0)
    .map((src) => {
      imageSources.push(src);
      return toImageMarkdown(src);
    })
    .join('\n\n');

  return { content, imageSources };
}
