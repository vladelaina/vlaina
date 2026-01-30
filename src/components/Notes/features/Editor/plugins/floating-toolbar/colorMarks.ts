// Color Marks for Floating Toolbar
// Defines textColor and bgColor marks for the editor schema

import { $mark, $remark, $inputRule } from '@milkdown/kit/utils';
import { InputRule } from '@milkdown/kit/prose/inputrules';

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
    runner: (state, mark, node) => {
      // Text color is not standard markdown, use HTML span
      const color = mark.attrs.color as string;
      state.addNode('html', undefined, `<span style="color: ${color}">${node.text || ''}</span>`);
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
    runner: (state, mark, node) => {
      // Background color is not standard markdown, use HTML mark
      const color = mark.attrs.color as string;
      state.addNode('html', undefined, `<mark style="background-color: ${color}">${node.text || ''}</mark>`);
    },
  },
}));

/**
 * Underline Mark (if not already defined)
 * Standard underline formatting
 * Uses ++text++ syntax in markdown (similar to ==highlight==)
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
    match: (node) => node.type === 'underline',
    runner: (state, _node, markType) => {
      state.openMark(markType);
    },
  },
  toMarkdown: {
    match: (mark) => mark.type.name === 'underline',
    runner: (state, _mark, node) => {
      // Use ++text++ syntax for underline (similar to ==highlight==)
      state.addNode('text', undefined, `++${node.text || ''}++`);
    },
  },
}));

// Input rule: ++text++ -> underline
export const underlineInputRule = $inputRule(() => {
  return new InputRule(
    /(?<!\+)\+\+([^+]+)\+\+$/,
    (state, match, start, end) => {
      const text = match[1];
      if (!text) return null;
      
      const { tr, schema } = state;
      const markType = schema.marks.underline;
      if (!markType) return null;
      
      return tr
        .delete(start, end)
        .insertText(text)
        .addMark(start, start + text.length, markType.create());
    }
  );
});

/**
 * Remark plugin to parse ++underline++ syntax
 * Transforms ++text++ into underline nodes in the AST
 */
interface MdastNode {
  type: string;
  value?: string;
  children?: MdastNode[];
}

function remarkUnderline() {
  const UNDERLINE_REGEX = /\+\+([^+]+)\+\+/g;
  
  function visitNode(node: MdastNode, parent?: MdastNode, index?: number): void {
    if (node.children) {
      for (let i = node.children.length - 1; i >= 0; i--) {
        visitNode(node.children[i], node, i);
      }
    }
    
    if (node.type !== 'text' || !node.value || !parent || index === undefined) return;
    
    const value = node.value;
    const matches: Array<{ start: number; end: number; content: string }> = [];
    let match;
    
    UNDERLINE_REGEX.lastIndex = 0;
    
    while ((match = UNDERLINE_REGEX.exec(value)) !== null) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        content: match[1],
      });
    }
    
    if (matches.length === 0) return;
    
    const newNodes: MdastNode[] = [];
    let lastEnd = 0;
    
    for (const m of matches) {
      if (m.start > lastEnd) {
        newNodes.push({ type: 'text', value: value.slice(lastEnd, m.start) });
      }
      newNodes.push({
        type: 'underline',
        children: [{ type: 'text', value: m.content }],
      });
      lastEnd = m.end;
    }
    
    if (lastEnd < value.length) {
      newNodes.push({ type: 'text', value: value.slice(lastEnd) });
    }
    
    if (parent.children) {
      parent.children.splice(index, 1, ...newNodes);
    }
  }
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (tree: any) => {
    visitNode(tree);
  };
}

export const remarkUnderlinePlugin = $remark('remarkUnderline', () => remarkUnderline);

// Combined color marks plugin - flatten for proper plugin registration
export const colorMarksPlugin = [
  textColorMark,
  bgColorMark,
  remarkUnderlinePlugin,
  underlineMark,
  underlineInputRule,
].flat();