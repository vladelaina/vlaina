import { memo, useMemo } from 'react';
import { OverlayScrollArea } from '@/components/ui/overlay-scroll-area';
import { cn } from '@/lib/utils';

function getGitDiffLineStatsFromLines(lines: string[]) {
  let additions = 0;
  let deletions = 0;
  for (const line of lines) {
    if (line.startsWith('+') && !line.startsWith('+++')) additions += 1;
    if (line.startsWith('-') && !line.startsWith('---')) deletions += 1;
  }
  return { additions, deletions };
}

export function getGitDiffLineStats(diff: string) {
  return getGitDiffLineStatsFromLines(diff.split('\n'));
}

interface GitDiffFileSection {
  path: string | null;
  lines: string[];
}

interface GitDiffLineRun {
  className: string;
  text: string;
}

function normalizeDiffPath(value: string) {
  const unquoted = value.startsWith('"') && value.endsWith('"')
    ? value.slice(1, -1)
    : value;
  return unquoted.replace(/^[ab]\//, '');
}

function getSectionPath(lines: string[]) {
  const pathLine = lines.find((line) => line.startsWith('rename to '))
    ?? lines.find((line) => line.startsWith('+++ ') && line !== '+++ /dev/null')
    ?? lines.find((line) => line.startsWith('--- ') && line !== '--- /dev/null');
  if (pathLine) return normalizeDiffPath(pathLine.replace(/^(rename to|\+\+\+|---) /, ''));

  const header = lines.find((line) => line.startsWith('diff --git '));
  if (!header) return null;
  const destinationMarker = header.lastIndexOf(' b/');
  return destinationMarker === -1 ? null : normalizeDiffPath(header.slice(destinationMarker + 1));
}

function getVisibleDiffLines(lines: string[]) {
  return lines.filter((line) => (
    !line.startsWith('diff --git ')
    && !line.startsWith('index ')
    && !line.startsWith('--- ')
    && !line.startsWith('+++ ')
    && !line.startsWith('@@')
  ));
}

export function splitGitDiffFiles(diff: string): GitDiffFileSection[] {
  if (!diff) return [];
  const sectionStarts = Array.from(diff.matchAll(/^diff --git /gm), (match) => match.index);
  const sections = sectionStarts.length === 0
    ? [diff]
    : sectionStarts.map((start, index) => diff.slice(start, sectionStarts[index + 1]));
  return sections.map((section) => {
    const lines = section.split('\n');
    return {
      path: getSectionPath(lines),
      lines: getVisibleDiffLines(lines),
    };
  });
}

function getDiffLineClass(line: string) {
  if (line.startsWith('+')) {
    return 'bg-[var(--vlaina-color-status-success-bg)] text-[var(--vlaina-color-status-success-fg)]';
  }
  if (line.startsWith('-')) {
    return 'bg-[var(--vlaina-color-status-danger-bg)] text-[var(--vlaina-color-status-danger-fg)]';
  }
  return 'text-[var(--vlaina-text-secondary)]';
}

export function groupGitDiffLineRuns(lines: string[]): GitDiffLineRun[] {
  const pendingRuns: Array<{ className: string; lines: string[] }> = [];
  for (const line of lines) {
    const className = getDiffLineClass(line);
    const text = line || ' ';
    const previous = pendingRuns[pendingRuns.length - 1];
    if (previous?.className === className) {
      previous.lines.push(text);
    } else {
      pendingRuns.push({ className, lines: [text] });
    }
  }
  return pendingRuns.map((run) => ({
    className: run.className,
    text: run.lines.join('\n'),
  }));
}

export const GitUnifiedDiff = memo(function GitUnifiedDiff({
  diff,
  loading,
  emptyLabel,
  showFileHeaders = false,
  onOpenFile,
}: {
  diff: string | string[];
  loading: boolean;
  emptyLabel: string;
  showFileHeaders?: boolean;
  onOpenFile?: (path: string) => void;
}) {
  const visibleSections = useMemo(() => {
    const sections = (Array.isArray(diff) ? diff : [diff]).flatMap(splitGitDiffFiles);
    const displayedSections = showFileHeaders
      ? sections
      : [{ path: null, lines: sections.flatMap((section) => section.lines) }];
    return displayedSections.map((section) => ({
      ...section,
      stats: getGitDiffLineStatsFromLines(section.lines),
    }));
  }, [diff, showFileHeaders]);
  const hasVisibleLines = visibleSections.some((section) => section.lines.length > 0);
  const showSeparateFileCards = showFileHeaders && hasVisibleLines && !loading;
  const diffSections = (
    <div className={cn('w-full', showFileHeaders && 'space-y-3')}>
      {visibleSections.map((section, sectionIndex) => {
        const lineRuns = groupGitDiffLineRuns(section.lines);
        const diffContent = (
          <pre
            data-git-selectable="true"
            className="min-w-max select-text py-2 font-mono text-[var(--vlaina-font-xs)] leading-5"
          >
            {lineRuns.map((run, runIndex) => (
              <span
                key={`${runIndex}:${run.className}`}
                data-git-diff-line-run="true"
                className={cn('block min-h-5 whitespace-pre px-3', run.className)}
              >
                {run.text}
              </span>
            ))}
          </pre>
        );
        return (
          <section
            key={`${section.path ?? 'diff'}:${sectionIndex}`}
            data-testid={showFileHeaders ? 'git-diff-file' : undefined}
            data-path={section.path ?? undefined}
            className={cn(
              showFileHeaders && 'overflow-hidden rounded-[var(--vlaina-radius-8px)] border border-[var(--border)] bg-[var(--vlaina-bg-secondary)]',
            )}
          >
            {showFileHeaders && section.path ? (
              <div className="flex min-w-full select-none items-center gap-3 border-b border-[var(--border)] bg-[var(--vlaina-bg-tertiary)] px-3 py-2">
                <button
                  type="button"
                  data-testid="git-open-diff-file"
                  onClick={() => section.path && onOpenFile?.(section.path)}
                  className="min-w-0 flex-1 truncate text-left font-mono text-[var(--vlaina-font-13)] font-medium text-[var(--vlaina-text-primary)] hover:text-[var(--vlaina-sidebar-row-selected-text)]"
                >
                  {section.path}
                </button>
                <span className="flex shrink-0 items-center gap-2 font-mono text-[var(--vlaina-font-xs)]">
                  <span className="text-[var(--vlaina-color-status-success-fg)]">+{section.stats.additions}</span>
                  <span className="text-[var(--vlaina-color-status-danger-fg)]">-{section.stats.deletions}</span>
                </span>
              </div>
            ) : null}
            {showFileHeaders ? (
              <div
                data-testid="git-diff-file-scroll"
                className="h-[var(--vlaina-size-180px)] flex-none overflow-auto app-scrollbar"
              >
                {diffContent}
              </div>
            ) : diffContent}
          </section>
        );
      })}
    </div>
  );

  return (
    <div
      data-testid="git-diff"
      className={cn(
        'flex min-h-0 flex-1',
        showSeparateFileCards ? 'w-full flex-col overflow-visible' : 'overflow-hidden',
        !showSeparateFileCards && 'rounded-[var(--vlaina-radius-8px)] border border-[var(--border)] bg-[var(--vlaina-bg-secondary)]',
      )}
    >
      {loading || !hasVisibleLines ? (
        <div className="flex min-h-[var(--vlaina-size-160px)] flex-1 items-center justify-center px-4 text-center text-[var(--vlaina-font-13)] text-[var(--vlaina-text-tertiary)]">
          {emptyLabel}
        </div>
      ) : showFileHeaders ? diffSections : (
        <OverlayScrollArea
          data-testid="git-diff-scroll"
          viewportClassName="overflow-x-auto"
        >
          {diffSections}
        </OverlayScrollArea>
      )}
    </div>
  );
});
