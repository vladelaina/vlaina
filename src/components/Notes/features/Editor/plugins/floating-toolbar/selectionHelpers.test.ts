import { describe, expect, it } from 'vitest';
import {
  getActiveMarks,
  getBgColor,
  getCurrentAlignment,
  getCurrentBlockType,
  getFormattableTextRanges,
  getLinkUrl,
  getTextColor,
} from './selectionHelpers';

type MarkSpec = {
  name: string;
  attrs?: Record<string, unknown>;
};

type MockNodeSpec = {
  pos: number;
  text?: string;
  marks?: MarkSpec[];
  isText?: boolean;
};

type ResolvedNodeSpec = {
  type: string;
  attrs?: Record<string, unknown>;
  before?: number;
};

function createTextNode(text: string, marks: MarkSpec[] = []): MockNodeSpec {
  return {
    pos: 0,
    text,
    marks,
    isText: true,
  };
}

function createView(
  nodes: MockNodeSpec[],
  selection: { from: number; to: number; empty?: boolean },
  resolvedByPos: Record<number, ResolvedNodeSpec[]> = {}
): any {
  const resolve = (pos: number) => {
    const path = resolvedByPos[pos];
    if (!path) {
      throw new Error(`Missing resolved path for pos ${pos}`);
    }

    return {
      depth: path.length - 1,
      node: (depth: number) => ({
        type: { name: path[depth].type },
        attrs: path[depth].attrs ?? {},
      }),
      before: (depth: number) => path[depth].before ?? depth,
      parent: {
        type: { name: path[path.length - 1].type },
        attrs: path[path.length - 1].attrs ?? {},
      },
    };
  };

  return {
    state: {
      selection: {
        from: selection.from,
        to: selection.to,
        empty: selection.empty ?? selection.from === selection.to,
        $from: resolve(selection.from),
      },
      doc: {
        nodesBetween: (_from: number, _to: number, callback: (node: unknown, pos: number, parent?: unknown) => void) => {
          nodes.forEach((node) => {
            const path = resolvedByPos[node.pos];
            const parent = path
              ? {
                  type: { name: path[path.length - 1].type },
                  attrs: path[path.length - 1].attrs ?? {},
                }
              : undefined;
            callback(
              {
                isText: node.isText ?? Boolean(node.text),
                text: node.text ?? null,
                nodeSize: node.text?.length ?? 1,
                marks: (node.marks ?? []).map((mark) => ({
                  type: { name: mark.name },
                  attrs: mark.attrs ?? {},
                })),
              },
              node.pos,
              parent
            );
          });
        },
        resolve,
      },
    },
  };
}

