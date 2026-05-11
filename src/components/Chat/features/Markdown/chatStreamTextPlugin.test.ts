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

  it('wraps inline code text and hides the code container until the stream reaches it', () => {
    const inlineCodeNode = {
      children: [{ type: 'text', value: 'xy' }],
      properties: {},
      tagName: 'code',
      type: 'element',
    };
    const tree: any = {
      children: [
        {
          children: [
            { type: 'text', value: 'A ' },
            inlineCodeNode,
            { type: 'text', value: ' B' },
          ],
          properties: {},
          tagName: 'p',
          type: 'element',
        },
      ],
      type: 'root',
    };

    createChatStreamTextPlugin({
      births: [0, 20, 100, 120, 140, 160],
      charDelay: 20,
      nowMs: 50,
      revealed: false,
    })(tree);

    const paragraph = tree.children[0];
    const code = paragraph.children[2];

    expect(code.tagName).toBe('code');
    expect(code.properties.className).toBe('chat-stream-inline-code-pending');
    expect(code.children).toMatchObject([
      {
        children: [{ type: 'text', value: 'x' }],
        properties: { className: 'chat-stream-char chat-stream-char-pending' },
        tagName: 'span',
        type: 'element',
      },
      {
        children: [{ type: 'text', value: 'y' }],
        properties: { className: 'chat-stream-char chat-stream-char-pending' },
        tagName: 'span',
        type: 'element',
      },
    ]);
  });

  it('shows the inline code container once its first character starts animating', () => {
    const tree: any = {
      children: [
        {
          children: [
            { type: 'text', value: 'A ' },
            {
              children: [{ type: 'text', value: 'xy' }],
              properties: {},
              tagName: 'code',
              type: 'element',
            },
          ],
          properties: {},
          tagName: 'p',
          type: 'element',
        },
      ],
      type: 'root',
    };

    createChatStreamTextPlugin({
      births: [0, 20, 100, 120],
      charDelay: 20,
      nowMs: 100,
      revealed: false,
    })(tree);

    const code = tree.children[0].children[2];

    expect(code.properties.className).toBeUndefined();
    expect(code.children[0].properties).toEqual({
      className: 'chat-stream-char',
      style: 'opacity:0',
    });
    expect(code.children[1].properties).toEqual({
      className: 'chat-stream-char chat-stream-char-pending',
    });
  });

  it('keeps following paragraph characters pending while a heading is still animating', () => {
    const tree: any = {
      children: [
        {
          children: [{ type: 'text', value: 'Title' }],
          properties: {},
          tagName: 'h1',
          type: 'element',
        },
        {
          children: [{ type: 'text', value: 'Body' }],
          properties: {},
          tagName: 'p',
          type: 'element',
        },
      ],
      type: 'root',
    };

    createChatStreamTextPlugin({
      births: [0, 20, 40, 60, 80, 200, 220, 240, 260],
      charDelay: 20,
      nowMs: 50,
      revealed: false,
    })(tree);

    expect(tree.children[0].children[0].properties).toEqual({
      className: 'chat-stream-char',
      style: 'opacity:0.556',
    });
    expect(tree.children[1].children[0].properties).toEqual({
      className: 'chat-stream-char chat-stream-char-pending',
    });
  });

  it('keeps inline images pending until their markdown position is reached', () => {
    const tree: any = {
      children: [
        {
          children: [
            { type: 'text', value: 'A ' },
            {
              children: [],
              properties: { alt: 'img' },
              tagName: 'img',
              type: 'element',
            },
            { type: 'text', value: ' B' },
          ],
          properties: {},
          tagName: 'p',
          type: 'element',
        },
      ],
      type: 'root',
    };

    createChatStreamTextPlugin({
      births: [0, 20, 100, 120, 140, 180, 200],
      charDelay: 20,
      nowMs: 50,
      revealed: false,
    })(tree);

    const paragraph = tree.children[0];
    expect(paragraph.children[2].properties.className).toBe('chat-stream-element-pending');
    expect(paragraph.children[3].children[0].value).toBe(' ');
    expect(paragraph.children[3].properties.className).toBe('chat-stream-char chat-stream-char-pending');
  });
});
