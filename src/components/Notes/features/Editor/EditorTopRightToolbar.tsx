import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Icon } from '@/components/ui/icons';
import { cn, iconButtonStyles } from '@/lib/utils';
import { NoteEditorFindBar, type NoteEditorFindController } from './find';

interface EditorTopRightToolbarProps {
  editorFind: NoteEditorFindController;
  currentNotePath: string | null | undefined;
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
  starred,
  toggleStarred,
  currentNoteMetadata,
  textStats,
}: EditorTopRightToolbarProps) {
  return (
    <div className="absolute top-3 right-3 z-30 flex items-start gap-2">
      <NoteEditorFindBar controller={editorFind} />

      {!editorFind.isOpen ? (
        <>
          <button
            onClick={(event) => {
              event.stopPropagation();
              if (currentNotePath) {
                toggleStarred(currentNotePath);
              }
            }}
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
