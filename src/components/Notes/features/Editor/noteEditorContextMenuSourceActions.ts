import type { BlockType } from './plugins/floating-toolbar/types';
import { readSourceSelection } from './noteEditorContextMenuSourceClipboardActions';

export { insertSourceAction } from './noteEditorContextMenuSourceInsertActions';
export {
  copySourceSelection,
  cutSourceSelection,
  deleteSourceSelection,
  pasteSourceText,
  readSourceSelection,
} from './noteEditorContextMenuSourceClipboardActions';

function emitSourceInput(textarea: HTMLTextAreaElement, inputType = 'insertText'): void {
  textarea.dispatchEvent(new InputEvent('input', {
    bubbles: true,
    inputType,
    data: null,
  }));
}

function wrapSourceSelection(
  textarea: HTMLTextAreaElement,
  prefix: string,
  suffix: string,
): boolean {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selection = readSourceSelection(textarea);
  const enclosing = findEnclosingMarkers(textarea.value, start, end, prefix, suffix);
  if (enclosing) {
    const inner = textarea.value.slice(
      enclosing.from + prefix.length,
      enclosing.to - suffix.length,
    );
    const innerLength = inner.length;
    const selectionStart = Math.max(0, Math.min(innerLength, start - enclosing.from - prefix.length));
    const selectionEnd = Math.max(selectionStart, Math.min(
      innerLength,
      end - enclosing.from - prefix.length,
    ));
    textarea.setRangeText(inner, enclosing.from, enclosing.to, 'start');
    textarea.setSelectionRange(
      enclosing.from + selectionStart,
      enclosing.from + selectionEnd,
    );
    emitSourceInput(textarea);
    textarea.focus();
    return true;
  }

  textarea.setRangeText(`${prefix}${selection}${suffix}`, start, end, 'start');
  textarea.setSelectionRange(start + prefix.length, start + prefix.length + selection.length);
  emitSourceInput(textarea);
  textarea.focus();
  return true;
}

function markerIsValid(value: string, index: number, marker: string): boolean {
  if (value.slice(index, index + marker.length) !== marker) return false;
  if (marker !== '*') return true;
  return value[index - 1] !== '*' && value[index + 1] !== '*';
}

function findMarkerBefore(value: string, from: number, marker: string): number {
  let index = value.lastIndexOf(marker, from);
  while (index >= 0 && !markerIsValid(value, index, marker)) {
    if (index === 0) return -1;
    index = value.lastIndexOf(marker, index - 1);
  }
  return index;
}

function findMarkerAfter(value: string, from: number, marker: string): number {
  let index = value.indexOf(marker, from);
  while (index >= 0 && !markerIsValid(value, index, marker)) {
    index = value.indexOf(marker, index + 1);
  }
  return index;
}

function findEnclosingMarkers(
  value: string,
  start: number,
  end: number,
  prefix: string,
  suffix: string,
): { from: number; to: number } | null {
  if (
    markerIsValid(value, start, prefix)
    && markerIsValid(value, end - suffix.length, suffix)
    && end - start >= prefix.length + suffix.length
  ) {
    return { from: start, to: end };
  }

  const directFrom = start - prefix.length;
  if (
    directFrom >= 0
    && markerIsValid(value, directFrom, prefix)
    && markerIsValid(value, end, suffix)
  ) {
    return { from: directFrom, to: end + suffix.length };
  }

  if (start !== end) return null;
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const nextBreak = value.indexOf('\n', end);
  const lineEnd = nextBreak < 0 ? value.length : nextBreak;
  const opening = findMarkerBefore(value, start - prefix.length, prefix);
  if (opening < lineStart || opening + prefix.length > start) return null;
  const closing = findMarkerAfter(value, start, suffix);
  if (closing < start || closing + suffix.length > lineEnd) return null;
  return { from: opening, to: closing + suffix.length };
}

export function getSourceActiveMarks(textarea: HTMLTextAreaElement | null): Set<string> {
  if (!textarea) return new Set();
  const { value, selectionStart, selectionEnd } = textarea;
  const formats = [
    ['strong', '**', '**'],
    ['emphasis', '*', '*'],
    ['underline', '++', '++'],
    ['strike_through', '~~', '~~'],
    ['inlineCode', '`', '`'],
    ['highlight', '==', '=='],
  ] as const;
  return new Set(formats
    .filter(([, prefix, suffix]) => Boolean(findEnclosingMarkers(
      value,
      selectionStart,
      selectionEnd,
      prefix,
      suffix,
    )))
    .map(([mark]) => mark));
}