describe('selection helpers', () => {
  it('keeps only marks shared by all selected text segments', () => {
    const view = createView(
      [
        { ...createTextNode('ab', [{ name: 'strong' }]), pos: 0 },
        { ...createTextNode('cd', [{ name: 'strong' }, { name: 'underline' }]), pos: 2 },
      ],
      { from: 0, to: 4 },
      {
        0: [{ type: 'doc' }, { type: 'paragraph', before: 1 }],
        2: [{ type: 'doc' }, { type: 'paragraph', before: 1 }],
      }
    );

    expect(getActiveMarks(view)).toEqual(new Set(['strong']));
  });

  it('clears a mark when the selection mixes formatted and plain text', () => {
    const view = createView(
      [
        { ...createTextNode('ab', [{ name: 'strong' }]), pos: 0 },
        { ...createTextNode('cd'), pos: 2 },
      ],
      { from: 0, to: 4 },
      {
        0: [{ type: 'doc' }, { type: 'paragraph', before: 1 }],
        2: [{ type: 'doc' }, { type: 'paragraph', before: 1 }],
      }
    );

    expect(getActiveMarks(view)).toEqual(new Set());
  });

  it('ignores non-text nodes when computing active marks', () => {
    const view = createView(
      [
        { pos: 0, isText: false },
        { ...createTextNode('ab', [{ name: 'highlight' }]), pos: 1 },
      ],
      { from: 0, to: 3 },
      {
        0: [{ type: 'doc' }, { type: 'paragraph', before: 1 }],
        1: [{ type: 'doc' }, { type: 'paragraph', before: 1 }],
      }
    );

    expect(getActiveMarks(view)).toEqual(new Set(['highlight']));
  });

  it('returns a link url only when the whole selection shares the same link', () => {
    const linkedView = createView(
      [
        { ...createTextNode('ab', [{ name: 'link', attrs: { href: 'https://example.com' } }]), pos: 0 },
        { ...createTextNode('cd', [{ name: 'link', attrs: { href: 'https://example.com' } }]), pos: 2 },
      ],
      { from: 0, to: 4 },
      {
        0: [{ type: 'doc' }, { type: 'paragraph', before: 1 }],
        2: [{ type: 'doc' }, { type: 'paragraph', before: 1 }],
      }
    );
    const mixedView = createView(
      [
        { ...createTextNode('ab', [{ name: 'link', attrs: { href: 'https://example.com' } }]), pos: 0 },
        { ...createTextNode('cd'), pos: 2 },
      ],
      { from: 0, to: 4 },
      {
        0: [{ type: 'doc' }, { type: 'paragraph', before: 1 }],
        2: [{ type: 'doc' }, { type: 'paragraph', before: 1 }],
      }
    );

    expect(getLinkUrl(linkedView)).toBe('https://example.com');
    expect(getLinkUrl(mixedView)).toBeNull();
  });

  it('returns text and background colors only when the whole selection is consistent', () => {
    const consistentView = createView(
      [
        {
          ...createTextNode('ab', [
            { name: 'textColor', attrs: { color: '#111111' } },
            { name: 'bgColor', attrs: { color: '#ffeeaa' } },
          ]),
          pos: 0,
        },
        {
          ...createTextNode('cd', [
            { name: 'textColor', attrs: { color: '#111111' } },
            { name: 'bgColor', attrs: { color: '#ffeeaa' } },
          ]),
          pos: 2,
        },
      ],
      { from: 0, to: 4 },
      {
        0: [{ type: 'doc' }, { type: 'paragraph', before: 1 }],
        2: [{ type: 'doc' }, { type: 'paragraph', before: 1 }],
      }
    );
    const inconsistentView = createView(
      [
        { ...createTextNode('ab', [{ name: 'textColor', attrs: { color: '#111111' } }]), pos: 0 },
        { ...createTextNode('cd', [{ name: 'textColor', attrs: { color: '#222222' } }]), pos: 2 },
      ],
      { from: 0, to: 4 },
      {
        0: [{ type: 'doc' }, { type: 'paragraph', before: 1 }],
        2: [{ type: 'doc' }, { type: 'paragraph', before: 1 }],
      }
    );

    expect(getTextColor(consistentView)).toBe('#111111');
    expect(getBgColor(consistentView)).toBe('#ffeeaa');
    expect(getTextColor(inconsistentView)).toBeNull();
  });

  it('returns null for mixed block types and identifies blockquotes correctly', () => {
    const mixedView = createView(
      [
        { ...createTextNode('ab'), pos: 0 },
        { ...createTextNode('cd'), pos: 2 },
      ],
      { from: 0, to: 4 },
      {
        0: [{ type: 'doc' }, { type: 'paragraph', before: 1 }],
        2: [{ type: 'doc' }, { type: 'heading', attrs: { level: 2 }, before: 10 }],
      }
    );
    const blockquoteView = createView(
      [{ ...createTextNode('ab'), pos: 0 }],
      { from: 0, to: 2 },
      {
        0: [
          { type: 'doc' },
          { type: 'blockquote', before: 5 },
          { type: 'paragraph', before: 6 },
        ],
      }
    );

    expect(getCurrentBlockType(mixedView)).toBeNull();
    expect(getCurrentBlockType(blockquoteView)).toBe('blockquote');
  });

  it('returns null for mixed alignments and preserves a shared alignment across mixed supported blocks', () => {
    const mixedAlignmentView = createView(
      [
        { ...createTextNode('ab'), pos: 0 },
        { ...createTextNode('cd'), pos: 2 },
      ],
      { from: 0, to: 4 },
      {
        0: [{ type: 'doc' }, { type: 'paragraph', attrs: { align: 'left' }, before: 1 }],
        2: [{ type: 'doc' }, { type: 'heading', attrs: { level: 2, align: 'right' }, before: 10 }],
      }
    );
    const codeAndCenteredParagraphView = createView(
      [
        { ...createTextNode('ab'), pos: 0 },
        { ...createTextNode('cd'), pos: 2 },
      ],
      { from: 0, to: 4 },
      {
        0: [{ type: 'doc' }, { type: 'code_block', before: 1 }],
        2: [{ type: 'doc' }, { type: 'paragraph', attrs: { align: 'center' }, before: 10 }],
      }
    );

    expect(getCurrentAlignment(mixedAlignmentView)).toBeNull();
    expect(getCurrentAlignment(codeAndCenteredParagraphView)).toBe('center');
  });

  it('ignores restricted block text when computing formattable ranges and mark state', () => {
    const view = createView(
      [
        { ...createTextNode('ab', [{ name: 'strong' }]), pos: 0 },
        { ...createTextNode('cd'), pos: 2 },
        { ...createTextNode('ef', [{ name: 'strong' }]), pos: 4 },
      ],
      { from: 0, to: 6 },
      {
        0: [{ type: 'doc' }, { type: 'paragraph', before: 1 }],
        2: [{ type: 'doc' }, { type: 'code_block', before: 3 }],
        4: [{ type: 'doc' }, { type: 'paragraph', before: 7 }],
      }
    );

    expect(getFormattableTextRanges(view)).toEqual([
      { from: 0, to: 2 },
      { from: 4, to: 6 },
    ]);
    expect(getActiveMarks(view)).toEqual(new Set(['strong']));
  });
});
