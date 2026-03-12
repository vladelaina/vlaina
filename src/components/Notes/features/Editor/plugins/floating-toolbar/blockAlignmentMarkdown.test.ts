import { describe, expect, it } from 'vitest';
import {
  extractTextAlignmentComment,
  getTextAlignmentComment,
  readMarkdownNodeAlignment,
} from './blockAlignmentMarkdown';

describe('blockAlignmentMarkdown', () => {
  it('extracts supported alignment comments', () => {
    expect(extractTextAlignmentComment('<!--align:left-->')).toBe('left');
    expect(extractTextAlignmentComment('<!-- align:center -->')).toBe('center');
    expect(extractTextAlignmentComment('<!--align:right-->')).toBe('right');
  });

  it('ignores unrelated html comments', () => {
    expect(extractTextAlignmentComment('<!--note:test-->')).toBeNull();
    expect(extractTextAlignmentComment('<div>test</div>')).toBeNull();
  });

  it('formats alignment comments consistently', () => {
    expect(getTextAlignmentComment('center')).toBe('<!--align:center-->');
  });

  it('defaults unknown node alignment to left', () => {
    expect(readMarkdownNodeAlignment(undefined)).toBe('left');
    expect(readMarkdownNodeAlignment({ align: 'nope' })).toBe('left');
    expect(readMarkdownNodeAlignment({ align: 'right' })).toBe('right');
  });
});
