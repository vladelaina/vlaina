import { describe, expect, it } from 'vitest';
import { createChatStreamTextPlugin } from './chatStreamTextPlugin';

describe('createChatStreamTextPlugin', () => {
  it('wraps visible paragraph text directly as a rehype transformer', () => {
    const tree: any = {
      children: [
        {
          children: [{ type: 'text', value: 'Hi' }],
          properties: {},
          tagName: 'p',
          type: 'element',
        },
      ],
      type: 'root',
    };

    const transform = createChatStreamTextPlugin({
      births: [0, 18],
      charDelay: 18,
      nowMs: 400,
      revealed: false,
    });

    transform(tree);

    expect(tree.children[0].children).toMatchObject([
      {
        children: [{ type: 'text', value: 'H' }],
        properties: { className: 'chat-stream-char chat-stream-char-done' },
        tagName: 'span',
        type: 'element',
      },
      {
        children: [{ type: 'text', value: 'i' }],
        properties: { className: 'chat-stream-char chat-stream-char-done' },
        tagName: 'span',
        type: 'element',
      },
    ]);
  });

  it('does not wrap code blocks', () => {
    const codeNode = { children: [{ type: 'text', value: 'const a = 1;' }], tagName: 'code', type: 'element' };
    const tree: any = {
      children: [{ children: [codeNode], tagName: 'pre', type: 'element' }],
      type: 'root',
    };

    createChatStreamTextPlugin({
      births: [],
      charDelay: 18,
      nowMs: 0,
      revealed: false,
    })(tree);

    expect(tree.children[0].children[0]).toBe(codeNode);
  });
});
