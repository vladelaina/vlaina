import { useNotesStore } from '@/stores/useNotesStore';
import { pickSourceContextMenuImage } from './noteEditorContextMenuSourceImages';

function emitSourceInput(textarea: HTMLTextAreaElement): void {
  textarea.dispatchEvent(new InputEvent('input', {
    bubbles: true,
    inputType: 'insertText',
    data: null,
  }));
}

function insertSourceText(
  textarea: HTMLTextAreaElement,
  text: string,
  selection?: { start: number; end: number },
): boolean {
  const insertionStart = textarea.selectionStart;
  textarea.setRangeText(text, textarea.selectionStart, textarea.selectionEnd, 'end');
  if (selection) {
    textarea.setSelectionRange(
      insertionStart + selection.start,
      insertionStart + selection.end,
    );
  }
  emitSourceInput(textarea);
  textarea.focus();
  return true;
}

function getNextSourceFootnoteId(textarea: HTMLTextAreaElement): string {
  let maxId = 0;
  for (const match of textarea.value.matchAll(/\[\^(\d+)\]/g)) {
    const id = Number.parseInt(match[1] ?? '', 10);
    if (Number.isInteger(id)) maxId = Math.max(maxId, id);
  }
  return String(maxId + 1);
}

function getSelectedLineRange(textarea: HTMLTextAreaElement): { start: number; end: number } {
  const selectionStart = textarea.selectionStart;
  const selectionEnd = textarea.selectionEnd;
  const start = textarea.value.lastIndexOf('\n', selectionStart - 1) + 1;
  const nextBreak = textarea.value.indexOf('\n', selectionEnd);
  return { start, end: nextBreak < 0 ? textarea.value.length : nextBreak };
}

function insertSourceParagraph(textarea: HTMLTextAreaElement, direction: 'above' | 'below'): boolean {
  const { start, end } = getSelectedLineRange(textarea);
  const insertion = direction === 'above' ? start : end;
  textarea.setRangeText('\n', insertion, insertion, 'start');
  const caret = direction === 'above' ? insertion : insertion + 1;
  textarea.setSelectionRange(caret, caret);
  emitSourceInput(textarea);
  textarea.focus();
  return true;
}

async function insertSourceImage(textarea: HTMLTextAreaElement): Promise<boolean> {
  const originalValue = textarea.value;
  const selectionStart = textarea.selectionStart;
  const selectionEnd = textarea.selectionEnd;
  const notePath = useNotesStore.getState().currentNote?.path;
  if (!notePath) return false;

  const image = await pickSourceContextMenuImage();
  if (!image || image.notePath !== notePath) return false;
  if (
    !textarea.isConnected
    || textarea.value !== originalValue
    || textarea.selectionStart !== selectionStart
    || textarea.selectionEnd !== selectionEnd
    || useNotesStore.getState().currentNote?.path !== notePath
  ) return false;
  return insertSourceText(textarea, image.markdown);
}

const sourceInsertSnippets: Record<string, string> = {
  callout: '> 💡 ',
  emoji: '😀',
  'link-reference': '[link][reference]\n\n[reference]: ',
  divider: '\n---\n',
  table: '| A | B |\n| --- | --- |\n|   |   |',
  code: '```\n\n```',
  formula: '$$\n\n$$',
  'inline-math': '$$',
  toc: '[toc]',
  mermaid: '```mermaid\n\n```',
  'html-block': '<div>\n\n</div>',
  abbreviation: '*[ABBR]: Full phrase',
  video: '![video]()',
  frontmatter: '---\ntitle: \n---\n',
};

const sourceInsertSelections: Partial<Record<string, { start: number; end: number }>> = {
  code: { start: '```\n'.length, end: '```\n'.length },
  formula: { start: '$$\n'.length, end: '$$\n'.length },
  'inline-math': { start: 1, end: 1 },
  mermaid: { start: '```mermaid\n'.length, end: '```mermaid\n'.length },
  'html-block': { start: '<div>\n'.length, end: '<div>\n'.length },
  abbreviation: { start: '*['.length, end: '*[ABBR'.length },
  video: { start: '![video]('.length, end: '![video]('.length },
  frontmatter: { start: '---\ntitle: '.length, end: '---\ntitle: '.length },
};

export function insertSourceAction(
  textarea: HTMLTextAreaElement,
  action: string,
): boolean | Promise<boolean> {
  if (action === 'image') return insertSourceImage(textarea);
  if (action === 'paragraph-above' || action === 'paragraph-below') {
    return insertSourceParagraph(textarea, action === 'paragraph-above' ? 'above' : 'below');
  }
  if (action === 'footnote' || action === 'footnote-definition') {
    const id = getNextSourceFootnoteId(textarea);
    return insertSourceText(textarea, action === 'footnote' ? `[^${id}]` : `[^${id}]: `);
  }

  const snippet = sourceInsertSnippets[action];
  if (snippet === undefined) return false;
  return insertSourceText(textarea, snippet, sourceInsertSelections[action]);
}
