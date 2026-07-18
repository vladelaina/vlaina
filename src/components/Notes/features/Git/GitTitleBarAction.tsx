import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  chatComposerGhostIconButtonClass,
  chatComposerPillSurfaceClass,
} from '@/components/Chat/features/Input/composerStyles';
import { Icon } from '@/components/ui/icons';
import { Popover, PopoverAnchor, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { useNotesStore } from '@/stores/useNotesStore';
import { useNotesRootStore } from '@/stores/useNotesRootStore';
import { themeDomStyleTokens } from '@/styles/themeTokens';
import type { GitBridge } from './gitUiTypes';
import { getGitBridge } from './gitUiTypes';
import { GitSyncPopover } from './GitSyncPopover';
import { useGitPanelController } from './useGitPanelController';

function ConnectedGitTitleBarAction({ git, rootPath }: { git: GitBridge; rootPath: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const controller = useGitPanelController({ git, rootPath, open });

  useEffect(() => {
    if (!open) return;
    document.body.setAttribute('data-git-selection-active', 'true');
    return () => {
      document.body.removeAttribute('data-git-selection-active');
    };
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <PopoverTrigger asChild>
          <TooltipTrigger asChild>
            <button
              type="button"
              data-testid="git-sync-button"
              aria-label={t('git.sync')}
              className={cn(
                'app-no-drag flex size-[var(--vlaina-size-28px)] items-center justify-center text-[var(--vlaina-color-titlebar-button)] hover:text-[var(--vlaina-color-titlebar-button-hover)]',
                chatComposerGhostIconButtonClass,
              )}
            >
              <Icon name="common.gitBranch" className="size-[var(--vlaina-size-18px)]" />
            </button>
          </TooltipTrigger>
        </PopoverTrigger>
        <TooltipContent
          side="bottom"
          sideOffset={themeDomStyleTokens.toolbarTooltipOffsetPx}
          showArrow={false}
          className={cn(
            'flex items-center gap-1.5 rounded-[var(--vlaina-radius-18px)] px-3 py-2 text-xs text-[var(--vlaina-sidebar-chat-text)]',
            chatComposerPillSurfaceClass,
          )}
        >
          {t('git.sync')}
        </TooltipContent>
      </Tooltip>

      {createPortal(
        <PopoverAnchor
          aria-hidden="true"
          className="pointer-events-none fixed left-0 top-10 block h-0 w-screen"
        />,
        document.body,
      )}
      <GitSyncPopover controller={controller} onClose={() => setOpen(false)} />
    </Popover>
  );
}

function DetectedGitTitleBarAction({ git, rootPath }: { git: GitBridge; rootPath: string }) {
  const [isRepository, setIsRepository] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsRepository(false);
    void git.status(rootPath).then((status) => {
      if (!cancelled) setIsRepository(Boolean(status));
    }).catch(() => {
      if (!cancelled) setIsRepository(false);
    });
    return () => {
      cancelled = true;
    };
  }, [git, rootPath]);

  if (!isRepository) return null;
  return <ConnectedGitTitleBarAction git={git} rootPath={rootPath} />;
}

export function GitTitleBarAction() {
  const currentNotesRootPath = useNotesRootStore((state) => state.currentNotesRoot?.path ?? null);
  const notesPath = useNotesStore((state) => state.notesPath);
  const rootFolderPath = useNotesStore((state) => state.rootFolderPath);
  const git = getGitBridge();
  const isCurrentLoadedRoot = Boolean(
    git &&
    currentNotesRootPath &&
    notesPath === currentNotesRootPath &&
    rootFolderPath === currentNotesRootPath,
  );

  if (!git || !currentNotesRootPath || !isCurrentLoadedRoot) return null;

  return <DetectedGitTitleBarAction key={currentNotesRootPath} git={git} rootPath={currentNotesRootPath} />;
}
