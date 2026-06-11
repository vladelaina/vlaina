import { describe, expect, it } from 'vitest';
import * as ProseModel from '@milkdown/kit/prose/model';
import {
  collectMarkdownLinkAutoCollapseScanRanges,
  collectRawMarkdownLinkMatchesInRange,
  docChangeMayAffectRawMarkdownLink,
  textContainsRawMarkdownLink,
  transactionChangeMayAffectRawMarkdownLink,
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

function changedRange(oldFrom: number, oldTo: number, newFrom: number, newTo: number) {
  return {
    docChanged: true,
    mapping: {
      maps: [{
        forEach: (callback: (oldStart: number, oldEnd: number, newStart: number, newEnd: number) => void) => {
          callback(oldFrom, oldTo, newFrom, newTo);
        },
      }],
    },
  };
}

function findTextEndPosition(doc: any, text: string): number {
  return findTextRange(doc, text).to;
}

function findTextRange(doc: any, text: string): { from: number; to: number } {
  let position = -1;
  doc.descendants((node: any, pos: number) => {
    if (!node.isText || typeof node.text !== 'string') return true;
    const index = node.text.indexOf(text);
    if (index < 0) return true;
    position = pos + index;
    return false;
  });
  if (position < 0) {
    throw new Error(`Unable to find text: ${text}`);
  }
  return {
    from: position,
    to: position + text.length,
  };
}

function selection(from: number, to = from) {
  return {
    from,
    to,
    eq(other: unknown) {
      return Boolean(other && (other as { from?: unknown; to?: unknown }).from === from && (other as { to?: unknown }).to === to);
    },
  };
}

function rangeOverlaps(range: { from: number; to: number }, target: { from: number; to: number }): boolean {
  return range.from < target.to && range.to > target.from;
}

describe('docChangeMayAffectRawMarkdownLink', () => {
  it('uses a cheap syntax prefilter before treating text as a raw markdown link', () => {
    expect(textContainsRawMarkdownLink('plain text with https://example.com and no markdown syntax')).toBe(false);
    expect(textContainsRawMarkdownLink('[Docs](https://example.com)')).toBe(true);
  });

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

  it('uses transaction ranges to ignore edits outside existing raw markdown links', () => {
    const oldDoc = docFromParagraphs([
      '[Docs](https://example.com)',
      'plain text',
    ]);
    const nextDoc = docFromParagraphs([
      '[Docs](https://example.com)',
      'plain text!',
    ]);
    const oldEditPos = findTextEndPosition(oldDoc, 'plain text');
    const newEditPos = findTextEndPosition(nextDoc, 'plain text!');

    expect(transactionChangeMayAffectRawMarkdownLink(
      oldDoc,
      nextDoc,
      changedRange(oldEditPos, oldEditPos, oldEditPos, newEditPos),
    )).toBe(false);
  });
});

describe('markdown link auto-collapse scan ranges', () => {
  it('collects raw markdown links only inside the requested local range', () => {
    const doc = docFromParagraphs([
      '[First](https://first.example)',
      'plain text',
      '[Second](https://second.example)',
    ]);
    const first = findTextRange(doc, '[First](https://first.example)');
    const plain = findTextRange(doc, 'plain text');
    const second = findTextRange(doc, '[Second](https://second.example)');

    expect(collectRawMarkdownLinkMatchesInRange(doc, plain.from, plain.to)).toEqual([]);
    expect(collectRawMarkdownLinkMatchesInRange(doc, first.from, first.to).map(match => match.linkText)).toEqual(['First']);
    expect(collectRawMarkdownLinkMatchesInRange(doc, second.from, second.to).map(match => match.linkText)).toEqual(['Second']);
  });

  it('keeps selection-only auto-collapse local to the previous and next textblocks', () => {
    const doc = docFromParagraphs([
      '[First](https://first.example)',
      'middle plain text',
      '[Second](https://second.example)',
    ]);
    const first = findTextRange(doc, '[First](https://first.example)');
    const middle = findTextRange(doc, 'middle plain text');
    const second = findTextRange(doc, '[Second](https://second.example)');

    const ranges = collectMarkdownLinkAutoCollapseScanRanges(
      { doc, selection: selection(first.to) },
      { doc, selection: selection(second.to) },
      [],
    );

    expect(ranges.some(range => rangeOverlaps(range, first))).toBe(true);
    expect(ranges.some(range => rangeOverlaps(range, second))).toBe(true);
    expect(ranges.some(range => rangeOverlaps(range, middle))).toBe(false);
  });

  it('does not include the old selection block during unrelated document edits', () => {
    const oldDoc = docFromParagraphs([
      '[First](https://first.example)',
      'plain text',
    ]);
    const nextDoc = docFromParagraphs([
      '[First](https://first.example)',
      'plain text!',
    ]);
    const rawLink = findTextRange(nextDoc, '[First](https://first.example)');
    const oldRawLink = findTextRange(oldDoc, '[First](https://first.example)');
    const oldPlainEnd = findTextEndPosition(oldDoc, 'plain text');
    const newPlainEnd = findTextEndPosition(nextDoc, 'plain text!');

    const ranges = collectMarkdownLinkAutoCollapseScanRanges(
      { doc: oldDoc, selection: selection(oldRawLink.to) },
      { doc: nextDoc, selection: selection(newPlainEnd) },
      [changedRange(oldPlainEnd, oldPlainEnd, oldPlainEnd, newPlainEnd) as any],
    );

    expect(ranges.some(range => rangeOverlaps(range, rawLink))).toBe(false);
  });
});
