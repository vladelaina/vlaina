import type { VideoAttrs } from './types';
import { openExternalHref } from '@/lib/navigation/externalLinks';
import { parseVideoUrl } from './videoUrl';
import type { IframeVideoUrl } from './videoUrl';
import { isPublicRemoteMediaUrl } from '@/lib/notes/markdown/urlSecurity';
import { translate } from '@/lib/i18n';
import { themeImageBlockStyleTokens } from '@/styles/themeTokens';

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
  iframe.loading = 'lazy';
  if (attrs.title) iframe.title = attrs.title;
  iframe.src = parsed.embedUrl;
  return iframe;
}

export function createVideoDom(attrs: VideoAttrs): HTMLElement {
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
    wrapper.appendChild(createVideoMessage('video-placeholder', translate('editor.video.noUrl')));
    return wrapper;
  }

  if (!parsed) {
    wrapper.appendChild(createVideoMessage('video-error', translate('editor.video.unsupportedUrl', { url: attrs.src })));
    return wrapper;
  }

  if (isPublicRemoteMediaUrl(parsed.embedUrl)) {
    wrapper.appendChild(createVideoMessage('video-placeholder', translate('editor.video.remoteBlocked')));
    wrapper.appendChild(createVideoExternalAction(attrs.src));
    return wrapper;
  }

  if (parsed.type === 'direct') {
    const video = document.createElement('video');
    video.src = parsed.embedUrl;
    video.controls = true;
    video.preload = 'none';
    video.style.maxWidth = themeImageBlockStyleTokens.maxWidthFull;
    video.style.height = themeImageBlockStyleTokens.heightAuto;
    if (attrs.title) video.title = attrs.title;
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
