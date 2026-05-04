import type { VideoAttrs } from './types';
import { openExternalHref } from '@/lib/navigation/externalLinks';
import { getElectronBridge } from '@/lib/electron/bridge';
import {
  logVideoDebug,
  registerVideoDebugListeners,
} from './videoDebug';
import { parseVideoUrl } from './videoUrl';
import type { IframeVideoUrl } from './videoUrl';

let videoIframeIdCounter = 0;

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
  button.textContent = 'Open';
  button.title = 'Open video in browser';
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
  const debugId = ++videoIframeIdCounter;
  const createdAt = performance.now();
  const iframe = document.createElement('iframe');
  iframe.dataset.videoIframeDebugId = String(debugId);
  iframe.width = String(attrs.width || 560);
  iframe.height = String(attrs.height || 315);
  iframe.frameBorder = '0';
  iframe.allow = 'clipboard-write; encrypted-media; gyroscope; picture-in-picture';
  iframe.allowFullscreen = true;
  const referrerPolicy = 'strict-origin-when-cross-origin';
  iframe.referrerPolicy = referrerPolicy;
  iframe.setAttribute('referrerpolicy', referrerPolicy);
  iframe.setAttribute('scrolling', 'no');
  iframe.setAttribute('border', '0');
  iframe.setAttribute('framespacing', '0');
  iframe.loading = 'eager';
  if (attrs.title) iframe.title = attrs.title;

  const elapsedMs = () => Math.round((performance.now() - createdAt) * 100) / 100;
  let didLoad = false;
  iframe.addEventListener('load', () => {
    didLoad = true;
  });
  iframe.addEventListener('error', () => {
    logVideoDebug('iframe_error', {
      id: debugId,
      src: attrs.src,
      embedUrl: parsed.embedUrl,
      type: parsed.type,
      elapsedMs: elapsedMs(),
    });
  });
  if (parsed.type === 'youtube') {
    window.setTimeout(() => {
      if (didLoad || !iframe.isConnected) return;
      logVideoDebug('youtube_iframe_timeout', {
        id: debugId,
        src: attrs.src,
        embedUrl: parsed.embedUrl,
        iframeSrc: iframe.src,
        elapsedMs: elapsedMs(),
      });
      void getElectronBridge()?.media?.diagnoseUrl(parsed.embedUrl)
        .then((diagnostics) => {
          logVideoDebug('youtube_iframe_diagnostics', {
            id: debugId,
            src: attrs.src,
            embedUrl: parsed.embedUrl,
            diagnostics,
          });
        })
        .catch((error) => {
          logVideoDebug('youtube_iframe_diagnostics_error', {
            id: debugId,
            src: attrs.src,
            embedUrl: parsed.embedUrl,
            message: error instanceof Error ? error.message : String(error),
          });
        });
    }, 8000);
  }
  iframe.src = parsed.embedUrl;
  return iframe;
}

export function createVideoDom(attrs: VideoAttrs): HTMLElement {
  registerVideoDebugListeners();
  const parsed = parseVideoUrl(attrs.src);

  const wrapper = document.createElement('div');
  wrapper.setAttribute('data-type', 'video');
  wrapper.setAttribute('data-src', attrs.src);
  wrapper.setAttribute('data-title', attrs.title || '');
  wrapper.setAttribute('data-width', String(attrs.width || 560));
  wrapper.setAttribute('data-height', String(attrs.height || 315));
  wrapper.contentEditable = 'false';
  wrapper.className = 'video-block';

  if (!attrs.src) {
    logVideoDebug('render_empty_src', {
      attrs,
    });
    wrapper.appendChild(createVideoMessage('video-placeholder', 'No video URL'));
    return wrapper;
  }

  if (!parsed) {
    logVideoDebug('render_unsupported_src', {
      src: attrs.src,
    });
    wrapper.appendChild(createVideoMessage('video-error', `Unsupported video URL: ${attrs.src}`));
    return wrapper;
  }

  if (parsed.type === 'direct') {
    const video = document.createElement('video');
    video.src = parsed.embedUrl;
    video.controls = true;
    video.preload = 'none';
    video.style.maxWidth = '100%';
    video.style.height = 'auto';
    if (attrs.title) video.title = attrs.title;
    video.addEventListener('error', () => {
      logVideoDebug('direct_error', {
        src: attrs.src,
        embedUrl: parsed.embedUrl,
        errorCode: video.error?.code ?? null,
        errorMessage: video.error?.message ?? '',
      });
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
