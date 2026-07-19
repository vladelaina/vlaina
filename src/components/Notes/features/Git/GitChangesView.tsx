import { useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/components/ui/icons';
import { OverlayScrollArea } from '@/components/ui/overlay-scroll-area';
import { secondaryPillButtonClass } from '@/components/ui/surfaceStyles';
import { SettingsTextarea } from '@/components/Settings/components/SettingsFields';
import { useI18n } from '@/lib/i18n';
import { useNotesStore } from '@/stores/useNotesStore';
import type { GitChange } from './gitUiTypes';
import { getGitChangeKind } from './gitUiTypes';
import { getGitDiffLineStats, GitUnifiedDiff } from './GitUnifiedDiff';

interface GitChangesViewProps {
  changes: GitChange[];
  diffByPath: Record<string, string>;
  diffLoading: boolean;
  commitMessage: string;
  selectedCommitPaths: Set<string>;
  busy: boolean;
  onCommitMessageChange: (message: string) => void;
  onUseCurrentTime: () => void;
  onToggleCommitPath: (path: string) => void;
  onToggleAllCommitPaths: () => void;
  onCommit: () => void;
}

export function GitChangesView({
  changes,
  diffByPath,
  diffLoading,
  commitMessage,
  selectedCommitPaths,
  busy,
  onCommitMessageChange,
  onUseCurrentTime,
  onToggleCommitPath,
  onToggleAllCommitPaths,
  onCommit,
}: GitChangesViewProps) {
  const { t } = useI18n();
  const openNote = useNotesStore((state) => state.openNote);
  const fileDiffs = useMemo(
    () => changes.map((change) => diffByPath[change.path] ?? ''),
    [changes, diffByPath],
  );
  const selectedCount = useMemo(
    () => changes.filter((change) => selectedCommitPaths.has(change.path)).length,
    [changes, selectedCommitPaths],
  );
  const statsByPath = useMemo(
    () => Object.fromEntries(changes.map((change) => [
      change.path,
      getGitDiffLineStats(diffByPath[change.path] ?? ''),
    ])),
    [changes, diffByPath],
  );
  const handleOpenFile = useCallback((path: string) => {
    void openNote(path).catch(() => undefined);
  }, [openNote]);
  const hasLoadedDiff = useMemo(() => fileDiffs.some(Boolean), [fileDiffs]);
  const changeRows = useMemo(() => changes.map((change) => {
    const kind = getGitChangeKind(change);
    const selectedForCommit = selectedCommitPaths.has(change.path);
    const stats = statsByPath[change.path];
    return (
      <div
        key={`${change.previousPath ?? ''}:${change.path}`}
        data-testid="git-change-row"
        data-path={change.path}
        className="flex w-full min-w-0 items-center gap-2 rounded-[var(--vlaina-radius-8px)] px-3 py-2 text-left text-[var(--vlaina-text-secondary)]"
      >
        <Checkbox
          data-testid="git-change-checkbox"
          data-path={change.path}
          checked={selectedForCommit}
          onCheckedChange={() => onToggleCommitPath(change.path)}
          aria-label={change.path}
        />
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <button
            type="button"
            data-testid="git-open-file"
            disabled={kind === 'deleted'}
            onClick={() => handleOpenFile(change.path)}
            className="min-w-0 truncate text-left font-mono text-[var(--vlaina-font-13)] hover:text-[var(--vlaina-sidebar-row-selected-text)] disabled:cursor-default disabled:hover:text-inherit"
          >
            {change.previousPath ? `${change.previousPath} → ${change.path}` : change.path}
          </button>
          <span className="ml-auto flex shrink-0 items-center gap-2 font-mono text-[var(--vlaina-font-xs)]">
            <span className="text-[var(--vlaina-color-status-success-fg)]">+{stats.additions}</span>
            <span className="text-[var(--vlaina-color-status-danger-fg)]">-{stats.deletions}</span>
          </span>
        </span>
      </div>
    );
  }), [changes, handleOpenFile, onToggleCommitPath, selectedCommitPaths, statsByPath]);
  if (changes.length === 0) {
    return <div data-testid="git-changes-empty" />;
  }

  const allSelected = changes.length > 0 && selectedCount === changes.length;
  const selectionState = allSelected ? true : selectedCount > 0 ? 'indeterminate' : false;
  const canCommit = selectedCount > 0 && commitMessage.trim().length > 0 && !busy;
  const diffLabel = diffLoading ? t('git.loading') : t('git.diffEmpty');

  return (
    <div className="flex flex-col">
      <form
        className="shrink-0 select-none space-y-3 border-b border-[var(--border)] p-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (canCommit) onCommit();
        }}
      >
        <label className="block text-[var(--vlaina-font-13)] font-medium text-[var(--vlaina-text-primary)]">
          <span className="mb-1.5 block">{t('git.commitMessage')}</span>
          <SettingsTextarea
            data-testid="git-commit-message"
            data-git-selectable="true"
            value={commitMessage}
            onChange={(event) => onCommitMessageChange(event.target.value)}
            placeholder={t('git.commitMessagePlaceholder')}
            rows={2}
            textareaClassName="select-text resize-none"
          />
        </label>

        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            data-testid="git-use-current-time"
            variant="ghost"
            size="sm"
            className={secondaryPillButtonClass}
            onClick={onUseCurrentTime}
          >
            <Icon name="misc.clock" />
            {t('git.currentTime')}
          </Button>
          <Button
            type="submit"
            data-testid="git-commit-button"
            size="sm"
            disabled={!canCommit}
          >
            {t('git.commit')}
          </Button>
        </div>
      </form>

      <div className="shrink-0 select-none border-b border-[var(--border)] p-4">
        <OverlayScrollArea className="max-h-[var(--vlaina-size-180px)]">
          <div className="space-y-1 pr-2">
              <div className="flex items-center gap-2 px-3 py-1.5">
                <Checkbox
                  data-testid="git-select-all"
                  checked={selectionState}
                  onCheckedChange={onToggleAllCommitPaths}
                  aria-label={t('git.selectAll')}
                />
                <button
                  type="button"
                  onClick={onToggleAllCommitPaths}
                  className="text-[var(--vlaina-font-13)] font-medium text-[var(--vlaina-text-secondary)] hover:text-[var(--vlaina-text-primary)]"
                >
                  {t('git.selectAll')}
                </button>
                <span className="ml-auto text-[var(--vlaina-font-11)] text-[var(--vlaina-text-tertiary)]">
                  {t('git.selectedCount', { selected: selectedCount, total: changes.length })}
                </span>
              </div>
              {changeRows}
          </div>
        </OverlayScrollArea>
      </div>

      <div className="flex p-4">
        <GitUnifiedDiff
          diff={fileDiffs}
          loading={diffLoading && !hasLoadedDiff}
          emptyLabel={diffLabel}
          showFileHeaders
          onOpenFile={handleOpenFile}
        />
      </div>
    </div>
  );
}
