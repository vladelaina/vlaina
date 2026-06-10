import { describe, expect, it, vi } from 'vitest';
import * as ProseModel from '@milkdown/kit/prose/model';
import { TextSelection } from '@milkdown/kit/prose/state';
import { setCurrentEditorView } from './editorViewRegistry';
import { focusEditorToFirstLineStart } from './focusEditor';

const ProseSchema = (ProseModel as unknown as {
  Schema: new (spec: Record<string, unknown>) => {
    node: (type: string, attrs?: unknown, content?: unknown) => any;
    nodes: Record<string, any>;
    text: (text: string) => any;
  };
}).Schema;

describe('focusEditorToFirstLineStart', () => {
  it('skips a leading atomic block and focuses the first editable text block', () => {
    const schema = new ProseSchema({
      nodes: {
        doc: { content: 'block+' },
        paragraph: {
          content: 'text*',
          group: 'block',
          toDOM: () => ['p', 0],
          parseDOM: [{ tag: 'p' }],
        },
        text: { group: 'inline' },
        atom_block: {
          group: 'block',
          atom: true,
          selectable: true,
          toDOM: () => ['div'],
          parseDOM: [{ tag: 'div' }],
        },
      },
    });
    const doc = schema.node('doc', null, [
      schema.nodes.atom_block.create(),
      schema.nodes.paragraph.create(null, schema.text('First editable block')),
    ]);
    const tr = {
      setSelection: vi.fn(function setSelection(_selection: unknown) {
        return tr;
      }),
      scrollIntoView: vi.fn(function scrollIntoView() {
        return tr;
      }),
    };
    const view = {
      dispatch: vi.fn(),
      focus: vi.fn(),
      state: {
        doc,
        tr,
      },
    };

    try {
      setCurrentEditorView(view as never);
      focusEditorToFirstLineStart();
    } finally {
      setCurrentEditorView(null);
    }

    const selection = tr.setSelection.mock.calls[0]?.[0];
    expect(selection).toBeInstanceOf(TextSelection);
    expect((selection as TextSelection).from).toBe(2);
    expect(view.dispatch).toHaveBeenCalledWith(tr);
    expect(view.focus).toHaveBeenCalledTimes(1);
  });
});
