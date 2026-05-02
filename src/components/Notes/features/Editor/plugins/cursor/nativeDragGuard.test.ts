import { describe, expect, it } from 'vitest';
import { shouldSuppressEditorNativeDragStart } from './nativeDragGuard';

describe('shouldSuppressEditorNativeDragStart', () => {
  it('suppresses native drag from placeholder break elements inside the editor', () => {
    const editor = document.createElement('div');
    const paragraph = document.createElement('p');
    const placeholderBreak = document.createElement('br');
    placeholderBreak.dataset.vlainaEmptyLine = 'true';
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

  it('does not suppress drag outside the editor', () => {
    const editor = document.createElement('div');
    const outside = document.createElement('br');
    outside.dataset.vlainaEmptyLine = 'true';

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
