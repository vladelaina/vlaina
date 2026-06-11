import { describe, expect, it } from 'vitest';
import * as ProseModel from '@milkdown/kit/prose/model';
import {
  docChangeMayAffectRawMarkdownLink,
  rangeTouchesRawMarkdownLink,
} from './markdownLinkPlugin';

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

  it('uses document range scans when checking changed markdown link ranges', () => {
    let rangeScanned = 0;
    const doc = {
      content: { size: 100 },
      child() {
        throw new Error('full document prefix scan should not be used');
      },
      childCount: 2,
      nodesBetween(_from: number, _to: number, callback: (node: any, pos: number) => boolean | void) {
        rangeScanned += 1;
        callback({
          isText: true,
          text: 'plain text',
          type: { name: 'text' },
        }, 0);
      },
      type: { name: 'doc' },
    };

    expect(rangeTouchesRawMarkdownLink(doc as any, 90, 91, false)).toBe(false);
    expect(rangeScanned).toBe(1);
  });
});
