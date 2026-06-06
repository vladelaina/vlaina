import { describe, expect, it, vi } from 'vitest';
import { Schema } from '@milkdown/kit/prose/model';
import {
  docChangeMayAffectThemeCompatibilityDecorations,
  listContainsTaskItems,
} from './themeCompatibilityDecorations';

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: {
      group: 'block',
      content: 'text*',
      toDOM: () => ['p', 0],
      parseDOM: [{ tag: 'p' }],
    },
    code_block: {
      group: 'block',
      content: 'text*',
      code: true,
      isolating: true,
      marks: '',
      attrs: {
        language: { default: null },
      },
      toDOM: () => ['pre', ['code', 0]],
      parseDOM: [{ tag: 'pre', preserveWhitespace: 'full' }],
    },
    frontmatter: {
      group: 'block',
      content: 'text*',
      code: true,
      isolating: true,
      marks: '',
      toDOM: () => ['div', { 'data-type': 'frontmatter' }, 0],
      parseDOM: [{ tag: 'div[data-type="frontmatter"]', preserveWhitespace: 'full' }],
    },
    text: { group: 'inline' },
  },
});

function textNode(text: string) {
  return text ? schema.text(text) : undefined;
}

function paragraph(text: string) {
  return schema.nodes.paragraph.create(null, textNode(text));
}

function codeBlock(text: string) {
  return schema.nodes.code_block.create(null, textNode(text));
}

function frontmatter(text: string) {
  return schema.nodes.frontmatter.create(null, textNode(text));
}

describe('docChangeMayAffectThemeCompatibilityDecorations', () => {
  it('skips code block text edits', () => {
    const oldDoc = schema.nodes.doc.create(null, [
      paragraph('Before'),
      codeBlock('const value = 1;'),
      paragraph('After'),
    ]);
    const nextDoc = schema.nodes.doc.create(null, [
      paragraph('Before'),
      codeBlock('const value = 2;'),
      paragraph('After'),
    ]);

    expect(docChangeMayAffectThemeCompatibilityDecorations(oldDoc, nextDoc)).toBe(false);
  });

  it('skips frontmatter text edits', () => {
    const oldDoc = schema.nodes.doc.create(null, [
      frontmatter('title: Old'),
      paragraph('Body'),
    ]);
    const nextDoc = schema.nodes.doc.create(null, [
      frontmatter('title: New'),
      paragraph('Body'),
    ]);

    expect(docChangeMayAffectThemeCompatibilityDecorations(oldDoc, nextDoc)).toBe(false);
  });

  it('rebuilds for ordinary paragraph edits', () => {
    const oldDoc = schema.nodes.doc.create(null, [
      paragraph('Caption'),
      codeBlock('const value = 1;'),
    ]);
    const nextDoc = schema.nodes.doc.create(null, [
      paragraph('Changed caption'),
      codeBlock('const value = 1;'),
    ]);

    expect(docChangeMayAffectThemeCompatibilityDecorations(oldDoc, nextDoc)).toBe(true);
  });

  it('rebuilds when safe block markup changes', () => {
    const oldDoc = schema.nodes.doc.create(null, [
      codeBlock('const value = 1;'),
    ]);
    const nextDoc = schema.nodes.doc.create(null, [
      schema.nodes.code_block.create({ language: 'ts' }, textNode('const value = 1;')),
    ]);

    expect(docChangeMayAffectThemeCompatibilityDecorations(oldDoc, nextDoc)).toBe(true);
  });
});

describe('listContainsTaskItems', () => {
  it('reuses cached nested list results during one decoration pass', () => {
    const taskItem = {
      type: { name: 'list_item' },
      attrs: { checked: true },
      forEach: vi.fn(),
    };
    const nestedList = {
      type: { name: 'bullet_list' },
      forEach: vi.fn((visit: (node: unknown) => void) => visit(taskItem)),
    };
    const outerList = {
      type: { name: 'bullet_list' },
      forEach: vi.fn((visit: (node: unknown) => void) => visit(nestedList)),
    };
    const cache = new WeakMap<object, boolean>();

    expect(listContainsTaskItems(outerList, cache)).toBe(true);
    expect(listContainsTaskItems(nestedList, cache)).toBe(true);
    expect(nestedList.forEach).toHaveBeenCalledTimes(1);
  });
});
