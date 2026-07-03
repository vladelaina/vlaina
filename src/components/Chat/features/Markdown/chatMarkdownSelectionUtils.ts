import type { DragEvent as ReactDragEvent } from 'react';
import {
  serializeChatHeadingDragPayload,
  CHAT_HEADING_DRAG_MIME,
  MAX_HEADING_DRAG_TEXT_CHARS,
} from '@/lib/drag/chatHeadingDrag';

const SELECTION_EXCLUDED_SELECTOR = [
  '[data-chat-selection-excluded="true"]',
  'button',
  '[role="button"]',
  'input',
  'textarea',
  'select',
  'a',
].join(',');

export const MAX_CHAT_MARKDOWN_SELECTION_TEXT_NODES = 2_000;

function rangeHasSelectedText(range: Range): boolean {
  const root = range.commonAncestorContainer;
  if (root.nodeType === Node.TEXT_NODE) {
    const text = root.textContent ?? '';
    const start = root === range.startContainer ? range.startOffset : 0;
    const end = root === range.endContainer ? range.endOffset : text.length;
    return /\S/.test(text.slice(start, end));
  }

  const ownerDocument = root.ownerDocument ?? document;
  const walker = ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let scannedTextNodes = 0;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    scannedTextNodes += 1;
    if (scannedTextNodes > MAX_CHAT_MARKDOWN_SELECTION_TEXT_NODES) {
      return true;
    }
    try {
      if (!range.intersectsNode(node)) {
        continue;
      }
    } catch {
      continue;
    }

    const text = node.textContent ?? '';
    const start = node === range.startContainer ? range.startOffset : 0;
    const end = node === range.endContainer ? range.endOffset : text.length;
    if (/\S/.test(text.slice(start, end))) {
      return true;
    }
  }

  return false;
}

export function hasActiveSelectionText(): boolean {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return false;
  }
  for (let index = 0; index < selection.rangeCount; index += 1) {
    try {
      if (rangeHasSelectedText(selection.getRangeAt(index))) {
        return true;
      }
    } catch {
      return true;
    }
  }
  return false;
}

export function selectionIntersectsElement(element: Element | null): boolean {
  const selection = window.getSelection();
  if (!element || !selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return false;
  }

  for (let index = 0; index < selection.rangeCount; index += 1) {
    try {
      if (selection.getRangeAt(index).intersectsNode(element)) {
        return true;
      }
    } catch {
      return true;
    }
  }
  return false;
}

export function isSelectionSurfaceTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }

  return (
    !!target.closest('[data-chat-selection-surface="true"]') &&
    !target.closest(SELECTION_EXCLUDED_SELECTOR)
  );
}

function getElementFromEventTarget(target: EventTarget | null): Element | null {
  if (target instanceof Element) return target;
  if (target instanceof Text) return target.parentElement;
  return null;
}

function getBoundedElementText(element: Element, maxChars: number): string | null {
  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const chunks: string[] = [];
  let length = 0;
  let scannedTextNodes = 0;

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    scannedTextNodes += 1;
    if (scannedTextNodes > MAX_CHAT_MARKDOWN_SELECTION_TEXT_NODES) {
      return null;
    }
    const text = node.textContent ?? '';
    length += text.length;
    if (length > maxChars) {
      return null;
    }
    chunks.push(text);
  }

  return chunks.join('').trim();
}

function getBoundedSelectionText(selection: Selection, maxChars: number): string | null {
  const chunks: string[] = [];
  let length = 0;
  let scannedTextNodes = 0;

  for (let rangeIndex = 0; rangeIndex < selection.rangeCount; rangeIndex += 1) {
    const range = selection.getRangeAt(rangeIndex);
    const root = range.commonAncestorContainer;
    if (root.nodeType === Node.TEXT_NODE) {
      const text = root.textContent ?? '';
      const start = root === range.startContainer ? range.startOffset : 0;
      const end = root === range.endContainer ? range.endOffset : text.length;
      const selected = text.slice(start, end);
      length += selected.length;
      if (length > maxChars) return null;
      chunks.push(selected);
      continue;
    }

    const ownerDocument = root.ownerDocument ?? document;
    const walker = ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      scannedTextNodes += 1;
      if (scannedTextNodes > MAX_CHAT_MARKDOWN_SELECTION_TEXT_NODES) {
        return null;
      }
      try {
        if (!range.intersectsNode(node)) {
          continue;
        }
      } catch {
        continue;
      }

      const text = node.textContent ?? '';
      const start = node === range.startContainer ? range.startOffset : 0;
      const end = node === range.endContainer ? range.endOffset : text.length;
      const selected = text.slice(start, end);
      length += selected.length;
      if (length > maxChars) return null;
      chunks.push(selected);
    }
  }

  return chunks.join('').trim();
}

function getSelectedMarkdownHeadingDragPayload(target: EventTarget | null): { level: number; text: string } | null {
  const element = getElementFromEventTarget(target);
  if (!element) return null;

  const heading = element.closest('h1,h2,h3,h4,h5,h6');
  if (!(heading instanceof HTMLElement)) return null;

  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;

  const selectedText = getBoundedSelectionText(selection, MAX_HEADING_DRAG_TEXT_CHARS);
  const headingText = getBoundedElementText(heading, MAX_HEADING_DRAG_TEXT_CHARS);
  if (!selectedText || selectedText !== headingText) return null;

  let intersectsHeading = false;
  for (let index = 0; index < selection.rangeCount; index += 1) {
    try {
      if (selection.getRangeAt(index).intersectsNode(heading)) {
        intersectsHeading = true;
      }
    } catch {
      return null;
    }
  }
  if (!intersectsHeading) return null;

  const level = Number(heading.tagName.slice(1));
  if (!Number.isInteger(level) || level < 1 || level > 6) return null;
  return { level, text: headingText };
}

export function handleMarkdownHeadingDragStart(event: ReactDragEvent<HTMLDivElement>): void {
  const payload = getSelectedMarkdownHeadingDragPayload(event.target);
  if (!payload) return;

  event.dataTransfer.setData(
    CHAT_HEADING_DRAG_MIME,
    serializeChatHeadingDragPayload(payload),
  );
}
