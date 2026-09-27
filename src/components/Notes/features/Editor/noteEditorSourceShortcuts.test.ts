import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleSourceEditorShortcut } from './noteEditorSourceShortcuts';

vi.mock('./noteEditorContextMenuSourceActions', () => ({
  applySourceBlockType: vi.fn(() => true),
  applySourceFormatting: vi.fn(() => true),
  copySourceSelection: vi.fn(() => Promise.resolve(true)),
  insertSourceAction: vi.fn(() => true),
  pasteSourceText: vi.fn(() => Promise.resolve(true)),
}));

import {
  applySourceBlockType,
  applySourceFormatting,
  copySourceSelection,
  insertSourceAction,
  pasteSourceText,
} from './noteEditorContextMenuSourceActions';

function createEvent(key: string, options: Partial<KeyboardEvent> = {}) {
  return {
    key,
    ctrlKey: true,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    isComposing: false,
    ...options,
  } as KeyboardEvent;
}

describe('source editor context-menu shortcuts', () => {
  const textarea = document.createElement('textarea');

  beforeEach(() => vi.clearAllMocks());

  it.each([
    ['b', 'bold'],
    ['i', 'italic'],
    ['u', 'underline'],
    ['h', 'highlight'],
    ['k', 'link'],
  ])('routes Ctrl+%s to source formatting', (key, action) => {
    expect(handleSourceEditorShortcut(textarea, createEvent(key))).toBe(true);
    expect(applySourceFormatting).toHaveBeenCalledWith(textarea, action);
  });

  it.each([
    ['0', 'paragraph'],
    ['3', 'heading3'],
  ])('routes Ctrl+%s to source block conversion', (key, blockType) => {
    expect(handleSourceEditorShortcut(textarea, createEvent(key))).toBe(true);
    expect(applySourceBlockType).toHaveBeenCalledWith(textarea, blockType);
  });

  it.each([
    ['q', 'quote'],
    ['x', 'task-list'],
    ['5', 'strike'],
    ['[', 'ordered-list'],
    [']', 'bullet-list'],
  ])('routes Ctrl+Shift+%s to source list formatting', (key, action) => {
    expect(handleSourceEditorShortcut(textarea, createEvent(key, { shiftKey: true }))).toBe(true);
    expect(applySourceFormatting).toHaveBeenCalledWith(textarea, action);
  });

  it('routes source insertion shortcuts to the matching snippets', () => {
    expect(handleSourceEditorShortcut(textarea, createEvent('t'))).toBe(true);
    expect(handleSourceEditorShortcut(textarea, createEvent('i', { shiftKey: true }))).toBe(true);
    expect(handleSourceEditorShortcut(textarea, createEvent('k', { shiftKey: true }))).toBe(true);
    expect(handleSourceEditorShortcut(textarea, createEvent('m', { shiftKey: true }))).toBe(true);
    expect(insertSourceAction).toHaveBeenNthCalledWith(1, textarea, 'table');
    expect(insertSourceAction).toHaveBeenNthCalledWith(2, textarea, 'image');
    expect(insertSourceAction).toHaveBeenNthCalledWith(3, textarea, 'code');
    expect(insertSourceAction).toHaveBeenNthCalledWith(4, textarea, 'formula');
  });

  it('routes the advertised clipboard shortcuts', () => {
    expect(handleSourceEditorShortcut(textarea, createEvent('c', { shiftKey: true }))).toBe(true);
    expect(handleSourceEditorShortcut(textarea, createEvent('v', { shiftKey: true }))).toBe(true);
    expect(copySourceSelection).toHaveBeenCalledWith(textarea, 'markdown');
    expect(pasteSourceText).toHaveBeenCalledWith(textarea);
  });

  it('ignores unrelated or modified shortcuts', () => {
    expect(handleSourceEditorShortcut(textarea, createEvent('b', { ctrlKey: false }))).toBe(false);
    expect(handleSourceEditorShortcut(textarea, createEvent('b', { altKey: true }))).toBe(false);
    expect(applySourceFormatting).not.toHaveBeenCalled();
  });
});
