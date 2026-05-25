import { describe, expect, it } from 'vitest';
import { createEmojiShortcutState, deriveEmojiShortcutState } from './emojiShortcutState';

function createSelection(textBefore: string) {
  return {
    empty: true,
    $from: {
      parentOffset: textBefore.length,
      pos: textBefore.length,
      parent: {
        isTextblock: true,
        type: { spec: { code: false } },
        textBetween: () => textBefore,
      },
    },
  } as any;
}

function createTransaction(selectionText: string) {
  return {
    docChanged: true,
    selectionSet: false,
    selection: createSelection(selectionText),
    getMeta: () => null,
  } as any;
}

describe('deriveEmojiShortcutState', () => {
  it('opens for ASCII colon emoji shortcuts', () => {
    const next = deriveEmojiShortcutState(createTransaction(':smile'), createEmojiShortcutState());

    expect(next.isOpen).toBe(true);
    expect(next.query).toBe('smile');
  });

  it('opens for fullwidth colon emoji shortcuts', () => {
    const next = deriveEmojiShortcutState(createTransaction('：smile'), createEmojiShortcutState());

    expect(next.isOpen).toBe(true);
    expect(next.query).toBe('smile');
  });

  it('does not open for a bare fullwidth colon', () => {
    const next = deriveEmojiShortcutState(createTransaction('：'), createEmojiShortcutState());

    expect(next).toEqual(createEmojiShortcutState());
  });
});

