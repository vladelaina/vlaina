import { useCallback } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Icon } from '@/components/ui/icons';
import { chatComposerGhostIconButtonClass } from '@/components/Chat/features/Input/composerStyles';
import { cn } from '@/lib/utils';
import { useNotesStore } from '@/stores/useNotesStore';
import { useUIStore } from '@/stores/uiSlice';
import { useToastStore } from '@/stores/useToastStore';
import { flushCurrentPendingEditorMarkdown } from '@/stores/notes/pendingEditorMarkdownFlusher';
import { useI18n } from '@/lib/i18n';
import { NoteEditorFindBar } from './find/NoteEditorFindBar';
import type { NoteEditorFindController } from './find/types';
import { useDeferredTextStats } from './hooks/useDeferredTextStats';
import { canStarNotePath } from '@/stores/notes/notePathState';
import type { NoteExportFormat } from '../Export/noteExportTypes';
import type { AppLanguage } from '@/lib/i18n/languages';
import { MENU_PANEL_CLASS_NAME } from '@/components/layout/sidebar/context-menu/shared';
import { themeStyleResetTokens, themeUiFeedbackTokens } from '@/styles/themeTokens';

export interface EditorTopRightToolbarProps {
  editorFind: NoteEditorFindController;
  currentNotePath: string | null | undefined;
  currentNoteTitle: string;
  getCurrentNoteContent: () => string;
  notesPath: string;
  starred: boolean;
  toggleStarred: (path: string) => void;
  currentNoteMetadata:
    | {
        createdAt?: string | number | Date | null;
        updatedAt?: string | number | Date | null;
      }
    | undefined;
}

