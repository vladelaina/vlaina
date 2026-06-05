import { remarkPluginsCtx, schemaTimerCtx } from '@milkdown/core';
import { createTimer, type MilkdownPlugin } from '@milkdown/ctx';
import { canTransformMarkdownAst } from '@/components/common/markdown/markdownAstBudget';
import { parseVideoUrl } from './videoUrl';

interface VideoMarkdownNode {
  type: string;
  url?: unknown;
  title?: unknown;
  alt?: unknown;
  children?: VideoMarkdownNode[];
}

const videoRemarkReady = createTimer('videoRemarkReady');

function isVideoImageNode(node: VideoMarkdownNode | undefined): node is VideoMarkdownNode {
  return node?.type === 'image' && parseVideoUrl(String(node.url || '')) !== null;
}

export function remarkVideoImages() {
  return (tree: VideoMarkdownNode) => {
    if (!canTransformMarkdownAst(tree)) {
      return;
    }

    const stack = [tree];

    while (stack.length > 0) {
      const node = stack.pop()!;
      const children = node.children;
      if (!Array.isArray(children)) {
        continue;
      }

      for (let index = children.length - 1; index >= 0; index -= 1) {
        const child = children[index];
        if (
          child?.type === 'paragraph'
          && Array.isArray(child.children)
          && child.children.length === 1
          && isVideoImageNode(child.children[0])
        ) {
          const image = child.children[0];
          children[index] = {
            type: 'video',
            url: image.url,
            title: image.title,
            alt: image.alt,
          };
          continue;
        }

        stack.push(child);
      }
    }
  };
}

export const remarkVideoImagesPlugin: MilkdownPlugin = (ctx) => {
  ctx.record(videoRemarkReady);
  ctx.update(schemaTimerCtx, (timers) => timers.concat(videoRemarkReady));

  return async () => {
    const remarkPlugin = {
      plugin: remarkVideoImages,
      options: undefined,
    };

    ctx.update(remarkPluginsCtx, (plugins) => plugins.concat(remarkPlugin as any));
    ctx.done(videoRemarkReady);

    return () => {
      ctx.update(remarkPluginsCtx, (plugins) => plugins.filter((plugin) => plugin !== (remarkPlugin as any)));
      ctx.update(schemaTimerCtx, (timers) => timers.filter((timer) => timer !== videoRemarkReady));
      ctx.clearTimer(videoRemarkReady);
    };
  };
};
