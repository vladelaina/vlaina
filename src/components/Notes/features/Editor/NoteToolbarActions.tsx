import { useCallback, useRef, useState } from 'react';
import { Icon } from '@/components/ui/icons';
import { chatComposerGhostIconButtonClass } from '@/components/Chat/features/Input/composerStyles';
import { cn } from '@/lib/utils';
import { getShortcutKeys } from '@/lib/shortcuts';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { useUIStore } from '@/stores/uiSlice';
import { useToastStore } from '@/stores/useToastStore';
import { flushCurrentPendingEditorMarkdown } from '@/stores/notes/pendingEditorMarkdownFlusher';
import { useI18n } from '@/lib/i18n';
import { normalizeUserFacingErrorMessage } from '@/lib/i18n/userFacingErrors';
import { canStarNotePath } from '@/stores/notes/notePathState';
import type { NoteExportFormat } from '../Export/noteExportTypes';
import { themeStyleResetTokens, themeUiFeedbackTokens } from '@/styles/themeTokens';
import { NoteToolbarMoreMenu } from './NoteToolbarMoreMenu';

export interface NoteToolbarActionsProps {
  currentNotePath: string | null | undefined;
  currentNoteTitle: string;
  getCurrentNoteContent: () => string;
  isSourceMode?: boolean;
  onToggleSourceMode?: () => void;
  notesPath: string;
  starred: boolean;
  toggleStarred: (path: string) => void;
  currentNoteMetadata:
    | {
        createdAt?: string | number | Date | null;
        updatedAt?: string | number | Date | null;
      }
    | undefined;
  className?: string;
  buttonClassName?: string;
  showStar?: boolean;
  showChat?: boolean;
  showMore?: boolean;
  forceShowChat?: boolean;
  onOpenChat?: () => void | Promise<void>;
}

export const noteToolbarIconButtonClassName = cn(
  'app-no-drag flex h-8 w-8 items-center justify-center',
  'cursor-pointer text-[var(--vlaina-text-tertiary)] disabled:cursor-default',
  chatComposerGhostIconButtonClass,
);

export function NoteToolbarActions({
  currentNotePath,
  currentNoteTitle,
  getCurrentNoteContent,
  isSourceMode = false,
  onToggleSourceMode,
  notesPath,
  starred,
  toggleStarred,
  currentNoteMetadata,
  className,
  buttonClassName,
  showStar = true,
  showChat = true,
  showMore = true,
  forceShowChat = false,
  onOpenChat,
}: NoteToolbarActionsProps) {
  const { t } = useI18n();
  const canToggleStar = canStarNotePath(currentNotePath, notesPath);
  const showStarButton = showStar && (starred || canToggleStar);
  const starButtonLabel = starred ? t('notes.removeFromStarred') : t('notes.addToStarred');
  const sourceModeButtonLabel = isSourceMode ? t('notes.switchToRenderedMode') : t('notes.switchToSourceMode');
  const sourceModeShortcutKeys = getShortcutKeys('toggleNoteSourceMode') ?? ['Ctrl', '/'];
  const moreButtonRef = useRef<HTMLButtonElement | null>(null);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const addToast = useToastStore((state) => state.addToast);
  const chatPanelCollapsed = useUIStore((state) => state.notesChatPanelCollapsed);
  const chatFloatingOpen = useUIStore((state) => state.notesChatFloatingOpen);
  const setNotesChatFloatingOpen = useUIStore((state) => state.setNotesChatFloatingOpen);
  const toolbarButtonClassName = cn(noteToolbarIconButtonClassName, buttonClassName);
  const showChatButton = showChat && (forceShowChat || (chatPanelCollapsed && !chatFloatingOpen));
  const exportCurrentNote = async (format: NoteExportFormat) => {
    if (!currentNotePath) {
      return;
    }

    try {
      flushCurrentPendingEditorMarkdown();
      const latestNote = useNotesStore.getState().currentNote;
      const { exportNote } = await import('../Export');
      await exportNote({
        format,
        markdown: latestNote?.path === currentNotePath ? latestNote.content : getCurrentNoteContent(),
        notePath: currentNotePath,
        notesPath,
        title: currentNoteTitle,
      });
    } catch (error) {
      addToast(normalizeUserFacingErrorMessage(error, 'notes.exportFailed'), 'error', themeUiFeedbackTokens.errorToastDurationMs);
    }
  };
  const handleSourceModeSelect = useCallback(() => {
    onToggleSourceMode?.();
    setMoreMenuOpen(false);
    moreButtonRef.current?.blur();
    window.requestAnimationFrame(() => {
      moreButtonRef.current?.blur();
    });
  }, [onToggleSourceMode]);

  const handleExportSelect = useCallback((format: NoteExportFormat) => {
    setMoreMenuOpen(false);
    void exportCurrentNote(format);
  }, [exportCurrentNote]);

  if (!showStarButton && !showChatButton && !showMore) {
    return null;
  }

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {showStarButton ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            if (currentNotePath && (starred || canStarNotePath(currentNotePath, notesPath))) {
              toggleStarred(currentNotePath);
            }
          }}
          aria-label={starButtonLabel}
          className={cn(
            toolbarButtonClassName,
            starred
              ? 'text-[var(--vlaina-color-favorite-fg)] hover:text-[var(--vlaina-color-favorite-fg)]'
              : 'hover:text-[var(--vlaina-color-favorite-fg)]',
          )}
        >
          <Icon
            size="md"
            name="misc.star"
            style={{ fill: starred ? themeStyleResetTokens.currentColor : themeStyleResetTokens.fillNone }}
          />
        </button>
      ) : null}

      {showChatButton ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            const openFloatingChat = () => {
              if (chatPanelCollapsed) {
                setNotesChatFloatingOpen(true);
              }
            };
            if (!onOpenChat) {
              openFloatingChat();
              return;
            }
            void Promise.resolve(onOpenChat?.())
              .then(
                openFloatingChat,
                openFloatingChat,
              );
          }}
          aria-label={t('notes.rightChat')}
          className={cn(
            toolbarButtonClassName,
            'hover:text-[var(--vlaina-accent)]',
          )}
        >
          <Icon size="md" name="common.shootingStar" />
        </button>
      ) : null}

      {showMore ? (
        <NoteToolbarMoreMenu
          buttonClassName={toolbarButtonClassName}
          currentNoteMetadata={currentNoteMetadata}
          currentNotePath={currentNotePath}
          moreButtonRef={moreButtonRef}
          onExportSelect={handleExportSelect}
          onOpenChange={setMoreMenuOpen}
          onSourceModeSelect={handleSourceModeSelect}
          open={moreMenuOpen}
          showSourceMode={Boolean(onToggleSourceMode)}
          sourceModeButtonLabel={sourceModeButtonLabel}
          sourceModeShortcutKeys={sourceModeShortcutKeys}
        />
      ) : null}
    </div>
  );
}
