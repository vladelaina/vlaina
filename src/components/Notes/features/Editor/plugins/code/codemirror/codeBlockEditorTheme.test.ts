import { EditorState } from '@codemirror/state';
import { EditorView as CodeMirror } from '@codemirror/view';
import { describe, expect, it } from 'vitest';
import { createCodeBlockEditorTheme } from './codeBlockEditorTheme';

describe('codeBlockEditorTheme', () => {
  it('marks selected CodeMirror text so syntax colors cannot override the selection foreground', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    const cm = new CodeMirror({
      parent: host,
      state: EditorState.create({
        doc: 'const value = 1;',
        extensions: [...createCodeBlockEditorTheme()],
      }),
    });

    cm.dispatch({ selection: { anchor: 0, head: 5 } });

    expect(cm.dom.querySelectorAll('.editor-code-selection-text')).toHaveLength(1);

    cm.dispatch({ selection: { anchor: 5, head: 5 } });

    expect(cm.dom.querySelectorAll('.editor-code-selection-text')).toHaveLength(0);

    cm.destroy();
    host.remove();
  });
});
