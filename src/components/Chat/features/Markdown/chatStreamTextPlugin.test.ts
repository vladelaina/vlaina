import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearNotesDebugLog } from '@/stores/notes/lineBreakDebugLog';
import { createChatStreamTextPlugin } from './chatStreamTextPlugin';

describe('createChatStreamTextPlugin', () => {
  beforeEach(() => {
    clearNotesDebugLog();
  });

  afterEach(() => {
    clearNotesDebugLog();
  });

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

  it('marks active characters with progress and future characters as pending', () => {
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

    createChatStreamTextPlugin({
      births: [0, 100],
      charDelay: 18,
      nowMs: 50,
      revealed: false,
    })(tree);

    expect(tree.children[0].children[0].properties).toEqual({
      className: 'chat-stream-char',
      style: 'opacity:0.556',
    });
    expect(tree.children[0].children[1].properties).toEqual({
      className: 'chat-stream-char chat-stream-char-pending',
    });
  });

  it('keeps the first streamed character visible on the initial paint', () => {
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

    createChatStreamTextPlugin({
      births: [0, 100],
      charDelay: 18,
      nowMs: 0,
      revealed: false,
    })(tree);

    expect(tree.children[0].children[0].properties).toEqual({
      className: 'chat-stream-char',
      style: 'opacity:0',
    });
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
