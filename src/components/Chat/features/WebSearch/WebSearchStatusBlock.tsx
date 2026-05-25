import { Icon } from '@/components/ui/icons';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';
import type { WebSearchStatus } from '@/lib/ai/webSearch/types';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface WebSearchStatusBlockProps {
  statuses: WebSearchStatus[];
  isWaitingForAnswer?: boolean;
}

function phaseLabel(status: WebSearchStatus): string {
  if (status.phase === 'searching') return 'Searching';
  if (status.phase === 'results') return 'Search results';
  if (status.phase === 'reading') return 'Reading pages';
  if (status.phase === 'complete') return 'Sources read';
  return 'Web search';
}

function metricsLabel(status: WebSearchStatus): string {
  const metrics = status.metrics;
  if (!metrics) return '';

  if (typeof metrics.successCount === 'number' || typeof metrics.failureCount === 'number') {
    const failureCount = metrics.failureCount ?? 0;
    return failureCount > 0 ? `${failureCount} skipped` : '';
  }

  if (typeof metrics.resultCount === 'number') return '';

  return '';
}

function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function uniqueUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  return urls.filter((url) => {
    if (seen.has(url)) return false;
    seen.add(url);
    return true;
  });
}

function shouldShowStatusMessage(status: WebSearchStatus): boolean {
  if (!status.message) return false;
  if (status.phase === 'error' && status.message === 'No relevant results were found.') return false;
  return true;
}

export function WebSearchStatusBlock({ statuses, isWaitingForAnswer = false }: WebSearchStatusBlockProps) {
  const { t } = useI18n();
  const status = statuses[statuses.length - 1];
  if (!status) return null;
  const latestResults = [...statuses].reverse().find((item) => item.results?.length)?.results ?? [];
  const metricsText = metricsLabel(status);
  const isSearching = isWaitingForAnswer;
  const showStatusMessage = shouldShowStatusMessage(status);
  const sourceUrls = uniqueUrls(
    latestResults.length > 0
      ? latestResults.map((result) => result.url)
      : status.urls ?? [],
  );

  return (
    <div
      data-chat-selection-excluded="true"
      className={cn(
        'mb-3 max-w-full select-none rounded-[22px] px-3 py-2 text-[12px] text-[var(--vlaina-text-secondary)]',
        chatComposerPillSurfaceClass,
      )}
    >
      <div className="flex items-center gap-2 font-medium text-[var(--vlaina-text-primary)]">
        <span className="relative flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--vlaina-accent-light)] text-[var(--vlaina-accent)]">
          {isSearching && (
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-full border border-transparent border-t-[var(--vlaina-accent)] animate-spin"
            />
          )}
          <Icon name="file.public" size={14} />
        </span>
        <span>{phaseLabel(status)}</span>
        {status.query && <span className="min-w-0 truncate text-[var(--vlaina-text-tertiary)]">"{status.query}"</span>}
        {metricsText && <span className="ml-auto shrink-0 text-[var(--vlaina-text-tertiary)]">{metricsText}</span>}
      </div>

      {showStatusMessage && (
        <div className="mt-1 text-[var(--vlaina-text-tertiary)]">{status.message}</div>
      )}

      {sourceUrls.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {sourceUrls.slice(0, 6).map((url) => {
            return (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-7 max-w-[220px] cursor-pointer items-center gap-1.5 rounded-full bg-[var(--vlaina-accent-light)] px-2.5 text-[12px] font-medium text-[var(--vlaina-accent)] transition-opacity hover:opacity-80"
              >
                <span className="min-w-0 truncate">{hostLabel(url)}</span>
                <Icon name="nav.external" size={12} />
              </a>
            );
          })}
        </div>
      )}

      {status.failedSources && status.failedSources.length > 0 && (
        <div className="mt-2 space-y-1 text-[var(--vlaina-text-tertiary)]">
          <div className="font-medium text-[var(--vlaina-text-secondary)]">{t('chat.skippedSources')}</div>
          {status.failedSources.slice(0, 4).map((source) => (
            <div key={source.url} className="flex min-w-0 gap-2">
              <span className="shrink-0">{source.message}</span>
              <span className="min-w-0 truncate">{source.url}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
