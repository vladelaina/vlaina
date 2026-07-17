import { $node, $command, $prose } from '@milkdown/kit/utils';
import { Plugin } from '@milkdown/kit/prose/state';
import type { VideoAttrs } from './types';
import { createVideoDom, getVideoElementAttrs, normalizeVideoAttrs } from './videoDom';
import { VideoNodeView } from './videoNodeView';
import { parseVideoUrl, sanitizeVideoUrlInput } from './videoUrl';
import { markEditorUserInput } from '../shared/userInputEvents';
import { remarkVideoImagesPlugin } from './videoMarkdown';
import { videoMarkdownInputPlugin } from './videoMarkdownInput';
import {
  findInsertedNodePos,
  moveSelectionAfterInsertedNode,
} from '../shared/insertedNodeSelection';

function getVideoMarkdownTitle(node: { title?: unknown; alt?: unknown }): string {
  if (typeof node.title === 'string' && node.title) {
    return node.title;
  }
  if (typeof node.alt === 'string' && node.alt && node.alt !== 'video') {
    return node.alt;
  }
  return '';
}

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
      const attrs = getVideoElementAttrs(el);
      const src = sanitizeVideoUrlInput(attrs.src, { allowEmpty: true });
      if (src === null) return false;
      return normalizeVideoAttrs({ ...attrs, src });
    },
  }],
  toDOM: (node) => {
    return createVideoDom(node.attrs as VideoAttrs);
  },
  parseMarkdown: {
    match: (node) => {
      if (node.type === 'video' || node.type === 'image') {
        return parseVideoUrl(node.url) !== null;
      }
      return false;
    },
    runner: (state, node, type) => {
      const src = sanitizeVideoUrlInput(node.url);
      if (!src) return;
      const title = getVideoMarkdownTitle(node);
      state.addNode(type, normalizeVideoAttrs({ src, title }));
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === 'video',
    runner: (state, node) => {
      const src = sanitizeVideoUrlInput(node.attrs.src, { allowEmpty: true });
      if (!src) {
        state.addNode('paragraph', []);
        return;
      }
      const attrs = normalizeVideoAttrs({
        src,
        title: node.attrs.title,
        width: node.attrs.width,
        height: node.attrs.height,
      });

      state.openNode('paragraph');
      state.addNode('image', undefined, undefined, {
        url: src,
        title: attrs.title || undefined,
        alt: 'video',
      });
      state.closeNode();
    },
  },
}));

export const insertVideoCommand = $command('insertVideo', () => (src: string = '') => {
  return (state: any, dispatch?: ((tr: any) => void) | null, view?: any) => {
    const safeSrc = sanitizeVideoUrlInput(src, { allowEmpty: true });
    if (safeSrc === null) return false;

    const { schema } = state;
    const videoType = schema.nodes.video;
    const paragraphType = schema.nodes.paragraph;

    if (!videoType) return false;

    if (dispatch) {
      const node = videoType.create({ src: safeSrc });
      const tr = state.tr.replaceSelectionWith(node);
      const preferredPos = typeof tr.mapping?.map === 'function'
        ? tr.mapping.map(state.selection.from, -1)
        : state.selection.from;
      const nodePos = findInsertedNodePos({
        doc: tr.doc,
        preferredPos,
        nodeTypeName: 'video',
      });
      moveSelectionAfterInsertedNode({
        tr,
        nodePos,
        insertedNodeFallback: node,
        paragraphType,
      });
      markEditorUserInput(view);
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
  remarkVideoImagesPlugin,
  videoSchema,
  videoMarkdownInputPlugin,
  videoNodeViewPlugin,
  insertVideoCommand,
];
