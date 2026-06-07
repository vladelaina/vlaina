import { describe, expect, it } from 'vitest';
import * as ProseModel from '@milkdown/kit/prose/model';
import {
  MAX_ORDERED_LIST_LABEL_UPDATES,
  collectOrderedListLabelUpdates,
  docChangeMayAffectOrderedListNormalization,
} from './listTabIndentPlugin';

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

function orderedListWithLabels(labels: string[]) {
  return schema.nodes.ordered_list.create(null, labels.map((label, index) => (
    schema.nodes.list_item.create({ label, listType: 'ordered' }, [
      paragraph(`item ${index + 1}`),
    ])
  )));
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

describe('collectOrderedListLabelUpdates', () => {
  it('collects stale ordered list labels without touching already valid labels', () => {
    const list = orderedListWithLabels(['1.', '99.', '3.']);
    const doc = schema.nodes.doc.create(null, [list]);

    const updates = collectOrderedListLabelUpdates(doc);

    expect(updates).toHaveLength(1);
    expect(updates[0].pos).toBe(1 + list.child(0).nodeSize);
    expect(updates[0].attrs).toMatchObject({
      label: '2.',
      listType: 'ordered',
    });
  });

  it('caps stale ordered list label updates collected in one pass', () => {
    const doc = schema.nodes.doc.create(null, [
      orderedListWithLabels(Array.from(
        { length: MAX_ORDERED_LIST_LABEL_UPDATES + 2 },
        () => '0.'
      )),
    ]);

    expect(collectOrderedListLabelUpdates(doc)).toHaveLength(MAX_ORDERED_LIST_LABEL_UPDATES);
  });
});
