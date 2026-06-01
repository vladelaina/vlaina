import { describe, expect, it } from 'vitest';
import {
  isNativeDragFromCurrentEditorSelection,
  shouldSuppressEditorNativeDragStart,
} from './nativeDragGuard';

describe('shouldSuppressEditorNativeDragStart', () => {
  it('suppresses native drag from placeholder break elements inside the editor', () => {
    const editor = document.createElement('div');
    const paragraph = document.createElement('p');
    const placeholderBreak = document.createElement('br');
    placeholderBreak.dataset.editorEmptyLine = 'true';
    paragraph.append(placeholderBreak);
    editor.append(paragraph);

    expect(shouldSuppressEditorNativeDragStart(editor, placeholderBreak)).toBe(true);
  });

  it('suppresses native drag from normal editor text nodes', () => {
    const editor = document.createElement('div');
    const paragraph = document.createElement('p');
    const text = document.createTextNode('content');
    paragraph.append(text);
    editor.append(paragraph);

    expect(shouldSuppressEditorNativeDragStart(editor, text)).toBe(true);
  });

  it('allows native drag from the current editor text selection', () => {
    const editor = document.createElement('div');
    const paragraph = document.createElement('p');
    const text = document.createTextNode('content');
    paragraph.append(text);
    editor.append(paragraph);
    document.body.append(editor);

    const selection = window.getSelection();
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, text.textContent?.length ?? 0);
    selection?.removeAllRanges();
    selection?.addRange(range);

    expect(isNativeDragFromCurrentEditorSelection(editor, text, selection)).toBe(true);
    expect(shouldSuppressEditorNativeDragStart(editor, text, selection)).toBe(false);
    expect(shouldSuppressEditorNativeDragStart(editor, paragraph, selection)).toBe(false);

    selection?.removeAllRanges();
    editor.remove();
  });

  it('suppresses native drag when the active selection is not fully inside the editor', () => {
    const editor = document.createElement('div');
    const paragraph = document.createElement('p');
    const text = document.createTextNode('content');
    const outside = document.createTextNode('outside');
    paragraph.append(text);
    editor.append(paragraph);
    document.body.append(editor, outside);

    const selection = window.getSelection();
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(outside, outside.textContent?.length ?? 0);
    selection?.removeAllRanges();
    selection?.addRange(range);

    expect(isNativeDragFromCurrentEditorSelection(editor, text, selection)).toBe(false);
    expect(shouldSuppressEditorNativeDragStart(editor, text, selection)).toBe(true);

    selection?.removeAllRanges();
    editor.remove();
    outside.remove();
  });

  it('does not suppress drag outside the editor', () => {
    const editor = document.createElement('div');
    const outside = document.createElement('br');
    outside.dataset.editorEmptyLine = 'true';

    expect(shouldSuppressEditorNativeDragStart(editor, outside)).toBe(false);
  });

  it('allows explicit native drag escape hatches', () => {
    const editor = document.createElement('div');
    const allowed = document.createElement('div');
    const child = document.createElement('span');
    allowed.dataset.allowEditorNativeDrag = 'true';
    allowed.append(child);
    editor.append(allowed);

    expect(shouldSuppressEditorNativeDragStart(editor, child)).toBe(false);
  });
});
