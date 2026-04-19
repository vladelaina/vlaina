import { $node, $command } from '@milkdown/kit/utils';
import type { VideoAttrs } from './types';
import { SANDBOXED_IFRAME_SANDBOX } from '../clipboard/sanitizer';

function parseVideoUrl(url: string): { type: 'youtube' | 'bilibili' | 'direct'; embedUrl: string } | null {
  const youtubeMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (youtubeMatch) {
    return {
      type: 'youtube',
      embedUrl: `https://www.youtube.com/embed/${youtubeMatch[1]}`
    };
  }
  
  const bilibiliMatch = url.match(/bilibili\.com\/video\/(BV[a-zA-Z0-9]+)/);
  if (bilibiliMatch) {
    return {
      type: 'bilibili',
      embedUrl: `https://player.bilibili.com/player.html?bvid=${bilibiliMatch[1]}&high_quality=1`
    };
  }
  
  if (url.match(/\.(mp4|webm|ogg)(\?.*)?$/i)) {
    return {
      type: 'direct',
      embedUrl: url
    };
  }
  
  return null;
}

function createVideoMessage(className: string, message: string): HTMLElement {
  const container = document.createElement('div');
  container.className = className;
  container.textContent = message;
  return container;
}

export const videoSchema = $node('video', () => ({
  group: 'block',
  atom: true,
  isolating: true,
  attrs: {
    src: { default: '' },
    title: { default: '' },
    width: { default: 560 },
    height: { default: 315 }
  },
  parseDOM: [{
    tag: 'div[data-type="video"]',
    getAttrs: (dom) => {
      const el = dom as HTMLElement;
      return {
        src: el.dataset.src || '',
        title: el.dataset.title || '',
        width: parseInt(el.dataset.width || '560', 10),
        height: parseInt(el.dataset.height || '315', 10)
      };
    }
  }],
  toDOM: (node) => {
    const attrs = node.attrs as VideoAttrs;
    const parsed = parseVideoUrl(attrs.src);
    
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-type', 'video');
    wrapper.setAttribute('data-src', attrs.src);
    wrapper.setAttribute('data-title', attrs.title || '');
    wrapper.setAttribute('data-width', String(attrs.width || 560));
    wrapper.setAttribute('data-height', String(attrs.height || 315));
    wrapper.className = 'video-block';
    
    if (!attrs.src) {
      wrapper.appendChild(createVideoMessage('video-placeholder', 'No video URL'));
      return wrapper;
    }
    
    if (!parsed) {
      wrapper.appendChild(createVideoMessage('video-error', `Unsupported video URL: ${attrs.src}`));
      return wrapper;
    }
    
    if (parsed.type === 'direct') {
      const video = document.createElement('video');
      video.src = parsed.embedUrl;
      video.controls = true;
      video.style.maxWidth = '100%';
      video.style.height = 'auto';
      if (attrs.title) video.title = attrs.title;
      wrapper.appendChild(video);
    } else {
      const iframe = document.createElement('iframe');
      iframe.src = parsed.embedUrl;
      iframe.width = String(attrs.width || 560);
      iframe.height = String(attrs.height || 315);
      iframe.frameBorder = '0';
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
      iframe.allowFullscreen = true;
      iframe.sandbox.value = SANDBOXED_IFRAME_SANDBOX;
      iframe.referrerPolicy = 'no-referrer';
      iframe.loading = 'lazy';
      if (attrs.title) iframe.title = attrs.title;
      wrapper.appendChild(iframe);
    }
    
    return wrapper;
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
    }
  },
  toMarkdown: {
    match: (node) => node.type.name === 'video',
    runner: (state, node) => {
      state.addNode('image', undefined, undefined, {
        url: node.attrs.src,
        title: node.attrs.title || undefined,
        alt: 'video'
      });
    }
  }
}));

export const insertVideoCommand = $command('insertVideo', () => (src: string = '') => {
  return (state: any, dispatch?: ((tr: any) => void) | null) => {
    const { schema } = state;
    const videoType = schema.nodes.video;
    
    if (!videoType) return false;
    
    if (dispatch) {
      const node = videoType.create({ src });
      const tr = state.tr.replaceSelectionWith(node);
      dispatch(tr.scrollIntoView());
    }
    
    return true;
  };
});

export const videoPlugin = [
  videoSchema,
  insertVideoCommand
];
