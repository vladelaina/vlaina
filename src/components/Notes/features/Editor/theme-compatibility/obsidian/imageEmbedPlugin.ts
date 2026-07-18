import { remarkPluginsCtx, schemaTimerCtx } from '@milkdown/core';
import { createTimer, type MilkdownPlugin } from '@milkdown/ctx';
import { Plugin } from '@milkdown/kit/prose/state';
import { $prose } from '@milkdown/kit/utils';
import {
  parseObsidianImageEmbedTarget,
  remarkObsidianImageEmbeds,
} from '@/components/common/markdown/theme-compatibility/obsidian/imageEmbed';
import { markEditorUserInput } from '../../plugins/shared/userInputEvents';

const obsidianImageEmbedsRemarkReady = createTimer('obsidianImageEmbedsRemarkReady');

export const obsidianImageEmbedPlugin: MilkdownPlugin = (ctx) => {
  ctx.record(obsidianImageEmbedsRemarkReady);
  ctx.update(schemaTimerCtx, (timers) => timers.concat(obsidianImageEmbedsRemarkReady));

  return async () => {
    const remarkPlugin = {
      plugin: remarkObsidianImageEmbeds,
      options: undefined,
    };

    ctx.update(remarkPluginsCtx, (plugins) => plugins.concat(remarkPlugin as any));
    ctx.done(obsidianImageEmbedsRemarkReady);

    return () => {
      ctx.update(remarkPluginsCtx, (plugins) => plugins.filter((plugin) => plugin !== (remarkPlugin as any)));
      ctx.update(schemaTimerCtx, (timers) => timers.filter((timer) => timer !== obsidianImageEmbedsRemarkReady));
      ctx.clearTimer(obsidianImageEmbedsRemarkReady);
    };
  };
};

const obsidianImageEmbedPattern = /!\[\[([^\]\n]{1,4096})\]\]$/;
const MAX_OBSIDIAN_IMAGE_INPUT_CHARS = 4_102;

export const obsidianImageEmbedInputPlugin = $prose(() => new Plugin({
  props: {
    handleTextInput(view, from, to, text) {
      if (view.composing || text !== ']' || from !== to) return false;

      const { state } = view;
      const imageType = state.schema.nodes.image;
      const parentOffset = state.selection.$from.parentOffset;
      if (!imageType || parentOffset !== from - state.selection.$from.start()) return false;

      const textBefore = state.selection.$from.parent.textBetween(
        Math.max(0, parentOffset - MAX_OBSIDIAN_IMAGE_INPUT_CHARS),
        parentOffset,
        undefined,
        '\uFFFC',
      ) + text;
      const match = obsidianImageEmbedPattern.exec(textBefore);
      const image = parseObsidianImageEmbedTarget(match?.[1] ?? '');
      if (!match || !image) return false;

      const start = from - (match[0].length - text.length);
      const replaceTo = state.doc.textBetween(to, Math.min(to + 1, state.doc.content.size)) === ']'
        ? to + 1
        : to;
      markEditorUserInput(view);
      view.dispatch(state.tr.replaceWith(start, replaceTo, imageType.create({
        src: image.src,
        alt: image.alt,
        title: image.title,
        persistedSrc: image.src,
      })));
      return true;
    },
  },
}));
