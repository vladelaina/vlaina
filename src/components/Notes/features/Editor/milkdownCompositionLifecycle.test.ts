import { afterEach, expect, it, vi } from 'vitest';
import { Editor, defaultValueCtx, editorViewCtx, rootCtx } from '@milkdown/kit/core';
import { TextSelection } from '@milkdown/kit/prose/state';
import { InputRule } from '@milkdown/kit/prose/inputrules';
import { customInputRules, customInputRulesKey } from '../../../../../vendor/milkdown/packages/prose/src/toolkit/input-rules/custom-input-rules';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener';

afterEach(() => vi.useRealTimers());

async function createEditor() {
  const host = document.createElement('div');
  document.body.append(host);
  const updates: string[] = [];
  const editor = await Editor.make().config((ctx) => {
    ctx.set(rootCtx, host);
    ctx.set(defaultValueCtx, '1');
    ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => updates.push(markdown));
  }).use(commonmark).use(listener).create();
  return { editor, host, updates, view: editor.ctx.get(editorViewCtx) };
}

it.each([1, 2, 6])('keeps an empty level %s heading after cancelling composition', async (level) => {
  const { editor, view, host } = await createEditor();
  vi.useFakeTimers();
  try {
    const prefix = `${'#'.repeat(level)} `;
    const heading = view.state.schema.nodes.heading.create({ level }, view.state.schema.text(prefix));
    let tr = view.state.tr.insert(view.state.doc.content.size, heading);
    tr = tr.setSelection(TextSelection.create(tr.doc, tr.doc.content.size - 1));
    view.dispatch(tr);
    const before = view.state.doc;
    const position = view.state.selection.from;
    view.dom.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    view.dispatch(view.state.tr.insertText('s').setMeta('composition', 1));
    view.dispatch(view.state.tr.delete(position, position + 1).setMeta('composition', 1));
    view.dom.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '' }));
    await vi.runAllTimersAsync();
    expect(view.state.doc.eq(before)).toBe(true);
    expect(view.state.selection.from).toBe(position);
  } finally {
    await editor.destroy();
    host.remove();
  }
});

it('still runs input rules for committed composition text', async () => {
  const { editor, view, host } = await createEditor();
  vi.useFakeTimers();
  try {
    const rule = new InputRule(/ok!$/, (state, _match, from, to) => state.tr.insertText('done', from, to));
    view.updateState(view.state.reconfigure({
      plugins: [
        ...view.state.plugins.filter((plugin) => plugin !== customInputRulesKey.get(view.state)),
        customInputRules({ rules: [rule] }),
      ],
    }));
    const tr = view.state.tr.insertText('ok!', 1, 2);
    view.dispatch(tr.setSelection(TextSelection.create(tr.doc, 4)));
    view.dom.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    view.dom.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: 'ok!' }));
    await vi.runAllTimersAsync();
    expect(view.state.doc.textContent).toBe('done');
  } finally {
    await editor.destroy();
    host.remove();
  }
});

it('publishes only the final document when pinyin is inserted then deleted', async () => {
  const { editor, view, host, updates } = await createEditor();
  vi.useFakeTimers();
  try {
    view.dispatch(view.state.tr.insertText('s', 2));
    await vi.advanceTimersByTimeAsync(100);
    view.dispatch(view.state.tr.delete(2, 3));
    await vi.runAllTimersAsync();
    expect(view.state.doc.textContent).toBe('1');
    expect(updates).toEqual([]);
  } finally {
    await editor.destroy();
    host.remove();
  }
});

it('cancels pending markdown notifications when the editor is destroyed', async () => {
  const { editor, view, host, updates } = await createEditor();
  vi.useFakeTimers();
  view.dispatch(view.state.tr.insertText('s', 2));
  await editor.destroy();
  host.remove();
  await vi.runAllTimersAsync();
  expect(updates).toEqual([]);
});

it('publishes committed text once instead of earlier pinyin snapshots', async () => {
  const { editor, view, host, updates } = await createEditor();
  vi.useFakeTimers();
  try {
    view.dispatch(view.state.tr.insertText('ni', 2));
    await vi.advanceTimersByTimeAsync(100);
    view.dispatch(view.state.tr.insertText('你好', 2, 4));
    await vi.runAllTimersAsync();
    expect(updates).toEqual(['1你好\n']);
  } finally {
    await editor.destroy();
    host.remove();
  }
});
