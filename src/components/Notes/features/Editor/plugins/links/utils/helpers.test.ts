import { describe, expect, it } from 'vitest';
import * as ProseModel from '@milkdown/kit/prose/model';
import * as ProseState from '@milkdown/kit/prose/state';
import {
  MAX_LINK_MARK_RANGE_SCAN_CHARS,
  resolveLinkMarkRangeAtPos,
} from './helpers';

const SchemaCtor = (ProseModel as any).Schema;
const EditorStateCtor = (ProseState as any).EditorState;
const schema = new SchemaCtor({
  nodes: {
    doc: { content: 'block+' },
    paragraph: {
      group: 'block',
      content: 'inline*',
      toDOM: () => ['p', 0],
      parseDOM: [{ tag: 'p' }],
    },
    text: { group: 'inline' },
  },
  marks: {
    link: {
      attrs: { href: {} },
      inclusive: false,
      toDOM: (mark: any) => ['a', { href: mark.attrs.href }, 0],
      parseDOM: [{ tag: 'a[href]', getAttrs: (dom: HTMLElement) => ({ href: dom.getAttribute('href') }) }],
    },
  },
});

function createStateFromInlineNodes(nodes: any[]) {
  return EditorStateCtor.create({
    schema,
    doc: schema.nodes.doc.create(null, schema.nodes.paragraph.create(null, nodes)),
  });
}

function createLinkedState({
  before = '',
  linkText,
  after = '',
  href = 'https://example.com',
}: {
  before?: string;
  linkText: string;
  after?: string;
  href?: string;
}) {
  const linkMark = schema.marks.link.create({ href });
  const nodes = [
    before ? schema.text(before) : null,
    schema.text(linkText, [linkMark]),
    after ? schema.text(after) : null,
  ].filter(Boolean);
  const state = createStateFromInlineNodes(nodes);
  const linkStart = 1 + before.length;
  const linkEnd = linkStart + linkText.length;

  return { state, linkStart, linkEnd };
}

describe('link helpers', () => {
  it('resolves a link range without including the following plain character', () => {
    const { state, linkStart, linkEnd } = createLinkedState({
      before: 'before ',
      linkText: 'Docs',
      after: '! after',
    });

    expect(resolveLinkMarkRangeAtPos(state, linkStart)).toMatchObject({
      start: linkStart,
      end: linkEnd,
    });
    expect(resolveLinkMarkRangeAtPos(state, linkEnd)).toMatchObject({
      start: linkStart,
      end: linkEnd,
    });
  });

  it('does not merge adjacent links with different hrefs', () => {
    const firstMark = schema.marks.link.create({ href: 'https://example.com/one' });
    const secondMark = schema.marks.link.create({ href: 'https://example.com/two' });
    const state = createStateFromInlineNodes([
      schema.text('One', [firstMark]),
      schema.text('Two', [secondMark]),
      schema.text('!'),
    ]);

    expect(resolveLinkMarkRangeAtPos(state, 1)).toMatchObject({
      start: 1,
      end: 4,
    });
    expect(resolveLinkMarkRangeAtPos(state, 4)).toMatchObject({
      start: 4,
      end: 7,
    });
  });

  it('returns null for link mark ranges that exceed the scan budget', () => {
    const { state, linkStart } = createLinkedState({
      linkText: 'x'.repeat(MAX_LINK_MARK_RANGE_SCAN_CHARS + 1),
    });

    expect(resolveLinkMarkRangeAtPos(state, linkStart)).toBeNull();
  });
});
