import {
  parseChatHeadingDragPayload,
  CHAT_HEADING_DRAG_MIME,
} from '@/lib/drag/chatHeadingDrag';
import type { HeadingDropPayload } from './externalHeadingDrop';
import { parseSingleHeadingDropHtml } from './externalHeadingDrop';

export const MAX_EXTERNAL_TEXT_DRAG_TYPE_SCAN = 1024;

function getDataTransferType(types: DataTransfer['types'], index: number): string | null {
  const maybeTypes = types as DataTransfer['types'] & { item?: (index: number) => string | null };
  if (typeof maybeTypes.item === 'function') {
    return maybeTypes.item(index);
  }
  return maybeTypes[index] ?? null;
}

export function hasExternalTextDrag(dataTransfer: DataTransfer | null | undefined): boolean {
  if (!dataTransfer) return false;
  const types = dataTransfer.types;
  if (!types) return false;
  const length = Math.min(types.length, MAX_EXTERNAL_TEXT_DRAG_TYPE_SCAN);
  let hasTextType = false;

  for (let index = 0; index < length; index += 1) {
    const type = getDataTransferType(types, index);
    if (type === 'Files') return false;
    if (
      type === CHAT_HEADING_DRAG_MIME ||
      type === 'text/plain' ||
      type === 'text/html' ||
      type === 'text/uri-list'
    ) {
      hasTextType = true;
    }
  }

  return hasTextType && types.length <= MAX_EXTERNAL_TEXT_DRAG_TYPE_SCAN;
}

function getSingleHeadingFromHtml(dataTransfer: DataTransfer | null | undefined): HeadingDropPayload | null {
  const html = dataTransfer?.getData('text/html');
  return html ? parseSingleHeadingDropHtml(html) : null;
}

export function getHeadingDropPayload(dataTransfer: DataTransfer | null | undefined): HeadingDropPayload | null {
  if (!dataTransfer) return null;

  const customPayload = parseChatHeadingDragPayload(dataTransfer.getData(CHAT_HEADING_DRAG_MIME));
  if (customPayload) return customPayload;

  return getSingleHeadingFromHtml(dataTransfer);
}

export function hasHeadingDropPayload(dataTransfer: DataTransfer | null | undefined): boolean {
  if (!dataTransfer) return false;

  const types = dataTransfer.types;
  if (!types) return false;
  const length = Math.min(types.length, MAX_EXTERNAL_TEXT_DRAG_TYPE_SCAN);
  let hasCustomPayload = false;
  let hasHtml = false;

  for (let index = 0; index < length; index += 1) {
    const type = getDataTransferType(types, index);
    if (type === CHAT_HEADING_DRAG_MIME) {
      hasCustomPayload = true;
    }
    if (type === 'text/html') {
      hasHtml = true;
    }
  }

  if (types.length > MAX_EXTERNAL_TEXT_DRAG_TYPE_SCAN) return false;
  if (hasCustomPayload && parseChatHeadingDragPayload(dataTransfer.getData(CHAT_HEADING_DRAG_MIME))) return true;
  return hasHtml && Boolean(getSingleHeadingFromHtml(dataTransfer));
}
