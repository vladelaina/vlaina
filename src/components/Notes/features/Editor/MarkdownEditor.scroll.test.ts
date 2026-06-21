import { beforeEach, describe, expect, it } from 'vitest';
import { canPersistNoteScrollPosition } from './MarkdownEditor';
import { createLargeMarkdownFirstPaintPreviewBlocks } from './LargeMarkdownFirstPaintPreview';
import {
  loadPersistedNoteScrollPosition,
  NOTE_SCROLL_POSITION_STORAGE_KEY,
  persistNoteScrollPosition,
} from './utils/noteScrollPositionStorage';

describe('note scroll position storage', () => {
  beforeEach(() => {
    window.localStorage.removeItem(NOTE_SCROLL_POSITION_STORAGE_KEY);
  });

  it('persists and loads scroll positions by vault and note path', () => {
    persistNoteScrollPosition('/vault-a', 'docs/alpha.md', 320.4);
    persistNoteScrollPosition('/vault-b', 'docs/alpha.md', 48);

    expect(loadPersistedNoteScrollPosition('/vault-a', 'docs/alpha.md')).toBe(320);
    expect(loadPersistedNoteScrollPosition('/vault-b', 'docs/alpha.md')).toBe(48);
    expect(loadPersistedNoteScrollPosition('/vault-a', 'docs/missing.md')).toBeNull();
  });

  it('persists absolute markdown file scroll positions', () => {
    persistNoteScrollPosition('/vault-a', '/external/notes/alpha.md', 128);

    expect(loadPersistedNoteScrollPosition('/vault-a', '/external/notes/alpha.md')).toBe(128);
    expect(loadPersistedNoteScrollPosition('/vault-b', '/external/notes/alpha.md')).toBe(128);
  });

  it('ignores draft note scroll positions', () => {
    persistNoteScrollPosition('/vault-a', 'draft:local', 128);

    expect(loadPersistedNoteScrollPosition('/vault-a', 'draft:local')).toBeNull();
    expect(window.localStorage.getItem(NOTE_SCROLL_POSITION_STORAGE_KEY)).toBeNull();
  });
});

describe('canPersistNoteScrollPosition', () => {
  it('allows visible scroll roots to persist their current scroll position', () => {
    const scrollRoot = document.createElement('div');
    Object.defineProperty(scrollRoot, 'clientHeight', { value: 600, configurable: true });
    Object.defineProperty(scrollRoot, 'scrollHeight', { value: 1800, configurable: true });
    document.body.append(scrollRoot);

    expect(canPersistNoteScrollPosition(scrollRoot)).toBe(true);

    scrollRoot.remove();
  });

  it('rejects hidden scroll roots so they cannot overwrite a saved position with zero', () => {
    const scrollRoot = document.createElement('div');
    Object.defineProperty(scrollRoot, 'clientHeight', { value: 0, configurable: true });
    Object.defineProperty(scrollRoot, 'scrollHeight', { value: 0, configurable: true });
    document.body.append(scrollRoot);

    expect(canPersistNoteScrollPosition(scrollRoot)).toBe(false);

    scrollRoot.remove();
  });
});

describe('createLargeMarkdownFirstPaintPreviewBlocks', () => {
  it('returns no preview for small notes', () => {
    expect(createLargeMarkdownFirstPaintPreviewBlocks('# Title\n\nBody')).toEqual([]);
  });

  it('creates a bounded rendered preview from the beginning of a large markdown note', () => {
    const longParagraph = `Paragraph 0: ${'plain text '.repeat(400)}`;
    const markdown = [
      '# Large Note',
      '',
      '<!--vlaina-markdown-blank-line-->',
      '',
      longParagraph,
      '',
      ...Array.from({ length: 1200 }, (_, index) => `Paragraph ${index + 1}: ${'more text '.repeat(90)}`),
    ].join('\n');

    const blocks = createLargeMarkdownFirstPaintPreviewBlocks(markdown);

    expect(markdown.length).toBeGreaterThan(1_000_000);
    expect(blocks).toHaveLength(6);
    expect(blocks[0]).toEqual({
      key: 'h-0',
      type: 'heading',
      level: 1,
      text: 'Large Note',
    });
    expect(blocks[1]?.type).toBe('paragraph');
    expect(blocks[1]?.text.startsWith('Paragraph 0:')).toBe(true);
    expect(blocks[1]?.text.endsWith('...')).toBe(true);
    expect(blocks.every((block) => block.text.length <= 2403)).toBe(true);
  });

  it('normalizes closing atx heading markers in large note previews', () => {
    const markdown = [
      '# Large Note #',
      '',
      ...Array.from({ length: 1200 }, (_, index) => `Paragraph ${index}: ${'plain text '.repeat(90)}`),
    ].join('\n');

    const blocks = createLargeMarkdownFirstPaintPreviewBlocks(markdown);

    expect(markdown.length).toBeGreaterThan(1_000_000);
    expect(blocks[0]).toEqual({
      key: 'h-0',
      type: 'heading',
      level: 1,
      text: 'Large Note',
    });
  });
});
