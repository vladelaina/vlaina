// Color Marks for Floating Toolbar
// Defines textColor and bgColor marks for the editor schema

import { $mark } from '@milkdown/kit/utils';

/**
 * Text Color Mark
 * Applies foreground color to text
 */
export const textColorMark = $mark('textColor', () => ({
  attrs: {
    color: { default: null },
  },
  parseDOM: [
    {
      style: 'color',
      getAttrs: (value) => {
        if (typeof value === 'string' && value) {
          return { color: value };
        }
        return false;
      },
    },
    {
      tag: 'span[data-text-color]',
      getAttrs: (dom) => {
        if (dom instanceof HTMLElement) {
          return { color: dom.getAttribute('data-text-color') };
        }
        return false;
      },
    },
  ],
  toDOM: (mark) => {
    const color = mark.attrs.color as string;
    return [
      'span',
      {
        'data-text-color': color,
        style: `color: ${color}`,
      },
      0,
    ];
  },
  parseMarkdown: {
    match: () => false,
    runner: () => {},
  },
  toMarkdown: {
    match: (mark) => mark.type.name === 'textColor',
    runner: (state, mark) => {
      // Text color is not standard markdown, preserve as HTML
      state.withMark(mark, 'textColor');
    },
  },
}));

/**
 * Background Color Mark
 * Applies background highlight color to text
 */
export const bgColorMark = $mark('bgColor', () => ({
  attrs: {
    color: { default: null },
  },
  parseDOM: [
    {
      style: 'background-color',
      getAttrs: (value) => {
        if (typeof value === 'string' && value && value !== 'transparent') {
          return { color: value };
        }
        return false;
      },
    },
    {
      tag: 'span[data-bg-color]',
      getAttrs: (dom) => {
        if (dom instanceof HTMLElement) {
          return { color: dom.getAttribute('data-bg-color') };
        }
        return false;
      },
    },
    {
      tag: 'mark[data-bg-color]',
      getAttrs: (dom) => {
        if (dom instanceof HTMLElement) {
          return { color: dom.getAttribute('data-bg-color') };
        }
        return false;
      },
    },
  ],
  toDOM: (mark) => {
    const color = mark.attrs.color as string;
    return [
      'mark',
      {
        'data-bg-color': color,
        style: `background-color: ${color}; padding: 0.125rem 0.25rem; border-radius: 0.125rem;`,
      },
      0,
    ];
  },
  parseMarkdown: {
    match: () => false,
    runner: () => {},
  },
  toMarkdown: {
    match: (mark) => mark.type.name === 'bgColor',
    runner: (state, mark) => {
      // Background color is not standard markdown, preserve as HTML
      state.withMark(mark, 'bgColor');
    },
  },
}));

/**
 * Underline Mark (if not already defined)
 * Standard underline formatting
 */
export const underlineMark = $mark('underline', () => ({
  parseDOM: [
    { tag: 'u' },
    { tag: 'span.underline' },
    {
      style: 'text-decoration',
      getAttrs: (value) => (value === 'underline' ? {} : false),
    },
  ],
  toDOM: () => ['u', 0],
  parseMarkdown: {
    match: () => false,
    runner: () => {},
  },
  toMarkdown: {
    match: (mark) => mark.type.name === 'underline',
    runner: (state, mark) => {
      state.withMark(mark, 'underline');
    },
  },
}));

// Combined color marks plugin
export const colorMarksPlugin = [
  textColorMark,
  bgColorMark,
  underlineMark,
];
