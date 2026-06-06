import { remarkStringifyOptionsCtx } from '@milkdown/kit/core';
import type { MilkdownPlugin } from '@milkdown/kit/ctx';
import {
  getMdastEscapedBlockSyntax,
  protectEscapedMarkdownBlockSyntaxText,
} from '@/components/common/markdown/escapedBlockSyntax';

export function createDelimitedMarkHandler(delimiter: string) {
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

export function protectCustomInlineMarkdownText(value: string): string {
  return value
    .replace(/(?<!\\)==([^=\n]+)==/g, '\\==$1==')
    .replace(/(?<!\\)\+\+([^+\n]+)\+\+/g, '\\++$1++')
    .replace(/(?<![\\^])\^([^^\s](?:[^^\n]*?[^^\s])?)\^(?!\^)/g, '\\^$1^')
    .replace(/(?<![\\~])~([^~\s](?:[^~\n]*?[^~\s])?)~(?!~)/g, '\\~$1~');
}

export function restoreAbbrDefinitionMarkdownText(value: string, isEscapedSource: boolean): string {
  if (isEscapedSource) return value;
  return value.replace(/(^|\n)([ \t]*)\\\*\\\[([^\]\n]+)]:(?=\s|$)/g, '$1$2*[$3]:');
}

export function restoreTocShortcutMarkdownText(value: string, isEscapedSource: boolean): string {
  if (isEscapedSource) return value;
  return value.replace(
    /^([ \t]*)\\(\[toc\]|\{:toc\})([ \t]*)$/i,
    '$1$2$3'
  );
}

export function createCustomInlineTextProtectionPlugin(
  extraHandlers: Record<string, ReturnType<typeof createDelimitedMarkHandler>>
): MilkdownPlugin {
  return (ctx) => {
    return () => {
      ctx.update(remarkStringifyOptionsCtx, (options) => {
        const handlers = (
          options.handlers && typeof options.handlers === 'object'
            ? options.handlers
            : {}
        ) as Record<string, unknown>;
        const textHandler = typeof handlers.text === 'function'
          ? handlers.text as (node: any, parent: unknown, state: any, info: any) => string
          : null;

        return {
          ...options,
          handlers: {
            ...handlers,
            text: (node: any, parent: unknown, state: any, info: any) => {
              const value = textHandler
                ? textHandler(node, parent, state, info)
                : state.safe(node.value, { ...info, encode: [] });
              const escapedBlockSyntax = getMdastEscapedBlockSyntax(parent);
              return protectEscapedMarkdownBlockSyntaxText(
                restoreTocShortcutMarkdownText(
                  restoreAbbrDefinitionMarkdownText(
                    protectCustomInlineMarkdownText(value),
                    escapedBlockSyntax === 'abbrDefinition'
                  ),
                  escapedBlockSyntax === 'toc'
                ),
                escapedBlockSyntax
              );
            },
            ...extraHandlers,
          },
        };
      });
    };
  };
}
