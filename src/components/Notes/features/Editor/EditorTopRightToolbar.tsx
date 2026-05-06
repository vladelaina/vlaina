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
import { cn, iconButtonStyles } from '@/lib/utils';
import { useNotesStore } from '@/stores/useNotesStore';
import { useToastStore } from '@/stores/useToastStore';
import { flushCurrentPendingEditorMarkdown } from '@/stores/notes/pendingEditorMarkdownFlusher';
import { NoteEditorFindBar, type NoteEditorFindController } from './find';
import { canStarNotePath } from '@/stores/notes/notePathState';
import type { NoteExportFormat } from '../Export/noteExportTypes';

interface EditorTopRightToolbarProps {
  editorFind: NoteEditorFindController;
  currentNotePath: string | null | undefined;
  currentNoteContent: string;
  currentNoteTitle: string;
  notesPath: string;
  starred: boolean;
  toggleStarred: (path: string) => void;
  currentNoteMetadata:
    | {
        createdAt?: string | number | Date | null;
        updatedAt?: string | number | Date | null;
      }
    | undefined;
  textStats: {
    lineCount: number;
    wordCount: number;
    characterCount: number;
  };
}

function formatMetadataDate(value: string | number | Date | null | undefined) {
  return value ? new Date(value).toLocaleString() : '-';
}

export function EditorTopRightToolbar({
  editorFind,
  currentNotePath,
  currentNoteContent,
  currentNoteTitle,
  notesPath,
  starred,
  toggleStarred,
  currentNoteMetadata,
  textStats,
}: EditorTopRightToolbarProps) {
  const canToggleStar = canStarNotePath(currentNotePath, notesPath);
  const showStarButton = starred || canToggleStar;
  const starButtonLabel = starred ? 'Remove from Starred' : 'Add to Starred';
  const addToast = useToastStore((state) => state.addToast);
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
        markdown: latestNote?.path === currentNotePath ? latestNote.content : currentNoteContent,
        notePath: currentNotePath,
        notesPath,
        title: currentNoteTitle,
      });
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Failed to export note.', 'error', 4500);
    }
  };

  return (
    <div className="absolute top-3 right-3 z-30 flex items-start gap-2">
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
                'p-1.5 transition-colors',
                starred ? 'text-yellow-500' : `${iconButtonStyles} hover:text-yellow-500`,
              )}
            >
              <Icon
                size="md"
                name="misc.star"
                style={{ fill: starred ? 'currentColor' : 'none' }}
              />
            </button>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                onClick={(event) => event.stopPropagation()}
                className={cn('p-1.5 transition-colors', iconButtonStyles)}
              >
                <Icon size="md" name="common.more" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Icon size="md" name="common.download" className="mr-2" />
                  Export
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-44">
                  <DropdownMenuItem onSelect={() => void exportCurrentNote('docx')}>
                    <Icon size="md" name="file.text" className="mr-2" />
                    Word (.docx)
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void exportCurrentNote('pdf')}>
                    <Icon size="md" name="file.text" className="mr-2" />
                    PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void exportCurrentNote('png')}>
                    <Icon size="md" name="file.image" className="mr-2" />
                    Image (.png)
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void exportCurrentNote('html')}>
                    <Icon size="md" name="file.public" className="mr-2" />
                    HTML
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <div className="grid grid-cols-[78px_1fr] gap-1 px-2 py-1.5 text-xs text-muted-foreground">
                <span className="font-medium">Lines:</span>
                <span className="tabular-nums">{textStats.lineCount}</span>

                <span className="font-medium">Words:</span>
                <span className="tabular-nums">{textStats.wordCount}</span>

                <span className="font-medium">Characters:</span>
                <span className="tabular-nums">{textStats.characterCount}</span>
              </div>
              <DropdownMenuSeparator />
              <div className="grid grid-cols-[78px_1fr] gap-1 px-2 py-1.5 text-xs text-muted-foreground">
                <span className="font-medium">Created:</span>
                <span>{formatMetadataDate(currentNoteMetadata?.createdAt)}</span>

                <span className="font-medium">Updated:</span>
                <span>{formatMetadataDate(currentNoteMetadata?.updatedAt)}</span>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      ) : null}
    </div>
  );
}
