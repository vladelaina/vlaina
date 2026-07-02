import { useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { themeIconTokens, themeSidebarTokens } from '@/styles/themeTokens';
import {
  getSidebarLabelClass,
  getSidebarSoftTextClass,
} from '@/components/layout/sidebar/sidebarLabelStyles';
import type { VaultInfo } from '@/stores/useVaultStore';
import { NotesSidebarRow } from './NotesSidebarRow';
import { NotesSidebarPillEmptyHint } from './NotesSidebarPrimitives';

interface SidebarEmptyWorkspacePanelProps {
  folderLabel: string;
  openFileLabel: string;
  openFolderLabel: string;
  recentVaults: VaultInfo[];
  onOpenFile: () => void;
  onOpenFolder: () => void;
  onOpenRecentVault: (path: string) => void;
}

interface ActiveRecentVaultHint {
  path: string;
  left: number;
  top: number;
  placement: 'top' | 'bottom';
}

export const EMPTY_WORKSPACE_RECENT_VAULT_DISPLAY_LIMIT = 8;

export function getEmptyWorkspaceRecentVaults(
  recentVaults: VaultInfo[],
  currentVaultPath: string | null | undefined,
) {
  return recentVaults
    .filter((vault) => vault.path !== currentVaultPath)
    .slice(0, EMPTY_WORKSPACE_RECENT_VAULT_DISPLAY_LIMIT);
}

export function SidebarEmptyWorkspacePanel({
  folderLabel,
  openFileLabel,
  openFolderLabel,
  recentVaults,
  onOpenFile,
  onOpenFolder,
  onOpenRecentVault,
}: SidebarEmptyWorkspacePanelProps) {
  const [activeRecentVaultHint, setActiveRecentVaultHint] = useState<ActiveRecentVaultHint | null>(null);

  const handleRowKeyDown = (event: KeyboardEvent<HTMLDivElement>, action: () => void) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    action();
  };

  const showRecentVaultHint = (vault: VaultInfo, element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const hasRoomBelow =
      window.innerHeight - rect.bottom >=
      themeSidebarTokens.recentVaultPathHintEstimatedHeightPx + themeSidebarTokens.recentVaultPathHintGapPx;

    setActiveRecentVaultHint({
      path: vault.path,
      left:
        rect.left +
        themeSidebarTokens.recentVaultPathHintTextLeftOffsetPx -
        themeSidebarTokens.recentVaultPathHintHorizontalPaddingPx,
      top: hasRoomBelow
        ? rect.bottom + themeSidebarTokens.recentVaultPathHintGapPx
        : rect.top -
          themeSidebarTokens.recentVaultPathHintEstimatedHeightPx -
          themeSidebarTokens.recentVaultPathHintGapPx,
      placement: hasRoomBelow ? 'bottom' : 'top',
    });
  };

  return (
    <div data-testid="empty-workspace-panel" className="pointer-events-auto flex w-full flex-col gap-3 px-1 py-3">
      <NotesSidebarPillEmptyHint
        actions={[
          { label: openFileLabel, onAction: onOpenFile },
          { label: openFolderLabel, onAction: onOpenFolder },
        ]}
      />
      {recentVaults.length > 0 ? (
        <div className="flex min-w-0 flex-col">
          {recentVaults.map((vault) => (
            <div
              key={vault.id}
              className="min-w-0"
              onMouseEnter={(event) => showRecentVaultHint(vault, event.currentTarget)}
              onMouseLeave={() => setActiveRecentVaultHint(null)}
              onFocus={(event) => showRecentVaultHint(vault, event.currentTarget)}
              onBlur={(event) => {
                const nextTarget = event.relatedTarget;
                if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
                  setActiveRecentVaultHint(null);
                }
              }}
            >
              <NotesSidebarRow
                role="button"
                tabIndex={0}
                leading={
                  <Icon
                    name="file.folderOpen"
                    size={themeIconTokens.sizeRow}
                    className="text-[var(--vlaina-sidebar-notes-folder-icon)] group-hover/sidebar-row:text-[var(--vlaina-sidebar-row-selected-text)] group-focus-within/sidebar-row:text-[var(--vlaina-sidebar-row-selected-text)]"
                  />
                }
                main={(
                  <span className={`block truncate ${getSidebarLabelClass('notes')}`}>
                    {vault.name || folderLabel}
                  </span>
                )}
                trailing={
                  <Icon
                    name="nav.chevronRight"
                    size="xs"
                    className={`${getSidebarSoftTextClass('notes')} group-hover/sidebar-row:text-[var(--vlaina-sidebar-row-selected-text)] group-focus-within/sidebar-row:text-[var(--vlaina-sidebar-row-selected-text)]`}
                  />
                }
                onClick={() => onOpenRecentVault(vault.path)}
                onKeyDown={(event) => handleRowKeyDown(event, () => onOpenRecentVault(vault.path))}
              />
            </div>
          ))}
        </div>
      ) : null}
      {activeRecentVaultHint
        ? createPortal(
            <div
              className="pointer-events-none fixed z-[var(--vlaina-z-max)]"
              data-recent-vault-path-hint={activeRecentVaultHint.placement}
              style={{
                left: activeRecentVaultHint.left,
                top: activeRecentVaultHint.top,
              }}
            >
              <span
                className={cn(
                  'inline-flex max-w-[var(--vlaina-size-300px)] items-center rounded-[var(--vlaina-radius-18px)] px-3 py-2 text-xs text-[var(--vlaina-sidebar-chat-text)]',
                  chatComposerPillSurfaceClass,
                )}
              >
                <span className="break-all">{activeRecentVaultHint.path}</span>
              </span>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
