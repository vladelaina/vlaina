import {
  applySourceBlockType,
  applySourceFormatting,
  copySourceSelection,
  insertSourceAction,
  pasteSourceText,
} from './noteEditorContextMenuSourceActions';

function isSourceModShortcut(event: KeyboardEvent): boolean {
  return (event.ctrlKey || event.metaKey) && !event.altKey && !event.isComposing;
}

function keyIs(event: KeyboardEvent, ...keys: string[]): boolean {
  const key = event.key.toLowerCase();
  return keys.some((candidate) => key === candidate.toLowerCase());
}

/** Handles the formatting and insertion combinations exposed by the source context menu. */
export function handleSourceEditorShortcut(
  textarea: HTMLTextAreaElement,
  event: KeyboardEvent,
): boolean {
  if (!isSourceModShortcut(event)) return false;

  if (!event.shiftKey && /^[0-6]$/.test(event.key)) {
    applySourceBlockType(textarea, event.key === '0' ? 'paragraph' : `heading${event.key}`);
    return true;
  }

  if (!event.shiftKey) {
    if (keyIs(event, 'b')) return applySourceFormatting(textarea, 'bold');
    if (keyIs(event, 'i')) return applySourceFormatting(textarea, 'italic');
    if (keyIs(event, 'u')) return applySourceFormatting(textarea, 'underline');
    if (keyIs(event, 'h')) return applySourceFormatting(textarea, 'highlight');
    if (keyIs(event, 'k')) return applySourceFormatting(textarea, 'link');
    if (keyIs(event, 't')) return Boolean(insertSourceAction(textarea, 'table'));
  }

  if (event.shiftKey) {
    if (keyIs(event, 'c')) {
      void copySourceSelection(textarea, 'markdown');
      return true;
    }
    if (keyIs(event, '`', '~')) return applySourceFormatting(textarea, 'code');
    if (keyIs(event, 'q')) return applySourceFormatting(textarea, 'quote');
    if (keyIs(event, 'x')) return applySourceFormatting(textarea, 'task-list');
    if (keyIs(event, '[', '{')) return applySourceFormatting(textarea, 'ordered-list');
    if (keyIs(event, ']', '}')) return applySourceFormatting(textarea, 'bullet-list');
    if (keyIs(event, 'i')) return Boolean(insertSourceAction(textarea, 'image'));
    if (keyIs(event, 'k')) return Boolean(insertSourceAction(textarea, 'code'));
    if (keyIs(event, 'm')) return Boolean(insertSourceAction(textarea, 'formula'));
    if (keyIs(event, '5', '%')) return applySourceFormatting(textarea, 'strike');
    if (keyIs(event, 'v')) {
      void pasteSourceText(textarea);
      return true;
    }
  }

  return false;
}
