import { remarkPluginsCtx, schemaTimerCtx } from '@milkdown/core';
import { createTimer, type MilkdownPlugin } from '@milkdown/ctx';
import { remarkObsidianImageEmbeds } from '@/components/common/markdown/theme-compatibility/obsidian/imageEmbed';

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