function getSelectedLineRange(textarea: HTMLTextAreaElement): { start: number; end: number } {
  const selectionStart = textarea.selectionStart;
  const selectionEnd = textarea.selectionEnd;
  const start = textarea.value.lastIndexOf('\n', selectionStart - 1) + 1;
  const nextBreak = textarea.value.indexOf('\n', selectionEnd);
  return { start, end: nextBreak < 0 ? textarea.value.length : nextBreak };
}

function transformLines(
  textarea: HTMLTextAreaElement,
  transform: (line: string, index: number) => string,
): boolean {
  const { start: lineStart, end: lineEnd } = getSelectedLineRange(textarea);
  const source = textarea.value.slice(lineStart, lineEnd);
  const next = source.split('\n').map(transform).join('\n');
  if (next === source) return false;
  textarea.setRangeText(next, lineStart, lineEnd, 'preserve');
  emitSourceInput(textarea);
  textarea.focus();
  return true;
}

function toggleLinePrefix(
  textarea: HTMLTextAreaElement,
  pattern: RegExp,
  createPrefix: (index: number) => string,
): boolean {
  const { start, end } = getSelectedLineRange(textarea);
  const lines = textarea.value.slice(start, end).split('\n');
  const shouldRemove = lines.every((line) => pattern.test(line));
  const next = lines.map((line, index) => (
    shouldRemove ? line.replace(pattern, '') : `${createPrefix(index)}${line}`
  )).join('\n');
  textarea.setRangeText(next, start, end, 'preserve');
  emitSourceInput(textarea);
  textarea.focus();
  return true;
}

export function applySourceFormatting(textarea: HTMLTextAreaElement, action: string): boolean {
  switch (action) {
    case 'bold': return wrapSourceSelection(textarea, '**', '**');
    case 'italic': return wrapSourceSelection(textarea, '*', '*');
    case 'underline': return wrapSourceSelection(textarea, '++', '++');
    case 'strike': return wrapSourceSelection(textarea, '~~', '~~');
    case 'code': return wrapSourceSelection(textarea, '`', '`');
    case 'highlight': return wrapSourceSelection(textarea, '==', '==');
    case 'quote': return toggleLinePrefix(textarea, /^>\s/, () => '> ');
    case 'ordered-list': return toggleLinePrefix(textarea, /^\d+[.)]\s/, (index) => `${index + 1}. `);
    case 'bullet-list': return toggleLinePrefix(textarea, /^[-+*]\s/, () => '- ');
    case 'task-list': return toggleLinePrefix(textarea, /^[-+*]\s+\[[ xX]\]\s/, () => '- [ ] ');
    case 'link': {
      const start = textarea.selectionStart;
      const selection = readSourceSelection(textarea);
      const label = selection || 'link';
      const next = `[${label}]()`;
      textarea.setRangeText(next, start, textarea.selectionEnd, 'end');
      const urlPosition = start + next.length - 1;
      textarea.setSelectionRange(urlPosition, urlPosition);
      emitSourceInput(textarea);
      textarea.focus();
      return true;
    }
    default: return false;
  }
}

function getSourceLineBlockType(line: string): BlockType {
  const trimmed = line.trimStart();
  const heading = /^(#{1,6})\s/.exec(trimmed);
  if (heading) return `heading${heading[1].length}` as BlockType;
  if (/^>\s/.test(trimmed)) return 'blockquote';
  if (/^\d+[.)]\s/.test(trimmed)) return 'orderedList';
  if (/^[-+*]\s+\[[ xX]\]\s/.test(trimmed)) return 'taskList';
  if (/^[-+*]\s/.test(trimmed)) return 'bulletList';
  return 'paragraph';
}

export function getSourceBlockType(textarea: HTMLTextAreaElement | null): BlockType | null {
  if (!textarea) return null;
  const { start, end } = getSelectedLineRange(textarea);
  const types = new Set(textarea.value.slice(start, end).split('\n').map(getSourceLineBlockType));
  return types.size === 1 ? [...types][0] : null;
}

export function applySourceBlockType(textarea: HTMLTextAreaElement, blockType: string): boolean {
  const levels: Record<string, string> = {
    heading1: '# ',
    heading2: '## ',
    heading3: '### ',
    heading4: '#### ',
    heading5: '##### ',
    heading6: '###### ',
    paragraph: '',
  };
  const prefix = levels[blockType];
  if (prefix === undefined) return false;
  return transformLines(textarea, (line) => {
    const withoutHeading = line.replace(/^#{1,6}\s+/, '');
    return `${prefix}${withoutHeading}`;
  });
}
