import type { VideoAttrs } from './types';
import { openExternalHref } from '@/lib/navigation/externalLinks';
import { parseVideoUrl } from './videoUrl';
import type { IframeVideoUrl } from './videoUrl';
import { translate } from '@/lib/i18n';
import { themeImageBlockStyleTokens } from '@/styles/themeTokens';

const videoElementAttrs = new WeakMap<HTMLElement, VideoAttrs>();
const DEFAULT_VIDEO_WIDTH = 560;
const DEFAULT_VIDEO_HEIGHT = 315;
const MAX_VIDEO_TITLE_CHARS = 256;
const MAX_VIDEO_DIMENSION_CHARS = 32;
const MAX_VIDEO_DIMENSION = 4096;
const VIDEO_DIMENSION_PATTERN = /^(?:\d+(?:\.\d+)?|\.\d+)$/;
const VIDEO_IFRAME_ALLOW = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
const VIDEO_IFRAME_SANDBOX = 'allow-scripts allow-same-origin allow-presentation allow-popups';

function normalizeVideoTitle(value: unknown): string {
  return typeof value === 'string' ? value.slice(0, MAX_VIDEO_TITLE_CHARS) : '';
}

function parseVideoDimension(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value !== 'string' || value.length > MAX_VIDEO_DIMENSION_CHARS) {
    return NaN;
  }
  const trimmed = value.trim();
  return VIDEO_DIMENSION_PATTERN.test(trimmed) ? Number(trimmed) : NaN;
}

function normalizeVideoSize(value: unknown, fallback: number) {
  const parsed = parseVideoDimension(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  const integer = Math.trunc(parsed);
  if (integer <= 0) return fallback;
  return Math.min(integer, MAX_VIDEO_DIMENSION);
}

export function normalizeVideoAttrs(attrs: VideoAttrs): VideoAttrs {
  return {
    src: typeof attrs.src === 'string' ? attrs.src : '',
    title: normalizeVideoTitle(attrs.title),
    width: normalizeVideoSize(attrs.width, DEFAULT_VIDEO_WIDTH),
    height: normalizeVideoSize(attrs.height, DEFAULT_VIDEO_HEIGHT),
  };
}

export function setVideoElementAttrs(element: HTMLElement, attrs: VideoAttrs) {
  videoElementAttrs.set(element, normalizeVideoAttrs(attrs));
  delete element.dataset.src;
  delete element.dataset.title;
}

export function getVideoElementAttrs(element: HTMLElement): VideoAttrs {
  const attrs = videoElementAttrs.get(element);
  if (attrs) {
    return attrs;
  }
  return {
    src: element.dataset.src || '',
    title: normalizeVideoTitle(element.dataset.title),
    width: normalizeVideoSize(element.dataset.width, DEFAULT_VIDEO_WIDTH),
    height: normalizeVideoSize(element.dataset.height, DEFAULT_VIDEO_HEIGHT),
  };
}

function createVideoMessage(className: string, message: string): HTMLElement {
  const container = document.createElement('div');
  container.className = className;
  container.textContent = message;
  return container;
}

function createVideoExternalAction(url: string): HTMLElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'video-external-action';
  button.textContent = translate('editor.video.open');
  button.title = translate('editor.video.openInBrowser');
  button.contentEditable = 'false';
  button.addEventListener('mousedown', (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    void openExternalHref(url);
  });
  return button;
}

function createVideoIframe(args: {
  attrs: VideoAttrs;
  parsed: IframeVideoUrl;
}): HTMLIFrameElement {
  const { attrs, parsed } = args;
  const iframe = document.createElement('iframe');
  iframe.width = String(attrs.width || DEFAULT_VIDEO_WIDTH);
  iframe.height = String(attrs.height || DEFAULT_VIDEO_HEIGHT);
  iframe.frameBorder = '0';
  iframe.allow = VIDEO_IFRAME_ALLOW;
  iframe.setAttribute('allow', VIDEO_IFRAME_ALLOW);
  iframe.allowFullscreen = true;
  const referrerPolicy = 'strict-origin-when-cross-origin';
  iframe.referrerPolicy = referrerPolicy;
  iframe.setAttribute('referrerpolicy', referrerPolicy);
  iframe.setAttribute('sandbox', VIDEO_IFRAME_SANDBOX);
  iframe.setAttribute('scrolling', 'no');
  iframe.setAttribute('border', '0');
  iframe.setAttribute('framespacing', '0');
  iframe.loading = 'lazy';
  iframe.title = parsed.type;
  iframe.src = parsed.embedUrl;
  return iframe;
}

export function createVideoDom(attrs: VideoAttrs): HTMLElement {
  attrs = normalizeVideoAttrs(attrs);
  const parsed = parseVideoUrl(attrs.src);

  const wrapper = document.createElement('div');
  wrapper.setAttribute('data-type', 'video');
  setVideoElementAttrs(wrapper, attrs);
  wrapper.setAttribute('data-width', String(attrs.width || DEFAULT_VIDEO_WIDTH));
  wrapper.setAttribute('data-height', String(attrs.height || DEFAULT_VIDEO_HEIGHT));
  wrapper.contentEditable = 'false';
  wrapper.className = 'video-block';

  if (!attrs.src) {
    wrapper.appendChild(createVideoMessage('video-placeholder', translate('editor.video.noUrl')));
    return wrapper;
  }

  if (!parsed) {
    wrapper.appendChild(createVideoMessage('video-error', translate('editor.video.unsupportedUrl', { url: attrs.src })));
    return wrapper;
  }

  if (parsed.type === 'direct') {
    const video = document.createElement('video');
    video.src = parsed.embedUrl;
    video.controls = true;
    video.preload = 'none';
    video.style.maxWidth = themeImageBlockStyleTokens.maxWidthFull;
    video.style.height = themeImageBlockStyleTokens.heightAuto;
    video.addEventListener('error', () => {
    });
    wrapper.appendChild(video);
  } else {
    wrapper.appendChild(createVideoIframe({ attrs, parsed }));
    if (parsed.type === 'youtube') {
      wrapper.appendChild(createVideoExternalAction(attrs.src));
    }
  }

  return wrapper;
}
