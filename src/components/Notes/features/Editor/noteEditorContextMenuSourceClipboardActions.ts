import { writeHtmlAndTextToClipboard, writeTextToClipboard } from '@/lib/clipboard';
import { getElectronBridge } from '@/lib/electron/bridge';
import type { ContextMenuCopyFormat } from './noteEditorContextMenuClipboardActions';

function emitSourceInput(textarea: HTMLTextAreaElement, inputType: string): void {
  textarea.dispatchEvent(new InputEvent('input', {
    bubbles: true,
    inputType,
    data: null,
  }));
}

export function readSourceSelection(textarea: HTMLTextAreaElement): string {
  return textarea.value.slice(textarea.selectionStart, textarea.selectionEnd);
}

export async function copySourceSelection(
  textarea: HTMLTextAreaElement,
  format: ContextMenuCopyFormat = 'markdown',
): Promise<boolean> {
  const markdown = readSourceSelection(textarea);
  if (!markdown) return false;
  if (format === 'markdown') return writeTextToClipboard(markdown);

  const { renderSourceClipboardContent } = await import('./noteEditorContextMenuSourceClipboard');
  const { html, text } = renderSourceClipboardContent(markdown);
  if (format === 'html') return writeTextToClipboard(html);
  if (format === 'rich') return writeHtmlAndTextToClipboard(html, text);
  return writeTextToClipboard(text);
}

export async function cutSourceSelection(textarea: HTMLTextAreaElement): Promise<boolean> {
  const value = textarea.value;
  const selectionStart = textarea.selectionStart;
  const selectionEnd = textarea.selectionEnd;
  const copied = await copySourceSelection(textarea);
  if (!copied) return false;
  if (
    !textarea.isConnected
    || textarea.value !== value
    || textarea.selectionStart !== selectionStart
    || textarea.selectionEnd !== selectionEnd
  ) return false;
  deleteSourceSelection(textarea, 'deleteByCut');
  return true;
}

export function deleteSourceSelection(
  textarea: HTMLTextAreaElement,
  inputType = 'deleteContentBackward',
): boolean {
  if (textarea.selectionStart === textarea.selectionEnd) return false;
  textarea.setRangeText('', textarea.selectionStart, textarea.selectionEnd, 'start');
  emitSourceInput(textarea, inputType);
  textarea.focus();
  return true;
}

async function readClipboardText(): Promise<string> {
  const desktopClipboard = getElectronBridge()?.clipboard;
  if (desktopClipboard?.readText) {
    try {
      return await desktopClipboard.readText();
    } catch {
    }
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
    try {
      return await navigator.clipboard.readText();
    } catch {
    }
  }

  return '';
}

export async function pasteSourceText(textarea: HTMLTextAreaElement): Promise<boolean> {
  const value = textarea.value;
  const selectionStart = textarea.selectionStart;
  const selectionEnd = textarea.selectionEnd;
  const text = await readClipboardText();
  if (!text) return false;
  if (
    !textarea.isConnected
    || textarea.value !== value
    || textarea.selectionStart !== selectionStart
    || textarea.selectionEnd !== selectionEnd
  ) return false;
  textarea.setRangeText(text, textarea.selectionStart, textarea.selectionEnd, 'end');
  emitSourceInput(textarea, 'insertFromPaste');
  textarea.focus();
  return true;
}
