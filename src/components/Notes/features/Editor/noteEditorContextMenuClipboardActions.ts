import type { EditorView } from '@milkdown/kit/prose/view';
import { getElectronBridge } from '@/lib/electron/bridge';
import { writeHtmlAndTextToClipboard, writeTextToClipboard } from '@/lib/clipboard';
import { createPlainTextBlankLineSlice, createPlainTextLineBreakSlice } from './plugins/clipboard/clipboardPlainTextPaste';
import { serializeSelectionToClipboardText } from './plugins/clipboard/selectionSerialization';
import { serializeSliceAsVisiblePlainText } from './plugins/clipboard/visibleTextSerialization';
import { getBlockSelectionPluginState, hasSelectedBlocks } from './plugins/cursor/blockSelectionPluginState';
import { serializeSelectedBlocksToText } from './plugins/cursor/blockSelectionSerializer';
import { copySelectionToClipboard } from './plugins/floating-toolbar/clipboardCommands';
import { markEditorUserInput } from './plugins/shared/userInputEvents';
import { getCurrentMarkdownParser, getCurrentMarkdownSerializer } from './utils/editorViewRegistry';

export type ContextMenuCopyFormat = 'markdown' | 'html' | 'rich' | 'plain';

interface ClipboardPayload {
  text: string;
  html: string;
}

async function readClipboardPayload(): Promise<ClipboardPayload> {
  const desktopClipboard = getElectronBridge()?.clipboard;
  if (desktopClipboard?.readText) {
    try {
      const [text, html] = await Promise.all([
        desktopClipboard.readText(),
        desktopClipboard.readHTML?.() ?? Promise.resolve(''),
      ]);
      return { text, html };
    } catch {
    }
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
    try {
      return { text: await navigator.clipboard.readText(), html: '' };
    } catch {
    }
  }

  return { text: '', html: '' };
}

function getSelectedSlice(view: EditorView) {
  const selectedBlocks = getBlockSelectionPluginState(view.state).selectedBlocks;
  if (selectedBlocks.length > 0) {
    const from = Math.min(...selectedBlocks.map((block) => block.from));
    const to = Math.max(...selectedBlocks.map((block) => block.to));
    return view.state.doc.slice(from, to);
  }
  return view.state.selection.content();
}

function getSelectedText(view: EditorView, format: ContextMenuCopyFormat): string {
  const serializer = getCurrentMarkdownSerializer();
  const selectedBlocks = getBlockSelectionPluginState(view.state).selectedBlocks;
  if (format === 'markdown') {
    if (selectedBlocks.length > 0) {
      return serializeSelectedBlocksToText(view.state, selectedBlocks, { markdownSerializer: serializer });
    }
    return serializeSelectionToClipboardText(view.state, serializer);
  }

  const slice = getSelectedSlice(view);
  if (format === 'plain' || format === 'rich') {
    return serializeSliceAsVisiblePlainText(slice);
  }
  return view.serializeForClipboard(slice).text;
}

export async function copyRichSelection(
  view: EditorView,
  format: ContextMenuCopyFormat,
): Promise<boolean> {
  if (format === 'markdown') {
    return copySelectionToClipboard(view, { collapseAfterCopy: false });
  }
  if (!hasSelectedBlocks(view.state) && view.state.selection.empty) return false;

  const text = getSelectedText(view, format);
  if (format === 'html' || format === 'rich') {
    const html = view.serializeForClipboard(getSelectedSlice(view)).dom.innerHTML;
    if (!html) return false;
    return format === 'html'
      ? writeTextToClipboard(html)
      : writeHtmlAndTextToClipboard(html, text);
  }
  if (!text) return false;
  return writeTextToClipboard(text);
}

function dispatchLiteralText(view: EditorView, text: string): boolean {
  if (!text) return false;
  const state = view.state;
  const slice = createPlainTextBlankLineSlice(state, text)
    ?? createPlainTextLineBreakSlice(state, text);
  markEditorUserInput(view);
  view.dispatch((slice
    ? state.tr.replaceSelection(slice)
    : state.tr.insertText(text)).scrollIntoView());
  view.focus();
  return true;
}

function createPasteEvent(
  type: 'text/html' | 'text/plain',
  value: string,
): ClipboardEvent | undefined {
  if (typeof ClipboardEvent === 'undefined' || typeof DataTransfer === 'undefined') return undefined;
  try {
    const data = new DataTransfer();
    data.setData(type, value);
    return new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true });
  } catch {
    return undefined;
  }
}

export async function pasteIntoEditor(view: EditorView, plainText: boolean): Promise<boolean> {
  const doc = view.state.doc;
  const selection = view.state.selection;
  const selectedBlocks = getBlockSelectionPluginState(view.state).selectedBlocks;
  const payload = await readClipboardPayload();
  if (!payload.text && !payload.html) return false;
  const currentBlocks = getBlockSelectionPluginState(view.state).selectedBlocks;
  if (
    !view.state.doc.eq(doc)
    || !view.state.selection.eq(selection)
    || currentBlocks.length !== selectedBlocks.length
    || currentBlocks.some((block, index) => (
      block.from !== selectedBlocks[index]?.from || block.to !== selectedBlocks[index]?.to
    ))
  ) return false;
  if (plainText) return dispatchLiteralText(view, payload.text);
  if (payload.html) {
    try {
      const pasted = view.pasteHTML(payload.html, createPasteEvent('text/html', payload.html));
      if (pasted || !payload.text) return pasted;
    } catch {
    }
  }
  if (getCurrentMarkdownParser()) {
    try {
      return view.pasteText(payload.text, createPasteEvent('text/plain', payload.text));
    } catch {
      return dispatchLiteralText(view, payload.text);
    }
  }
  return dispatchLiteralText(view, payload.text);
}

export function pasteMarkdownTextIntoEditor(view: EditorView, text: string): boolean {
  if (!text) return false;
  return view.pasteText(text, createPasteEvent('text/plain', text));
}
