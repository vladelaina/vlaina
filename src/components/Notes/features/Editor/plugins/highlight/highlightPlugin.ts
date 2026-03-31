import { $mark, $inputRule } from '@milkdown/kit/utils';
import { InputRule } from '@milkdown/kit/prose/inputrules';
import { toggleMark } from '@milkdown/kit/prose/commands';
import { $command, $remark } from '@milkdown/kit/utils';

interface MdastNode {
  type: string;
  value?: string;
  children?: MdastNode[];
}

function replaceDelimitedTextMark(tree: MdastNode, type: string, regex: RegExp) {
  function visit(node: MdastNode, parent?: MdastNode, index?: number): void {
    if (node.children) {
      for (let i = node.children.length - 1; i >= 0; i -= 1) {
        visit(node.children[i], node, i);
      }
    }

    if (node.type !== 'text' || !node.value || !parent || index === undefined) return;

    const matches: Array<{ start: number; end: number; content: string }> = [];
    let match: RegExpExecArray | null;
    regex.lastIndex = 0;

    while ((match = regex.exec(node.value)) !== null) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        content: match[1],
      });
    }

    if (matches.length === 0) return;

    const nextChildren: MdastNode[] = [];
    let lastEnd = 0;

    for (const item of matches) {
      if (item.start > lastEnd) {
        nextChildren.push({ type: 'text', value: node.value.slice(lastEnd, item.start) });
      }

      nextChildren.push({
        type,
        children: [{ type: 'text', value: item.content }],
      });
      lastEnd = item.end;
    }

    if (lastEnd < node.value.length) {
      nextChildren.push({ type: 'text', value: node.value.slice(lastEnd) });
    }

    parent.children?.splice(index, 1, ...nextChildren);
  }

  visit(tree);
}

function replaceInlineHtmlMark(tree: MdastNode, type: string, pattern: RegExp) {
  function visit(node: MdastNode): void {
    if (!node.children?.length) return;

    for (let index = 0; index < node.children.length; index += 1) {
      const child = node.children[index];
      if (child.type === 'html' && typeof child.value === 'string') {
        const match = child.value.trim().match(pattern);
        if (match) {
          node.children.splice(index, 1, {
            type,
            children: [{ type: 'text', value: match[1] }],
          });
          continue;
        }
      }

      visit(child);
    }
  }

  visit(tree);
}

function remarkHighlight() {
  return (tree: MdastNode) => {
    replaceDelimitedTextMark(tree, 'highlight', /==([^=]+)==/g);
    replaceInlineHtmlMark(tree, 'superscript', /^<sup>([\s\S]*?)<\/sup>$/i);
    replaceInlineHtmlMark(tree, 'subscript', /^<sub>([\s\S]*?)<\/sub>$/i);
  };
}

export const remarkHighlightPlugin = $remark('remarkHighlight', () => remarkHighlight);

export const highlightMark = $mark('highlight', () => ({
  parseDOM: [
    { tag: 'mark' },
    { tag: 'span.highlight' },
    { style: 'background-color', getAttrs: (value) => value === 'yellow' ? {} : false }
  ],
  toDOM: () => ['mark', { class: 'highlight' }, 0],
  parseMarkdown: {
    match: (node) => node.type === 'highlight',
    runner: (state, node, markType) => {
      state.openMark(markType);
      state.next(node.children);
      state.closeMark(markType);
    }
  },
  toMarkdown: {
    match: (mark) => mark.type.name === 'highlight',
    runner: (state, _mark, node) => {
      state.addNode('text', undefined, `==${node.text || ''}==`);
      return true;
    }
  }
}));

export const highlightInputRule = $inputRule(() => {
  return new InputRule(
    /(?<!=)==([^=]+)==$/,
    (state, match, start, end) => {
      const text = match[1];
      if (!text) return null;
      
      const { tr, schema } = state;
      const markType = schema.marks.highlight;
      if (!markType) return null;
      
      return tr
        .delete(start, end)
        .insertText(text)
        .addMark(start, start + text.length, markType.create());
    }
  );
});

export const toggleHighlightCommand = $command('toggleHighlight', () => () => {
  return (state: any, dispatch?: ((tr: any) => void) | null) => {
    const markType = state.schema.marks.highlight;
    if (!markType) return false;
    return toggleMark(markType)(state, dispatch);
  };
});

export const superscriptMark = $mark('superscript', () => ({
  parseDOM: [
    { tag: 'sup' },
    { tag: 'span.superscript' }
  ],
  toDOM: () => ['sup', { class: 'superscript' }, 0],
  parseMarkdown: {
    match: (node) => node.type === 'superscript',
    runner: (state, node, markType) => {
      state.openMark(markType);
      state.next(node.children);
      state.closeMark(markType);
    }
  },
  toMarkdown: {
    match: (mark) => mark.type.name === 'superscript',
    runner: (state, _mark, node) => {
      state.addNode('html', undefined, `<sup>${node.text || ''}</sup>`);
      return true;
    }
  }
}));

export const superscriptInputRule = $inputRule(() => {
  return new InputRule(
    /(?<!\^)\^([^^]+)\^$/,
    (state, match, start, end) => {
      const text = match[1];
      if (!text) return null;
      
      const { tr, schema } = state;
      const markType = schema.marks.superscript;
      if (!markType) return null;
      
      return tr
        .delete(start, end)
        .insertText(text)
        .addMark(start, start + text.length, markType.create());
    }
  );
});

export const toggleSuperscriptCommand = $command('toggleSuperscript', () => () => {
  return (state: any, dispatch?: ((tr: any) => void) | null) => {
    const markType = state.schema.marks.superscript;
    if (!markType) return false;
    return toggleMark(markType)(state, dispatch);
  };
});

export const subscriptMark = $mark('subscript', () => ({
  parseDOM: [
    { tag: 'sub' },
    { tag: 'span.subscript' }
  ],
  toDOM: () => ['sub', { class: 'subscript' }, 0],
  parseMarkdown: {
    match: (node) => node.type === 'subscript',
    runner: (state, node, markType) => {
      state.openMark(markType);
      state.next(node.children);
      state.closeMark(markType);
    }
  },
  toMarkdown: {
    match: (mark) => mark.type.name === 'subscript',
    runner: (state, _mark, node) => {
      state.addNode('html', undefined, `<sub>${node.text || ''}</sub>`);
      return true;
    }
  }
}));

export const subscriptInputRule = $inputRule(() => {
  return new InputRule(
    /(?<!~)~([^~\s][^~]*[^~\s]|[^~\s])~(?!~)$/,
    (state, match, start, end) => {
      const text = match[1];
      if (!text) return null;
      
      const { tr, schema } = state;
      const markType = schema.marks.subscript;
      if (!markType) return null;
      
      return tr
        .delete(start, end)
        .insertText(text)
        .addMark(start, start + text.length, markType.create());
    }
  );
});

export const toggleSubscriptCommand = $command('toggleSubscript', () => () => {
  return (state: any, dispatch?: ((tr: any) => void) | null) => {
    const markType = state.schema.marks.subscript;
    if (!markType) return false;
    return toggleMark(markType)(state, dispatch);
  };
});

export const highlightPlugin = [
  remarkHighlightPlugin,
  highlightMark,
  highlightInputRule,
  toggleHighlightCommand,
  superscriptMark,
  superscriptInputRule,
  toggleSuperscriptCommand,
  subscriptMark,
  subscriptInputRule,
  toggleSubscriptCommand
];
