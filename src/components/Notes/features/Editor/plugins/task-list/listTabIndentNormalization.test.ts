import { describe, expect, it } from 'vitest';
import { Schema } from '@milkdown/kit/prose/model';
import { docChangeMayAffectOrderedListNormalization } from './listTabIndentPlugin';

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: {
      group: 'block',
      content: 'text*',
      toDOM: () => ['p', 0],
      parseDOM: [{ tag: 'p' }],
    },
    ordered_list: {
      group: 'block',
      content: 'list_item+',
      attrs: { order: { default: 1 } },
      toDOM: () => ['ol', 0],
      parseDOM: [{ tag: 'ol' }],
    },
    list_item: {
      content: 'paragraph block*',
      attrs: {
        label: { default: null },
        listType: { default: null },
      },
      toDOM: () => ['li', 0],
      parseDOM: [{ tag: 'li' }],
    },
    text: { group: 'inline' },
  },
});

function paragraph(text?: string) {
  return schema.nodes.paragraph.create(null, text ? schema.text(text) : undefined);
}

function orderedList(text: string) {
  return schema.nodes.ordered_list.create(null, [
    schema.nodes.list_item.create({ label: '1.', listType: 'ordered' }, [
      paragraph(text),
    ]),
  ]);
}

describe('docChangeMayAffectOrderedListNormalization', () => {
  it('skips unrelated paragraph text edits', () => {
    const oldDoc = schema.nodes.doc.create(null, [
      orderedList('one'),
      paragraph('before'),
    ]);
    const nextDoc = schema.nodes.doc.create(null, [
      orderedList('one'),
      paragraph('after'),
    ]);

    expect(docChangeMayAffectOrderedListNormalization(oldDoc, nextDoc)).toBe(false);
  });

  it('checks separator edits between ordered lists', () => {
    const oldDoc = schema.nodes.doc.create(null, [
      orderedList('one'),
      paragraph(),
      orderedList('two'),
    ]);
    const nextDoc = schema.nodes.doc.create(null, [
      orderedList('one'),
      orderedList('two'),
    ]);

    expect(docChangeMayAffectOrderedListNormalization(oldDoc, nextDoc)).toBe(true);
  });
});
