import { EditorState } from '@codemirror/state';
import { EditorView as CodeMirror } from '@codemirror/view';
import { forceParsing } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { describe, expect, it } from 'vitest';
import { createCodeBlockEditorTheme } from './codeBlockEditorTheme';
import { codeBlockCompatibilityHighlightStyle } from './codeBlockCompatibilityHighlightStyle';
import { codeBlockLanguageLoader } from '../codeBlockLanguageLoader';

describe('codeBlockEditorTheme', () => {
  it('adds Obsidian code block alias classes to CodeMirror lines', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    const cm = new CodeMirror({
      parent: host,
      state: EditorState.create({
        doc: 'one\ntwo',
        extensions: [...createCodeBlockEditorTheme()],
      }),
    });

    const lines = Array.from(cm.dom.querySelectorAll('.cm-line'));
    expect(lines).toHaveLength(2);
    expect(lines[0].classList.contains('HyperMD-codeblock')).toBe(true);
    expect(lines[0].classList.contains('HyperMD-codeblock-bg')).toBe(true);
    expect(lines[0].classList.contains('cm-hmd-codeblock')).toBe(true);
    expect(lines[0].classList.contains('HyperMD-codeblock-begin')).toBe(true);
    expect(lines[0].classList.contains('HyperMD-codeblock-begin-bg')).toBe(true);
    expect(lines[1].classList.contains('HyperMD-codeblock')).toBe(true);
    expect(lines[1].classList.contains('HyperMD-codeblock-bg')).toBe(true);
    expect(lines[1].classList.contains('cm-hmd-codeblock')).toBe(true);
    expect(lines[1].classList.contains('HyperMD-codeblock-end')).toBe(true);
    expect(lines[1].classList.contains('HyperMD-codeblock-end-bg')).toBe(true);

    cm.destroy();
    host.remove();
  });

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

  it('adds Obsidian and CodeMirror 5 token alias classes without replacing syntax colors', async () => {
    const jsonLanguage = await codeBlockLanguageLoader.load('json');
    expect(jsonLanguage).toBeDefined();

    const host = document.createElement('div');
    document.body.appendChild(host);

    const cm = new CodeMirror({
      parent: host,
      state: EditorState.create({
        doc: '{"name": "Ada", "count": 1, "ok": true}',
        extensions: [
          jsonLanguage!,
          ...createCodeBlockEditorTheme(),
        ],
      }),
    });

    expect(forceParsing(cm, cm.state.doc.length, 1000)).toBe(true);
    await new Promise((resolve) => requestAnimationFrame(resolve));

    expect(cm.dom.querySelector('.cm-property')).toBeInstanceOf(HTMLElement);
    expect(cm.dom.querySelector('.cm-string')).toBeInstanceOf(HTMLElement);
    expect(cm.dom.querySelector('.cm-number')).toBeInstanceOf(HTMLElement);
    expect(cm.dom.querySelector('.cm-atom')).toBeInstanceOf(HTMLElement);
    expect(cm.dom.querySelector('.token.property')).toBeInstanceOf(HTMLElement);
    expect(cm.dom.querySelector('.token.string')).toBeInstanceOf(HTMLElement);
    expect(cm.dom.querySelector('.token.number')).toBeInstanceOf(HTMLElement);
    expect(cm.dom.querySelector('.token.boolean')).toBeInstanceOf(HTMLElement);

    cm.destroy();
    host.remove();

    const javascriptLanguage = await codeBlockLanguageLoader.load('javascript');
    expect(javascriptLanguage).toBeDefined();

    const javascriptHost = document.createElement('div');
    document.body.appendChild(javascriptHost);

    const javascriptCm = new CodeMirror({
      parent: javascriptHost,
      state: EditorState.create({
        doc: 'const value = count + 1;',
        extensions: [
          javascriptLanguage!,
          ...createCodeBlockEditorTheme(),
        ],
      }),
    });

    expect(forceParsing(javascriptCm, javascriptCm.state.doc.length, 1000)).toBe(true);
    await new Promise((resolve) => requestAnimationFrame(resolve));

    expect(javascriptCm.dom.querySelector('.cm-variable-2')).toBeInstanceOf(HTMLElement);
    expect(javascriptCm.dom.querySelector('.token.variable')).toBeInstanceOf(HTMLElement);

    javascriptCm.destroy();
    javascriptHost.remove();
  });

  it('keeps Prism aliases merged with CodeMirror aliases for specific token tags', () => {
    const methodClass = codeBlockCompatibilityHighlightStyle.style([tags.function(tags.propertyName)]);
    const localVariableClass = codeBlockCompatibilityHighlightStyle.style([tags.local(tags.variableName)]);
    const standardPropertyClass = codeBlockCompatibilityHighlightStyle.style([tags.standard(tags.propertyName)]);
    const modifierClass = codeBlockCompatibilityHighlightStyle.style([tags.modifier]);
    const escapeClass = codeBlockCompatibilityHighlightStyle.style([tags.escape]);
    const labelClass = codeBlockCompatibilityHighlightStyle.style([tags.labelName]);

    expect(methodClass).toContain('cm-property');
    expect(methodClass).toContain('token property');
    expect(methodClass).toContain('token method');
    expect(methodClass).toContain('token property-access');
    expect(localVariableClass).toContain('cm-variable');
    expect(localVariableClass).toContain('token variable');
    expect(localVariableClass).toContain('token dom');
    expect(localVariableClass).toContain('token parameter');
    expect(standardPropertyClass).toContain('cm-property');
    expect(standardPropertyClass).toContain('token builtin');
    expect(modifierClass).toContain('cm-keyword');
    expect(modifierClass).toContain('token keyword');
    expect(modifierClass).toContain('token important');
    expect(escapeClass).toContain('cm-string-2');
    expect(escapeClass).toContain('token regex');
    expect(escapeClass).toContain('token entity');
    expect(labelClass).toContain('cm-qualifier');
    expect(labelClass).toContain('token namespace');
    expect(labelClass).toContain('token entity');
  });

  it('adds the CodeMirror 6 special character alias used by Obsidian themes', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    const cm = new CodeMirror({
      parent: host,
      state: EditorState.create({
        doc: 'a\u200bb',
        extensions: [...createCodeBlockEditorTheme()],
      }),
    });

    const specialCharacter = cm.dom.querySelector('.cm-specialChar');
    expect(specialCharacter).toBeInstanceOf(HTMLElement);
    expect(specialCharacter?.getAttribute('aria-label')).toContain('zero width space');

    cm.destroy();
    host.remove();
  });
});
