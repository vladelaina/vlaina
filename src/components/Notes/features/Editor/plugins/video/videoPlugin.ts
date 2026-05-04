import { $node, $command, $prose } from '@milkdown/kit/utils';
import { Plugin, TextSelection } from '@milkdown/kit/prose/state';
import type { VideoAttrs } from './types';
import { createVideoDom } from './videoDom';
import { logVideoDebug } from './videoDebug';
import { VideoNodeView } from './videoNodeView';
import { isSupportedVideoUrl, parseVideoUrl } from './videoUrl';

export const videoSchema = $node('video', () => ({
  group: 'block',
  atom: true,
  isolating: true,
  attrs: {
    src: { default: '' },
    title: { default: '' },
    width: { default: 560 },
    height: { default: 315 },
  },
  parseDOM: [{
    tag: 'div[data-type="video"]',
    getAttrs: (dom) => {
      const el = dom as HTMLElement;
      return {
        src: el.dataset.src || '',
        title: el.dataset.title || '',
        width: parseInt(el.dataset.width || '560', 10),
        height: parseInt(el.dataset.height || '315', 10),
      };
    },
  }],
  toDOM: (node) => {
    return createVideoDom(node.attrs as VideoAttrs);
  },
  parseMarkdown: {
    match: (node) => {
      if (node.type === 'image') {
        const url = node.url as string || '';
        return parseVideoUrl(url) !== null;
      }
      return false;
    },
    runner: (state, node, type) => {
      const src = (node.url as string) || '';
      const title = (node.title as string) || (node.alt as string) || '';
      state.addNode(type, { src, title });
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === 'video',
    runner: (state, node) => {
      state.addNode('image', undefined, undefined, {
        url: node.attrs.src,
        title: node.attrs.title || undefined,
        alt: 'video',
      });
    },
  },
}));

export const insertVideoCommand = $command('insertVideo', () => (src: string = '') => {
  return (state: any, dispatch?: ((tr: any) => void) | null) => {
    const { schema } = state;
    const videoType = schema.nodes.video;
    const paragraphType = schema.nodes.paragraph;

    if (!videoType) return false;

    if (dispatch) {
      const node = videoType.create({ src });
      const tr = state.tr.replaceSelectionWith(node);
      const afterVideoPos = tr.selection.from;
      const nextNode = tr.doc.nodeAt(afterVideoPos);
      if (nextNode?.isTextblock) {
        tr.setSelection(TextSelection.create(tr.doc, afterVideoPos + 1));
      } else if (paragraphType) {
        tr.insert(afterVideoPos, paragraphType.create());
        tr.setSelection(TextSelection.create(tr.doc, afterVideoPos + 1));
      }
      logVideoDebug('insert_command', {
        src,
        supported: isSupportedVideoUrl(src),
      });
      dispatch(tr.scrollIntoView());
    }

    return true;
  };
});

export const videoNodeViewPlugin = $prose(() => {
  return new Plugin({
    props: {
      nodeViews: {
        video: (node, view, getPos) => new VideoNodeView(node, view, getPos as () => number | undefined),
      },
    },
  });
});

export const videoPlugin = [
  videoSchema,
  videoNodeViewPlugin,
  insertVideoCommand,
];
