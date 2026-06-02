import { describe, expect, it } from 'vitest';
import { remarkNotesInlineExtensions, type MdastNode } from './remarkNotesExtensions';

describe('remarkNotesInlineExtensions', () => {
  it('parses split inline color html with CSS declaration whitespace', () => {
    const tree: MdastNode = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            { type: 'html', value: '<span style="font-weight: 600; color : #123456">' },
            { type: 'text', value: 'red' },
            { type: 'text', value: ' text' },
            { type: 'html', value: '</span>' },
            { type: 'text', value: ' ' },
            { type: 'html', value: '<mark style="border-radius: 2px; background-color : #ecf6ff">' },
            { type: 'text', value: 'marked' },
            { type: 'text', value: ' text' },
            { type: 'html', value: '</mark>' },
          ],
        },
      ],
    };

    remarkNotesInlineExtensions()(tree);

    const paragraph = tree.children?.[0];
    expect(paragraph?.children?.[0]).toMatchObject({
      type: 'textColor',
      color: '#123456',
      children: [
        { type: 'text', value: 'red' },
        { type: 'text', value: ' text' },
      ],
    });
    expect(paragraph?.children?.[2]).toMatchObject({
      type: 'bgColor',
      color: '#ecf6ff',
      children: [
        { type: 'text', value: 'marked' },
        { type: 'text', value: ' text' },
      ],
    });
  });

  it('keeps nested raw html inside inline color containers as html', () => {
    const tree: MdastNode = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            { type: 'html', value: '<span style="color : #123456">' },
            { type: 'text', value: '&lt;em&gt;nested&lt;/em&gt;' },
            { type: 'html', value: '</span>' },
          ],
        },
      ],
    };

    remarkNotesInlineExtensions()(tree);

    const paragraph = tree.children?.[0];
    expect(paragraph?.children).toEqual([
      { type: 'html', value: '<span style="color : #123456">' },
      { type: 'text', value: '&lt;em&gt;nested&lt;/em&gt;' },
      { type: 'html', value: '</span>' },
    ]);
  });
});
