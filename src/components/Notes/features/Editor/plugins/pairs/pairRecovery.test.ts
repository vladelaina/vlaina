import { describe, expect, it } from 'vitest';

import {
  findRecoverableAutoCloserFromSelection,
  recoverSelectionAutoClosers,
} from './pairRecovery';

function createParent(text: string) {
  return {
    isTextblock: true,
    content: { size: text.length },
    textBetween: (from: number, to: number) => text.slice(from, to),
    get textContent(): string {
      throw new Error('textContent should not be read during auto-pair recovery');
    },
  };
}

describe('pairRecovery', () => {
  it('recovers adjacent auto closers without aggregating parent text', () => {
    const parent = createParent('()');
    const selection = {
      empty: true,
      from: 1,
      $from: {
        parent,
        parentOffset: 1,
      },
    };

    expect(recoverSelectionAutoClosers({
      doc: { content: { size: 2 }, textBetween: (from, to) => '()'.slice(from, to) },
      selection,
    })).toEqual([{ close: ')', pos: 1 }]);
    expect(findRecoverableAutoCloserFromSelection(selection)).toEqual({ close: ')', pos: 1 });
  });

  it('recovers nested trailing closers from bounded local text', () => {
    const parent = createParent('「《标题》」');

    expect(recoverSelectionAutoClosers({
      doc: { content: { size: 6 }, textBetween: (from, to) => '「《标题》」'.slice(from, to) },
      selection: {
        empty: true,
        from: 5,
        $from: {
          parent,
          parentOffset: 5,
        },
      },
    })).toEqual([
      { close: '》', pos: 4 },
      { close: '」', pos: 5 },
    ]);
  });
});
