import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applySourceBlockType,
  applySourceFormatting,
  copySourceSelection,
  getSourceActiveMarks,
  getSourceBlockType,
  insertSourceAction,
} from './noteEditorContextMenuSourceActions';

const mocks = vi.hoisted(() => ({
  currentNotePath: '/notes/current.md',
  pickSourceContextMenuImage: vi.fn(),
}));

vi.mock('@/lib/storage/dialog', () => ({ openDialog: vi.fn() }));
vi.mock('@/stores/useNotesStore', () => ({
  useNotesStore: {
    getState: () => ({ currentNote: { path: mocks.currentNotePath } }),
  },
}));
vi.mock('./noteEditorContextMenuSourceImages', () => ({
  pickSourceContextMenuImage: mocks.pickSourceContextMenuImage,
}));

function createTextarea(value: string, start: number, end = start): HTMLTextAreaElement {
  const textarea = document.createElement('textarea');
  textarea.value = value;
  document.body.appendChild(textarea);
  textarea.setSelectionRange(start, end);
  return textarea;
}

describe('note editor source context menu actions', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    mocks.currentNotePath = '/notes/current.md';
    mocks.pickSourceContextMenuImage.mockReset();
  });

  it('wraps selected text in link syntax and places the caret in the empty destination', () => {
    const textarea = createTextarea('Read docs', 5, 9);

    expect(applySourceFormatting(textarea, 'link')).toBe(true);
    expect(textarea.value).toBe('Read [docs]()');
    expect(textarea.selectionStart).toBe(12);
    expect(textarea.selectionEnd).toBe(12);
  });

  it('places the caret inside inline formatting markers when there is no selection', () => {
    const textarea = createTextarea('Text', 4);

    expect(applySourceFormatting(textarea, 'bold')).toBe(true);
    expect(textarea.value).toBe('Text****');
    expect(textarea.selectionStart).toBe(6);
    expect(textarea.selectionEnd).toBe(6);
  });

  it.each([
    ['bold', '**hello**'],
    ['italic', '*hello*'],
    ['underline', '++hello++'],
    ['strike', '~~hello~~'],
    ['code', '`hello`'],
    ['highlight', '==hello=='],
  ] as const)('keeps %s markers around text typed at an empty selection', (action, expected) => {
    const textarea = createTextarea('Text', 4);

    expect(applySourceFormatting(textarea, action)).toBe(true);
    textarea.setRangeText('hello', textarea.selectionStart, textarea.selectionEnd, 'end');

    expect(textarea.value).toBe(`Text${expected}`);
  });

  it.each([
    ['bold', '**Text**', 2, 6, 'Text'],
    ['italic', '*Text*', 1, 5, 'Text'],
    ['code', '`Text`', 1, 5, 'Text'],
  ] as const)('toggles %s formatting off around the selected text', (action, value, start, end, expected) => {
    const textarea = createTextarea(value, start, end);

    expect(applySourceFormatting(textarea, action)).toBe(true);
    expect(textarea.value).toBe(expected);
    expect(textarea.selectionStart).toBe(0);
    expect(textarea.selectionEnd).toBe(expected.length);
  });

  it('reports inline source formatting around a caret', () => {
    const textarea = createTextarea('**Bold** *italic* `code`', 4);
    expect(getSourceActiveMarks(textarea)).toEqual(new Set(['strong']));

    textarea.setSelectionRange(12, 12);
    expect(getSourceActiveMarks(textarea)).toEqual(new Set(['emphasis']));

    textarea.setSelectionRange(22, 22);
    expect(getSourceActiveMarks(textarea)).toEqual(new Set(['inlineCode']));
  });

  it('reports the extended inline source formats around a caret', () => {
    const textarea = createTextarea('++under++ ~~strike~~ ==highlight==', 4);
    expect(getSourceActiveMarks(textarea)).toEqual(new Set(['underline']));

    textarea.setSelectionRange(14, 14);
    expect(getSourceActiveMarks(textarea)).toEqual(new Set(['strike_through']));

    textarea.setSelectionRange(25, 25);
    expect(getSourceActiveMarks(textarea)).toEqual(new Set(['highlight']));
  });

  it.each([
    ['italic', 'Text', 0, 4, '*Text*'],
    ['code', 'Text', 0, 4, '`Text`'],
    ['quote', 'First\nSecond', 0, 12, '> First\n> Second'],
    ['ordered-list', 'First\nSecond', 0, 12, '1. First\n2. Second'],
    ['bullet-list', 'First\nSecond', 0, 12, '- First\n- Second'],
    ['task-list', 'First\nSecond', 0, 12, '- [ ] First\n- [ ] Second'],
  ])('applies %s formatting to source text', (action, value, start, end, expected) => {
    const textarea = createTextarea(value, start, end);

    expect(applySourceFormatting(textarea, action)).toBe(true);
    expect(textarea.value).toBe(expected);
  });

  it('inserts a picked image only into the still-active note', async () => {
    const textarea = createTextarea('Before ', 7);
    mocks.pickSourceContextMenuImage.mockResolvedValue({
      markdown: '![Image](./assets/image.png)',
      notePath: '/notes/current.md',
    });

    await expect(insertSourceAction(textarea, 'image')).resolves.toBe(true);
    expect(textarea.value).toBe('Before ![Image](./assets/image.png)');
  });

  it('rejects a picked image that belongs to another note', async () => {
    const textarea = createTextarea('Before', 6);
    mocks.pickSourceContextMenuImage.mockResolvedValue({
      markdown: '![Image](./assets/image.png)',
      notePath: '/notes/other.md',
    });

    await expect(insertSourceAction(textarea, 'image')).resolves.toBe(false);
    expect(textarea.value).toBe('Before');
  });

  it('toggles an existing line format back off', () => {
    const textarea = createTextarea('> First\n> Second', 0, 16);

    expect(applySourceFormatting(textarea, 'quote')).toBe(true);
    expect(textarea.value).toBe('First\nSecond');
  });

  it('inserts a real reference-link template without a sample URL', () => {
    const textarea = createTextarea('', 0);

    expect(insertSourceAction(textarea, 'link-reference')).toBe(true);
    expect(textarea.value).toBe('[link][reference]\n\n[reference]: ');
  });

  it.each([
    ['callout', '> 💡 '],
    ['emoji', '😀'],
    ['footnote', '[^1]'],
    ['footnote-definition', '[^1]: '],
    ['divider', '\n---\n'],
    ['table', '| A | B |\n| --- | --- |\n|   |   |'],
    ['code', '```\n\n```'],
    ['formula', '$$\n\n$$'],
    ['inline-math', '$$'],
    ['toc', '[toc]'],
    ['mermaid', '```mermaid\n\n```'],
    ['html-block', '<div>\n\n</div>'],
    ['abbreviation', '*[ABBR]: Full phrase'],
    ['video', '![video]()'],
    ['frontmatter', '---\ntitle: \n---\n'],
  ])('inserts the %s source snippet', (action, expected) => {
    const textarea = createTextarea('', 0);

    expect(insertSourceAction(textarea, action)).toBe(true);
    expect(textarea.value).toBe(expected);
  });

  it('increments footnote definitions from existing references and definitions', () => {
    const textarea = createTextarea('First[^1]\n\n[^2]: Existing\n', 27);

    expect(insertSourceAction(textarea, 'footnote-definition')).toBe(true);
    expect(textarea.value).toContain('[^3]: ');
  });

  it('increments footnote references from existing ids', () => {
    const textarea = createTextarea('First[^1]\n\n[^2]: Existing\n', 27);

    expect(insertSourceAction(textarea, 'footnote')).toBe(true);
    expect(textarea.value).toContain('[^3]');
  });

  it.each([
    ['inline-math', 1],
    ['code', '```\n'.length],
    ['formula', '$$\n'.length],
    ['mermaid', '```mermaid\n'.length],
    ['html-block', '<div>\n'.length],
    ['frontmatter', '---\ntitle: '.length],
    ['video', '![video]('.length],
  ] as const)('places the caret in the editable part of the %s template', (action, caret) => {
    const textarea = createTextarea('', 0);

    expect(insertSourceAction(textarea, action)).toBe(true);
    expect(textarea.selectionStart).toBe(caret);
    expect(textarea.selectionEnd).toBe(caret);
  });

  it('selects the abbreviation placeholder', () => {
    const textarea = createTextarea('', 0);

    expect(insertSourceAction(textarea, 'abbreviation')).toBe(true);
    expect(textarea.value.slice(textarea.selectionStart, textarea.selectionEnd)).toBe('ABBR');
  });

  it('converts all selected lines to the requested heading level', () => {
    const textarea = createTextarea('# First\nSecond', 0, 14);

    expect(applySourceBlockType(textarea, 'heading3')).toBe(true);
    expect(textarea.value).toBe('### First\n### Second');
  });

  it('converts headings back to paragraphs', () => {
    const textarea = createTextarea('### First\n## Second', 0, 19);

    expect(applySourceBlockType(textarea, 'paragraph')).toBe(true);
    expect(textarea.value).toBe('First\nSecond');
  });

  it('reports the active source block type for context-menu state', () => {
    const textarea = createTextarea('## Heading\n- [ ] Task', 3);
    expect(getSourceBlockType(textarea)).toBe('heading2');

    textarea.setSelectionRange(0, textarea.value.length);
    expect(getSourceBlockType(textarea)).toBeNull();
  });

  it.each([
    ['paragraph-above', 8, 6],
    ['paragraph-below', 2, 6],
  ])('inserts a real empty paragraph for %s', (action, caret, expectedCaret) => {
    const textarea = createTextarea('Alpha\nBeta', caret);

    expect(insertSourceAction(textarea, action)).toBe(true);
    expect(textarea.value).toBe('Alpha\n\nBeta');
    expect(textarea.selectionStart).toBe(expectedCaret);
    expect(textarea.selectionEnd).toBe(expectedCaret);
  });

  it('copies source selections as visible plain text', async () => {
    const textarea = createTextarea('**Bold** and [link](https://example.test)', 0, 39);
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: vi.fn(() => true),
    });

    await expect(copySourceSelection(textarea, 'plain')).resolves.toBe(true);
  });
});
