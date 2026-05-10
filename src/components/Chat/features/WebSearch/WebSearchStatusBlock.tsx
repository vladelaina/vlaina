import { Icon } from '@/components/ui/icons';
import type { WebSearchStatus } from '@/lib/ai/webSearch/types';

interface WebSearchStatusBlockProps {
  statuses: WebSearchStatus[];
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
    const successCount = metrics.successCount ?? 0;
    const failureCount = metrics.failureCount ?? 0;
    const parts = [`${successCount} read`];
    if (failureCount > 0) parts.push(`${failureCount} skipped`);
    return parts.join(' · ');
  }

  if (typeof metrics.resultCount === 'number') return '';

  return '';
}

export function WebSearchStatusBlock({ statuses }: WebSearchStatusBlockProps) {
  const status = statuses[statuses.length - 1];
  if (!status) return null;
  const latestResults = [...statuses].reverse().find((item) => item.results?.length)?.results ?? [];
  const metricsText = metricsLabel(status);

  return (
    <div
      data-chat-selection-excluded="true"
      className="mb-3 max-w-full select-none rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-[12px] text-zinc-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300"
    >
      <div className="flex items-center gap-2 font-medium text-zinc-900 dark:text-zinc-100">
        <Icon name="file.public" size="sm" />
        <span>{phaseLabel(status)}</span>
        {status.query && <span className="min-w-0 truncate text-zinc-500 dark:text-zinc-400">"{status.query}"</span>}
        {metricsText && <span className="ml-auto shrink-0 text-zinc-400 dark:text-zinc-500">{metricsText}</span>}
      </div>

      {status.message && (
        <div className="mt-1 text-zinc-500 dark:text-zinc-400">{status.message}</div>
      )}

      {latestResults.length > 0 && (
        <div className="mt-2 space-y-1">
          {latestResults.slice(0, 5).map((result) => (
            <a
              key={result.url}
              href={result.url}
              target="_blank"
              rel="noreferrer"
              className="block min-w-0 truncate text-[#1677c8] hover:underline dark:text-[#7cc7ff]"
            >
              {result.title}
            </a>
          ))}
        </div>
      )}

      {status.urls && status.urls.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {status.urls.slice(0, 6).map((url) => (
            <span
              key={url}
              className="max-w-[260px] truncate rounded bg-white px-2 py-1 text-zinc-500 dark:bg-white/5 dark:text-zinc-400"
            >
              {url}
            </span>
          ))}
        </div>
      )}

      {status.failedSources && status.failedSources.length > 0 && (
        <div className="mt-2 space-y-1 text-zinc-500 dark:text-zinc-400">
          <div className="font-medium text-zinc-600 dark:text-zinc-300">Skipped sources</div>
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
