import { Button } from '@/components/ui/button';
import { DialogCloseIconButton } from '@/components/common/DialogCloseIconButton';
import { Icon } from '@/components/ui/icons';
import { OverlayScrollArea } from '@/components/ui/overlay-scroll-area';
import { PopoverContent } from '@/components/ui/popover';
import {
  raisedPillSurfaceClass,
  secondaryPillButtonClass,
  raisedPopoverSurfaceClass,
} from '@/components/ui/surfaceStyles';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { themeDomStyleTokens } from '@/styles/themeTokens';
import type { useGitPanelController } from './useGitPanelController';
import { GitChangesView } from './GitChangesView';
import { GitHistoryView } from './GitHistoryView';

type GitPanelController = ReturnType<typeof useGitPanelController>;

export function GitSyncPopover({
  controller,
  onClose,
}: {
  controller: GitPanelController;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const status = controller.status;
  const busy = controller.operation !== null;
  const remoteUnavailable = !status?.remoteUrl;
  const pullUnavailable = remoteUnavailable || !status?.upstream;
  const changeCount = status?.changes.length ?? 0;
  const commitsToPull = status?.behind ?? 0;
  const commitsToPush = status?.ahead ?? 0;
  const pulling = controller.operation === 'pull';
  const pushing = controller.operation === 'push';

  return (
    <PopoverContent
      data-testid="git-sync-popover"
      aria-label={t('git.sync')}
      align="center"
      side="bottom"
      sideOffset={themeDomStyleTokens.editorPopupAnchorOffsetPx}
      className={cn(
        'app-no-drag flex h-[var(--vlaina-height-git-popover)] w-[var(--vlaina-width-git-popover)] flex-col overflow-hidden rounded-[var(--vlaina-notes-ui-radius-panel)] p-0 backdrop-blur-[var(--vlaina-backdrop-blur-lg)] data-[state=open]:duration-[var(--vlaina-duration-200)] data-[state=closed]:duration-[var(--vlaina-duration-75)]',
        raisedPopoverSurfaceClass,
      )}
    >
        <div className="select-none border-b border-[var(--border)] p-4">
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-[var(--vlaina-font-13)] text-[var(--vlaina-text-secondary)]">
            <span data-testid="git-branch" className="max-w-full truncate font-medium">
              {controller.statusLoading
                ? t('git.loading')
                : status?.branch || '—'}
            </span>
            <Button
              type="button"
              data-testid="git-pull-button"
              variant="ghost"
              size="sm"
              className={cn('ml-auto', secondaryPillButtonClass)}
              disabled={busy || controller.statusLoading || pullUnavailable}
              aria-busy={pulling}
              onClick={controller.pull}
            >
              <Icon name={pulling ? 'common.refresh' : 'common.download'} className={pulling ? 'animate-spin' : undefined} />
              {commitsToPull > 0 ? `${t('git.pull')} (${commitsToPull})` : t('git.pull')}
            </Button>
            <Button
              type="button"
              data-testid="git-push-button"
              variant="ghost"
              size="sm"
              className={commitsToPush > 0
                ? "h-9 rounded-full bg-[var(--primary)] px-4 text-[var(--primary-foreground)] shadow-[var(--vlaina-shadow-md)] transition-[background-color,color,box-shadow,transform] duration-[var(--vlaina-duration-200)] hover:scale-[var(--vlaina-scale-105)] hover:bg-[var(--vlaina-color-accent-hover)] hover:text-[var(--primary-foreground)] active:scale-[var(--vlaina-scale-95)] disabled:bg-[var(--vlaina-bg-secondary)] disabled:text-[var(--vlaina-color-text-disabled)] disabled:shadow-[var(--vlaina-shadow-none)] disabled:hover:scale-[var(--vlaina-scale-100)]"
                : secondaryPillButtonClass}
              disabled={busy || controller.statusLoading || remoteUnavailable}
              aria-busy={pushing}
              onClick={controller.push}
            >
              <Icon name={pushing ? 'common.refresh' : 'common.upload'} className={pushing ? 'animate-spin' : undefined} />
              {commitsToPush > 0 ? `${t('git.push')} (${commitsToPush})` : t('git.push')}
            </Button>
            <DialogCloseIconButton
              data-testid="git-close-button"
              onClick={onClose}
              label={t('common.close')}
            />
          </div>

          {status && remoteUnavailable ? (
            <p className="mt-1 text-[var(--vlaina-font-11)] text-[var(--vlaina-color-status-warning-fg)]">
              {t('git.noRemote')}
            </p>
          ) : null}
        </div>

        {changeCount > 0 ? (
          <div
            role="tablist"
            className={cn(
              'relative mx-4 my-3 flex h-11 shrink-0 select-none items-center rounded-[var(--vlaina-notes-ui-radius-group)] p-1.5',
              raisedPillSurfaceClass,
            )}
          >
            <span
              data-testid="git-tab-active-background"
              aria-hidden="true"
              className={cn(
                'absolute inset-y-1.5 left-1.5 w-[var(--vlaina-width-git-tab-active)] rounded-full bg-[var(--vlaina-sidebar-row-selected-bg)] shadow-[var(--vlaina-shadow-selection-soft)] transition-transform duration-[var(--vlaina-duration-300)] ease-[var(--vlaina-ease-feedback)] motion-reduce:transition-none',
                controller.activeTab === 'history' && 'translate-x-full',
              )}
            />
            {(['changes', 'history'] as const).map((tab) => {
              const selected = controller.activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  data-testid={tab === 'history' ? 'git-history-tab' : 'git-changes-tab'}
                  aria-selected={selected}
                  onClick={() => controller.setActiveTab(tab)}
                  className={cn(
                    'relative z-[var(--vlaina-z-10)] flex h-8 min-w-0 flex-1 items-center justify-center rounded-full px-3 text-[var(--vlaina-font-13)] font-medium transition-colors duration-[var(--vlaina-duration-300)]',
                    selected
                      ? 'text-[var(--vlaina-sidebar-row-selected-text)]'
                      : 'text-[var(--vlaina-sidebar-notes-text)] hover:text-[var(--vlaina-sidebar-row-selected-text)]',
                  )}
                >
                  {tab === 'changes' ? `${t('git.changes')} (${changeCount})` : t('git.history')}
                </button>
              );
            })}
          </div>
        ) : null}

        <OverlayScrollArea data-testid="git-popover-scroll" className="min-h-0 flex-1">
          {changeCount > 0 && controller.activeTab === 'changes' ? (
            <GitChangesView
              changes={status?.changes ?? []}
              diffByPath={controller.workingDiffByPath}
              diffLoading={controller.workingDiffLoading}
              commitMessage={controller.commitMessage}
              selectedCommitPaths={controller.selectedCommitPaths}
              busy={busy}
              onCommitMessageChange={controller.setCommitMessage}
              onUseCurrentTime={controller.useCurrentTimeAsMessage}
              onToggleCommitPath={controller.toggleCommitPath}
              onToggleAllCommitPaths={controller.toggleAllCommitPaths}
              onCommit={controller.commit}
            />
          ) : (
            <GitHistoryView
              history={controller.history}
              historyLoading={controller.historyLoading}
              selectedHash={controller.selectedCommitHash}
              diff={controller.selectedCommitDiff}
              diffLoading={controller.commitDiffLoading}
              onSelectCommit={controller.selectCommit}
            />
          )}
        </OverlayScrollArea>
    </PopoverContent>
  );
}
