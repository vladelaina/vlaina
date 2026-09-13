import { expect, it } from 'vitest';
import { Schema } from '@milkdown/kit/prose/model';
import { EditorState, TextSelection } from '@milkdown/kit/prose/state';
import { EditorView } from '@milkdown/kit/prose/view';
import { clearDiagnosticsLog, getDiagnosticsLogText } from '@/lib/diagnostics/diagnosticsLog';
import { createInputDiagnosticsPlugin } from './inputDiagnosticsPlugin';

it('includes composition and structural transactions in copied logs without note text', async () => {
  clearDiagnosticsLog();
  const schema = new Schema({
    nodes: {
      doc: { content: 'paragraph+' },
      paragraph: { content: 'text*', toDOM: () => ['p', 0] },
      text: {},
    },
  });
  const doc = schema.node('doc', null, [schema.node('paragraph', null, schema.text('private fixture'))]);
  const host = document.createElement('div');
  document.body.append(host);
  const view = new EditorView(host, {
    state: EditorState.create({ schema, doc, plugins: [createInputDiagnosticsPlugin()] }),
  });
  try {
    view.dom.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: 'secret pinyin' }));
    const tr = view.state.tr.delete(1, 3);
    view.dispatch(tr.setSelection(TextSelection.create(tr.doc, 1)));
    await Promise.resolve();
    const text = getDiagnosticsLogText();
    const entries = JSON.parse(text).entries;
    expect(entries.some((entry: { event: string }) => entry.event === 'compositionstart')).toBe(true);
    expect(entries.some((entry: { event: string }) => entry.event === 'compositionstart:after')).toBe(true);
    const transaction = entries.find((entry: { event: string }) => entry.event === 'transaction');
    expect(transaction.details.before.docSize - transaction.details.after.docSize).toBe(2);
    expect(transaction.details.steps).toHaveLength(1);
    expect(text).not.toContain('private fixture');
    expect(text).not.toContain('secret pinyin');
  } finally {
    view.destroy();
    host.remove();
    clearDiagnosticsLog();
  }
});
