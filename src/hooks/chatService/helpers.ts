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
import { isManagedProviderId } from '@/lib/ai/managedService';
import { useAccountSessionStore } from '@/stores/accountSession';
import { useManagedAIStore } from '@/stores/useManagedAIStore';
import { stripVlainaManagedFrontmatter } from '@/stores/notes/frontmatter';
import { flushCurrentPendingEditorMarkdown } from '@/stores/notes/pendingEditorMarkdownFlusher';

const SVG_DATA_URL_REGEX = /^data:image\/svg\+xml/i;
const IMAGE_NAME_REGEX = /\.(png|jpe?g|webp|gif|bmp|avif|svg)(?:$|[?#])/i;
const MAX_NOTE_MENTION_COUNT = 3;
const MAX_NOTE_MENTION_CHARS = 12000;
const MAX_NOTE_MENTION_READ_BYTES = 512 * 1024;
const STREAM_CHUNK_FLUSH_MAX_DELAY_MS = 40;

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

export async function loadMentionedNotes(
  noteMentions: NoteMentionReference[]
): Promise<Array<NoteMentionReference & { content: string }>> {
  flushCurrentPendingEditorMarkdown();
  return (
    await Promise.all(
      noteMentions.map(async (mention) => ({
        ...mention,
        content: stripVlainaManagedFrontmatter(
          await resolveMentionedNoteContent(mention.path),
        ).trim(),
      }))
    )
  ).filter((note) => note.content.length > 0);
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
    'Referenced notes (Markdown):',
    '',
    sections.join('\n\n---\n\n'),
    '',
    'Answer based on these notes plus the user request.',
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
