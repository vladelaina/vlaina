import { describe, expect, it, vi } from 'vitest';
import {
  MAX_TRANSACTION_INSERTED_TEXT_MATCH_CHARS,
  getTransactionInsertedText,
  transactionInsertedTextMatches,
} from './transactionStepText';

function createTextStep(text: string, size = text.length) {
  return {
    slice: {
      content: {
        size,
        textBetween: vi.fn(() => text),
      },
    },
  };
}

describe('transactionStepText', () => {
  it('keeps the full inserted text helper behavior unchanged', () => {
    expect(getTransactionInsertedText({
      steps: [
        createTextStep('alpha '),
        createTextStep('beta'),
      ],
    })).toBe('alpha beta');
  });

  it('matches inserted text across transaction steps without materializing oversized input', () => {
    expect(transactionInsertedTextMatches({
      steps: [
        createTextStep('prefix\n'),
        createTextStep('*[HTML]: HyperText Markup Language'),
      ],
    }, /(?:^\*\[|[\n\r]\*\[)/u)).toBe(true);
  });

  it('returns true conservatively before reading oversized inserted text', () => {
    const step = createTextStep('unread', MAX_TRANSACTION_INSERTED_TEXT_MATCH_CHARS + 1);

    expect(transactionInsertedTextMatches({ steps: [step] }, /#/u)).toBe(true);
    expect(step.slice.content.textBetween).not.toHaveBeenCalled();
  });
});