function formatMetadataDate(value: string | number | Date | null | undefined, language: AppLanguage) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return new Intl.DateTimeFormat(language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

const exportMenuItemClassName =
  'text-[var(--vlaina-sidebar-notes-text)] transition-colors focus:bg-[var(--vlaina-sidebar-notes-row-active)] focus:text-[var(--vlaina-sidebar-row-selected-text)] data-[highlighted]:bg-[var(--vlaina-sidebar-notes-row-active)] data-[highlighted]:text-[var(--vlaina-sidebar-row-selected-text)] data-[state=open]:bg-[var(--vlaina-sidebar-notes-row-active)] data-[state=open]:text-[var(--vlaina-sidebar-row-selected-text)] [&>svg]:text-current';

const noteMenuSurfaceClassName = cn(
  'sidebar-menu-surface max-w-[var(--vlaina-width-viewport-minus-1rem)] backdrop-blur-[var(--vlaina-backdrop-blur-lg)]',
  MENU_PANEL_CLASS_NAME,
);

const toolbarIconButtonClassName = cn(
  'app-no-drag flex h-8 w-8 items-center justify-center',
  'cursor-pointer text-[var(--vlaina-text-tertiary)] disabled:cursor-default',
  chatComposerGhostIconButtonClass,
);

export function EditorTopRightToolbar({
  editorFind,
  currentNotePath,
  currentNoteTitle,
  getCurrentNoteContent,
  notesPath,
  starred,
  toggleStarred,
  currentNoteMetadata,
}: EditorTopRightToolbarProps) {
  const { language, t } = useI18n();
  const canToggleStar = canStarNotePath(currentNotePath, notesPath);
  const showStarButton = starred || canToggleStar;
  const starButtonLabel = starred ? t('notes.removeFromStarred') : t('notes.addToStarred');
  const addToast = useToastStore((state) => state.addToast);
  const chatPanelCollapsed = useUIStore((state) => state.notesChatPanelCollapsed);
  const setNotesChatPanelCollapsed = useUIStore((state) => state.setNotesChatPanelCollapsed);
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
      addToast(error instanceof Error ? error.message : t('notes.exportFailed'), 'error', themeUiFeedbackTokens.errorToastDurationMs);
    }
  };

  return (
    <div className="absolute top-0 right-3 z-[var(--vlaina-z-30)] flex items-start gap-2">
      <NoteEditorFindBar controller={editorFind} />

      {!editorFind.isOpen ? (
        <>
          {showStarButton ? (
            <button
              onClick={(event) => {
                event.stopPropagation();
                if (currentNotePath && (starred || canStarNotePath(currentNotePath, notesPath))) {
                  toggleStarred(currentNotePath);
                }
              }}
              aria-label={starButtonLabel}
              className={cn(
                toolbarIconButtonClassName,
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

          {chatPanelCollapsed ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setNotesChatPanelCollapsed(false);
              }}
              aria-label={t('notes.rightChat')}
              className={cn(
                toolbarIconButtonClassName,
                'hover:text-[var(--vlaina-accent)]',
              )}
            >
              <Icon size="md" name="common.shootingStar" />
            </button>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                onClick={(event) => event.stopPropagation()}
                className={cn(
                  toolbarIconButtonClassName,
                  'hover:text-[var(--vlaina-sidebar-row-selected-text)]',
                )}
              >
                <Icon size="md" name="common.more" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className={cn('w-max min-w-56', noteMenuSurfaceClassName)}>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className={exportMenuItemClassName}>
                  <Icon size="md" name="common.download" className="mr-2" />
                  {t('notes.export')}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className={cn('w-44', noteMenuSurfaceClassName)}>
                  <DropdownMenuItem
                    className={exportMenuItemClassName}
                    onSelect={() => void exportCurrentNote('docx')}
                  >
                    <Icon size="md" name="file.text" className="mr-2" />
                    Word (.docx)
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className={exportMenuItemClassName}
                    onSelect={() => void exportCurrentNote('pdf')}
                  >
                    <Icon size="md" name="file.text" className="mr-2" />
                    PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className={exportMenuItemClassName}
                    onSelect={() => void exportCurrentNote('png')}
                  >
                    <Icon size="md" name="file.image" className="mr-2" />
                    {t('notes.imageExport')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className={exportMenuItemClassName}
                    onSelect={() => void exportCurrentNote('html')}
                  >
                    <Icon size="md" name="file.public" className="mr-2" />
                    HTML
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <NoteStats currentNotePath={currentNotePath} />
              <DropdownMenuSeparator />
              <div className="grid grid-cols-[78px_max-content] gap-1 px-2 py-1.5 text-xs text-[var(--vlaina-sidebar-notes-text)]">
                <span className="font-medium">{t('notes.created')}</span>
                <span className="whitespace-nowrap">{formatMetadataDate(currentNoteMetadata?.createdAt, language)}</span>

                <span className="font-medium">{t('notes.updated')}</span>
                <span className="whitespace-nowrap">{formatMetadataDate(currentNoteMetadata?.updatedAt, language)}</span>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      ) : null}
    </div>
  );
}

function NoteStats({ currentNotePath }: { currentNotePath: string | null | undefined }) {
  const { t } = useI18n();
  const currentNoteContent = useNotesStore(
    useCallback((state) => {
      const currentNote = state.currentNote;
      if (!currentNote || currentNote.path !== currentNotePath) {
        return '';
      }
      return currentNote.content;
    }, [currentNotePath])
  );
  const textStats = useDeferredTextStats(currentNotePath, currentNoteContent);

  return (
    <div className="grid grid-cols-[78px_max-content] gap-1 px-2 py-1.5 text-xs text-[var(--vlaina-sidebar-notes-text)]">
      <span className="font-medium">{t('notes.lines')}</span>
      <span className="tabular-nums">{textStats.lineCount}</span>

      <span className="font-medium">{t('notes.words')}</span>
      <span className="tabular-nums">{textStats.wordCount}</span>

      <span className="font-medium">{t('notes.characters')}</span>
      <span className="tabular-nums">{textStats.characterCount}</span>
    </div>
  );
}
