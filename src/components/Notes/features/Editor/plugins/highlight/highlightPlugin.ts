import { $mark, $inputRule } from '@milkdown/kit/utils';
import { InputRule } from '@milkdown/kit/prose/inputrules';
import { toggleMark } from '@milkdown/kit/prose/commands';
import { $command, $remark } from '@milkdown/kit/utils';
import { remarkStringifyOptionsCtx } from '@milkdown/kit/core';
import type { MilkdownPlugin } from '@milkdown/kit/ctx';
import {
  escapeMarkdownHtmlText,
} from '@/lib/notes/markdown/markdownHtmlText';
import { remarkHighlight } from './highlightMarkdownTransforms';

export const remarkHighlightPlugin = $remark('remarkHighlight', () => remarkHighlight);

function shouldUseHtmlFallback(text: string, delimiter: string): boolean {
  return text.includes(delimiter) || /[<>&]/.test(text);
}

function createDelimitedMarkHandler(delimiter: string) {
  return (node: any, _: unknown, state: any, info: any) => {
    const exit = state.enter(node.type);
    const tracker = state.createTracker(info);
    let value = tracker.move(delimiter);
    value += tracker.move(
      state.containerPhrasing(node, {
        before: value,
        after: delimiter,
        ...tracker.current(),
      })
    );
    value += tracker.move(delimiter);
    exit();
    return value;
  };
}

export const highlightStringifyPlugin: MilkdownPlugin = (ctx) => {
  return () => {
    ctx.update(remarkStringifyOptionsCtx, (options) => {
      const handlers =
        options.handlers && typeof options.handlers === 'object' ? options.handlers : {};

      return {
        ...options,
        handlers: {
          ...handlers,
          superscript: createDelimitedMarkHandler('^'),
          subscript: createDelimitedMarkHandler('~'),
        },
      };
    });
  };
};

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
      const text = node.text || '';
      if (text.includes('=')) {
        state.addNode('html', undefined, `<mark>${escapeMarkdownHtmlText(text)}</mark>`);
      } else {
        state.addNode('text', undefined, `==${text}==`);
      }
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
      const initialStoredMarks = state.storedMarks ?? [];
      const markType = schema.marks.highlight;
      if (!markType) return null;
      
      return tr
        .delete(start, end)
        .insertText(text)
        .addMark(start, start + text.length, markType.create())
        .setStoredMarks(initialStoredMarks);
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
      const text = node.text || '';
      if (shouldUseHtmlFallback(text, '^')) {
        state.addNode('html', undefined, `<sup>${escapeMarkdownHtmlText(text)}</sup>`);
        return true;
      } else {
        state.withMark(_mark, 'superscript');
      }
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
      const initialStoredMarks = state.storedMarks ?? [];
      const markType = schema.marks.superscript;
      if (!markType) return null;
      
      return tr
        .delete(start, end)
        .insertText(text)
        .addMark(start, start + text.length, markType.create())
        .setStoredMarks(initialStoredMarks);
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
      const text = node.text || '';
      if (shouldUseHtmlFallback(text, '~')) {
        state.addNode('html', undefined, `<sub>${escapeMarkdownHtmlText(text)}</sub>`);
        return true;
      } else {
        state.withMark(_mark, 'subscript');
      }
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
      const initialStoredMarks = state.storedMarks ?? [];
      const markType = schema.marks.subscript;
      if (!markType) return null;
      
      return tr
        .delete(start, end)
        .insertText(text)
        .addMark(start, start + text.length, markType.create())
        .setStoredMarks(initialStoredMarks);
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
  highlightStringifyPlugin,
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
