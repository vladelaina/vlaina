import { describe, expect, it } from 'vitest';
import {
  MAX_DELIMITED_MARKDOWN_TEXT_CHARS,
  findDelimitedTextMatches,
  isUnescapedMarkdownTextRange,
} from './delimitedMarkdown';

describe('findDelimitedTextMatches', () => {
  it('ignores delimiters escaped in the original markdown source', () => {
    const markdown = '\\==literal== ==mark==';
    const value = '==literal== ==mark==';

    expect(findDelimitedTextMatches(value, /==([^=]+)==/g, {
      markdown,
      position: { start: { offset: 0 }, end: { offset: markdown.length } },
      openDelimiterLength: 2,
    })).toEqual([
      {
        start: 12,
        end: 20,
        content: 'mark',
      },
    ]);
  });

  it('keeps escaped single-character delimiters literal', () => {
    const markdown = 'X\\^2^ H\\~2~O';
    const value = 'X^2^ H~2~O';

    expect(findDelimitedTextMatches(value, /(?<!\^)\^([^^\s](?:[^^]*?[^^\s])?)\^(?!\^)/g, {
      markdown,
      position: { start: { offset: 0 }, end: { offset: markdown.length } },
      openDelimiterLength: 1,
    })).toEqual([]);
    expect(findDelimitedTextMatches(value, /(?<!~)~([^~\s](?:[^~]*?[^~\s])?)~(?!~)/g, {
      markdown,
      position: { start: { offset: 0 }, end: { offset: markdown.length } },
      openDelimiterLength: 1,
    })).toEqual([]);
  });

  it('matches delimiters when source positions are unavailable', () => {
    expect(findDelimitedTextMatches('==mark==', /==([^=]+)==/g, {
      openDelimiterLength: 2,
    })).toEqual([
      {
        start: 0,
        end: 8,
        content: 'mark',
      },
    ]);
  });

  it('detects escaped block-level trigger characters from the original markdown source', () => {
    expect(isUnescapedMarkdownTextRange('[TOC]', 0, 1, {
      markdown: '\\[TOC]',
      position: { start: { offset: 0 }, end: { offset: 6 } },
    })).toBe(false);
    expect(isUnescapedMarkdownTextRange(': Definition', 0, 1, {
      markdown: '\\: Definition',
      position: { start: { offset: 0 }, end: { offset: 13 } },
    })).toBe(false);
    expect(isUnescapedMarkdownTextRange('*[HTML]: Text', 0, 1, {
      markdown: '\\*[HTML]: Text',
      position: { start: { offset: 0 }, end: { offset: 14 } },
    })).toBe(false);
  });

  it('skips overlong text nodes before delimiter scanning', () => {
    const value = `${'a'.repeat(MAX_DELIMITED_MARKDOWN_TEXT_CHARS + 1)} ==mark==`;

    expect(findDelimitedTextMatches(value, /==([^=]+)==/g, {
      openDelimiterLength: 2,
    })).toEqual([]);
    expect(isUnescapedMarkdownTextRange(value, value.length - 1, 1)).toBe(false);
  });
});
