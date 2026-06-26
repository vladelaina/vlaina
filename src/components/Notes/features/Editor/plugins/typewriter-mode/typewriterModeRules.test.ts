import { describe, expect, it } from 'vitest';
import {
  isTypewriterInputEvent,
  isTypewriterKeyEvent,
  resolveTypewriterScrollTop,
  shouldCenterTypewriterSelection,
} from './typewriterModeRules';

describe('resolveTypewriterScrollTop', () => {
  it('centers the cursor in the scroll root', () => {
    expect(resolveTypewriterScrollTop({
      scrollTop: 100,
      scrollHeight: 1000,
      clientHeight: 400,
      rootRect: { top: 0, bottom: 400 },
      cursorRect: { top: 280, bottom: 300 },
    })).toBe(190);
  });

  it('clamps the target scroll range', () => {
    expect(resolveTypewriterScrollTop({
      scrollTop: 20,
      scrollHeight: 500,
      clientHeight: 400,
      rootRect: { top: 0, bottom: 400 },
      cursorRect: { top: 800, bottom: 820 },
    })).toBe(100);
  });
});

describe('shouldCenterTypewriterSelection', () => {
  it('centers only collapsed cursor selections', () => {
    expect(shouldCenterTypewriterSelection({ empty: true })).toBe(true);
    expect(shouldCenterTypewriterSelection({ empty: false })).toBe(false);
  });
});

describe('isTypewriterInputEvent', () => {
  it('centers after text insertion and deletion input events', () => {
    expect(isTypewriterInputEvent(new InputEvent('beforeinput', { inputType: 'insertText' }))).toBe(true);
    expect(isTypewriterInputEvent(new InputEvent('beforeinput', { inputType: 'insertParagraph' }))).toBe(true);
    expect(isTypewriterInputEvent(new InputEvent('beforeinput', { inputType: 'deleteContentBackward' }))).toBe(true);
  });

  it('does not center for non-editing input events', () => {
    expect(isTypewriterInputEvent(new InputEvent('beforeinput', { inputType: 'historyUndo' }))).toBe(false);
    expect(isTypewriterInputEvent(new InputEvent('beforeinput', { inputType: 'formatBold' }))).toBe(false);
  });
});

describe('isTypewriterKeyEvent', () => {
  it('centers after editing key events and shortcuts', () => {
    expect(isTypewriterKeyEvent(new KeyboardEvent('keydown', { key: 'Enter' }))).toBe(true);
    expect(isTypewriterKeyEvent(new KeyboardEvent('keydown', { key: 'Backspace' }))).toBe(true);
    expect(isTypewriterKeyEvent(new KeyboardEvent('keydown', { key: 'Delete' }))).toBe(true);
    expect(isTypewriterKeyEvent(new KeyboardEvent('keydown', { key: 'Tab' }))).toBe(true);
    expect(isTypewriterKeyEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }))).toBe(true);
    expect(isTypewriterKeyEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, shiftKey: true }))).toBe(true);
    expect(isTypewriterKeyEvent(new KeyboardEvent('keydown', { key: 'y', ctrlKey: true }))).toBe(true);
  });

  it('does not center for navigation and non-editing key events', () => {
    expect(isTypewriterKeyEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))).toBe(false);
    expect(isTypewriterKeyEvent(new KeyboardEvent('keydown', { key: 'z' }))).toBe(false);
    expect(isTypewriterKeyEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, altKey: true }))).toBe(false);
    expect(isTypewriterKeyEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true }))).toBe(false);
    expect(isTypewriterKeyEvent(new KeyboardEvent('keydown', { key: 'Tab', isComposing: true }))).toBe(false);
  });
});
