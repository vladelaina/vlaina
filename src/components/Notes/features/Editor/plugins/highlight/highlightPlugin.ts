import { $mark, $inputRule } from '@milkdown/kit/utils';
import { InputRule } from '@milkdown/kit/prose/inputrules';
import { toggleMark } from '@milkdown/kit/prose/commands';
import { $command } from '@milkdown/kit/utils';

export const highlightMark = $mark('highlight', () => ({
  parseDOM: [
    { tag: 'mark' },
    { tag: 'span.highlight' },
    { style: 'background-color', getAttrs: (value) => value === 'yellow' ? {} : false }
  ],
  toDOM: () => ['mark', { class: 'highlight' }, 0],
  parseMarkdown: {
    match: (node) => node.type === 'highlight',
    runner: (state, _node, markType) => {
      state.openMark(markType);
    }
  },
  toMarkdown: {
    match: (mark) => mark.type.name === 'highlight',
    runner: (state, _mark, node) => {
      state.addNode('text', undefined, `==${node.text || ''}==`);
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
  return (state, dispatch) => {
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
    runner: (state, _node, markType) => {
      state.openMark(markType);
    }
  },
  toMarkdown: {
    match: (mark) => mark.type.name === 'superscript',
    runner: (state, _mark, node) => {
      state.addNode('html', undefined, `<sup>${node.text || ''}</sup>`);
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
  return (state, dispatch) => {
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
    runner: (state, _node, markType) => {
      state.openMark(markType);
    }
  },
  toMarkdown: {
    match: (mark) => mark.type.name === 'subscript',
    runner: (state, _mark, node) => {
      state.addNode('html', undefined, `<sub>${node.text || ''}</sub>`);
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
  return (state, dispatch) => {
    const markType = state.schema.marks.subscript;
    if (!markType) return false;
    return toggleMark(markType)(state, dispatch);
  };
});

export const highlightPlugin = [
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
