import { describe, expect, it } from 'vitest';
import * as ProseModel from '@milkdown/kit/prose/model';
import { docChangeMayAffectRawMarkdownLink } from './markdownLinkPlugin';

const SchemaCtor = (ProseModel as any).Schema;
const schema = new SchemaCtor({
  nodes: {
    doc: { content: 'block+' },
    paragraph: {
      group: 'block',
      content: 'text*',
      toDOM: () => ['p', 0],
      parseDOM: [{ tag: 'p' }],
    },
    text: { group: 'inline' },
  },
});

function docFromParagraphs(paragraphs: string[]) {
  return schema.nodes.doc.create(null, paragraphs.map((text) => (
    schema.nodes.paragraph.create(null, text ? schema.text(text) : undefined)
  )));
}

describe('docChangeMayAffectRawMarkdownLink', () => {
  it('skips unrelated paragraph edits when a raw markdown link exists elsewhere', () => {
    const oldDoc = docFromParagraphs([
      '[Docs](https://example.com)',
      'before',
    ]);
    const nextDoc = docFromParagraphs([
      '[Docs](https://example.com)',
      'after',
    ]);

    expect(docChangeMayAffectRawMarkdownLink(oldDoc, nextDoc)).toBe(false);
  });

  it('detects edits in the paragraph that contains a raw markdown link', () => {
    const oldDoc = docFromParagraphs([
      '[Docs](https://example.com) trailing',
    ]);
    const nextDoc = docFromParagraphs([
      '[Docs](https://example.com) changed',
    ]);

    expect(docChangeMayAffectRawMarkdownLink(oldDoc, nextDoc)).toBe(true);
  });

  it('detects deleting a raw markdown link', () => {
    const oldDoc = docFromParagraphs([
      '[Docs](https://example.com)',
    ]);
    const nextDoc = docFromParagraphs([
      'Docs',
    ]);

    expect(docChangeMayAffectRawMarkdownLink(oldDoc, nextDoc)).toBe(true);
  });
});
