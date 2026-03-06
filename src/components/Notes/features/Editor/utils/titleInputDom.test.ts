import { afterEach, describe, expect, it } from 'vitest';
import {
  NOTE_TITLE_INPUT_DATA_ATTR,
  getNoteTitleInput,
  focusNoteTitleInputAtEnd,
} from './titleInputDom';

describe('titleInputDom', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('returns null when title input is absent', () => {
    expect(getNoteTitleInput()).toBeNull();
    expect(focusNoteTitleInputAtEnd()).toBe(false);
  });

  it('focuses title input and moves caret to end', () => {
    const input = document.createElement('input');
    input.setAttribute(NOTE_TITLE_INPUT_DATA_ATTR, 'true');
    input.value = 'My title';
    document.body.appendChild(input);

    expect(focusNoteTitleInputAtEnd()).toBe(true);
    expect(getNoteTitleInput()).toBe(input);
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(input.value.length);
    expect(input.selectionEnd).toBe(input.value.length);
  });
});
