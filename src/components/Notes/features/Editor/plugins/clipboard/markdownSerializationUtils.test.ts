import { describe, expect, it } from 'vitest';
import {
  joinSerializedBlocks,
  normalizeSerializedMarkdownBlock,
  normalizeSerializedMarkdownSelection,
  stripTrailingNewlines,
} from './markdownSerializationUtils';

describe('stripTrailingNewlines', () => {
  it('removes trailing newlines only', () => {
    expect(stripTrailingNewlines('abc\n\n')).toBe('abc');
    expect(stripTrailingNewlines('abc\nxyz')).toBe('abc\nxyz');
  });
});

describe('normalizeSerializedMarkdownBlock', () => {
  it('converts standalone br tags to empty block text', () => {
    expect(normalizeSerializedMarkdownBlock('<br />')).toBe('');
    expect(normalizeSerializedMarkdownBlock('<br/>\n')).toBe('');
  });

  it('keeps normal markdown content', () => {
    expect(normalizeSerializedMarkdownBlock('# Title\n')).toBe('# Title');
  });
});

describe('normalizeSerializedMarkdownSelection', () => {
  it('converts standalone br tags to single newline', () => {
    expect(normalizeSerializedMarkdownSelection('<br />')).toBe('\n');
  });

  it('keeps normal markdown content', () => {
    expect(normalizeSerializedMarkdownSelection('- [ ] task\n')).toBe('- [ ] task');
  });
});

describe('joinSerializedBlocks', () => {
  it('returns newline for single empty copied block', () => {
    expect(joinSerializedBlocks([''])).toBe('\n');
  });

  it('preserves empty gaps between non-empty blocks', () => {
    expect(joinSerializedBlocks(['A', '', 'B'])).toBe('A\n\nB');
  });
});
