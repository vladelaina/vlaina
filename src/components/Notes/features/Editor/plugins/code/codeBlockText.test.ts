import { describe, expect, it } from 'vitest';
import {
  MAX_CODE_BLOCK_FALLBACK_TEXT_NODES,
  getCodeBlockSourceText,
} from './codeBlockText';

type TestNode = {
  isText?: boolean;
  text?: string;
  type?: { name?: string };
  content?: {
    forEach: (callback: (child: TestNode) => void) => void;
  };
};

function node(children: TestNode[]): TestNode {
  return {
    content: {
      forEach(callback) {
        children.forEach(callback);
      },
    },
  };
}

function text(value: string): TestNode {
  return {
    isText: true,
    text: value,
  };
}

function hardBreak(): TestNode {
  return {
    type: { name: 'hard_break' },
  };
}

describe('getCodeBlockSourceText', () => {
  it('collects fallback text iteratively in document order', () => {
    expect(getCodeBlockSourceText(node([
      text('one'),
      hardBreak(),
      node([text('two')]),
    ]))).toBe('one\ntwo');
  });

  it('bounds fallback node traversal', () => {
    const children = Array.from(
      { length: MAX_CODE_BLOCK_FALLBACK_TEXT_NODES + 20 },
      () => text('x'),
    );

    expect(getCodeBlockSourceText(node(children))).toHaveLength(MAX_CODE_BLOCK_FALLBACK_TEXT_NODES - 1);
  });
});
