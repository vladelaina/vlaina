import { useI18n } from '@/lib/i18n';
import { openExternalHref } from '@/lib/navigation/externalLinks';
import { isPublicRemoteMediaUrl } from '@/lib/notes/markdown/urlSecurity';
import { parseVideoUrl } from '@/lib/markdown/videoUrl';
import { themeDomStyleTokens } from '@/styles/themeTokens';

interface ReadOnlyVideoBlockProps {
  src: string;
  title?: string;
  width?: number;
  height?: number;
}

export function ReadOnlyVideoBlock({
  src,
  title = '',
  width = themeDomStyleTokens.iframeDefaultWidth,
  height = themeDomStyleTokens.iframeDefaultHeight,
}: ReadOnlyVideoBlockProps) {
  const { t } = useI18n();
  const parsed = parseVideoUrl(src);

  if (!src || !parsed) {
    return (
      <div
        className="video-block"
        data-type="video"
        data-chat-selection-excluded="true"
      >
        <div className="video-error">
          {src ? t('editor.video.unsupportedUrl', { url: src }) : t('editor.video.noUrl')}
        </div>
      </div>
    );
  }

  if (parsed.type !== 'direct' && isPublicRemoteMediaUrl(parsed.embedUrl)) {
    return (
      <div
        className="video-block"
        data-type="video"
        data-chat-selection-excluded="true"
      >
        <div className="video-placeholder">{t('editor.video.remoteBlocked')}</div>
        <button
          type="button"
          className="video-external-action"
          onClick={() => {
            void openExternalHref(src);
          }}
        >
          {t('editor.video.open')}
        </button>
      </div>
    );
  }

  if (parsed.type === 'direct') {
    return (
      <div
        className="video-block"
        data-type="video"
        data-chat-selection-excluded="true"
      >
        <video src={parsed.embedUrl} controls preload="none" title={title || undefined} />
      </div>
    );
  }

  return (
    <div
      className="video-block"
      data-type="video"
      data-chat-selection-excluded="true"
    >
      <iframe
        width={width}
        height={height}
        frameBorder={themeDomStyleTokens.iframeFrameBorder}
        allow="clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        sandbox="allow-scripts allow-presentation"
        referrerPolicy="strict-origin-when-cross-origin"
        scrolling={themeDomStyleTokens.iframeScrollingNone}
        loading={themeDomStyleTokens.iframeLoadingLazy}
        title={title || parsed.type}
        src={parsed.embedUrl}
      />
      {parsed.type === 'youtube' && (
        <button
          type="button"
          className="video-external-action"
          onClick={() => {
            void openExternalHref(src);
          }}
        >
          {t('editor.video.open')}
        </button>
      )}
    </div>
  );
}
