import { Icon } from '@/components/ui/icons';
import { NoteIcon } from '@/components/Notes/features/IconPicker/NoteIcon';
import { useStarredEntryIcon } from '@/components/Notes/features/Starred/useStarredEntryIcon';
import { cn } from '@/lib/utils';
import type { StarredEntry } from '@/stores/notes/types';
import type { NoteMentionCandidate } from '../noteMentionHelpers';

interface NoteMentionPickerProps {
  currentPageCandidates: NoteMentionCandidate[];
  linkedPageCandidates: NoteMentionCandidate[];
  activeCandidatePath: string | null;
  status?: 'loading' | 'empty' | null;
  className?: string;
  onSelect: (candidate: NoteMentionCandidate) => void;
}

interface NoteMentionSectionProps {
  title: string;
  candidates: NoteMentionCandidate[];
  activeCandidatePath: string | null;
  onSelect: (candidate: NoteMentionCandidate) => void;
}

function NoteMentionCandidateIcon({ candidate }: { candidate: NoteMentionCandidate }) {
  if (candidate.icon) {
    return (
      <NoteIcon
        icon={candidate.icon}
        notePath={candidate.notePath ?? candidate.path}
        vaultPath={candidate.vaultPath}
        size={16}
      />
    );
  }

  if (candidate.starredEntry) {
    return <StarredNoteMentionIcon candidate={candidate} entry={candidate.starredEntry} />;
  }

  return <Icon name="file.text" size="sm" className="text-gray-400" />;
}

function StarredNoteMentionIcon({
  candidate,
  entry,
}: {
  candidate: NoteMentionCandidate;
  entry: StarredEntry;
}) {
  const starredIcon = useStarredEntryIcon(entry, true);

  if (!starredIcon) {
    return <Icon name="file.text" size="sm" className="text-gray-400" />;
  }

  return (
    <NoteIcon
      icon={starredIcon}
      notePath={candidate.notePath ?? candidate.path}
      vaultPath={candidate.vaultPath}
      size={16}
    />
  );
}

function NoteMentionSection({
  title,
  candidates,
  activeCandidatePath,
  onSelect,
}: NoteMentionSectionProps) {
  if (candidates.length === 0) {
    return null;
  }

  return (
    <div>
      <p className="px-2 pb-1 text-[11px] font-medium text-gray-500">{title}</p>
      <div className="space-y-0.5">
        {candidates.map((candidate) => {
          const isActive = candidate.path === activeCandidatePath;

          return (
            <button
              key={candidate.path}
              type="button"
              className={cn(
                'w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm',
                isActive
                  ? 'bg-gray-100 dark:bg-zinc-700 text-gray-900 dark:text-gray-100'
                  : 'hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-700 dark:text-gray-200'
              )}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onSelect(candidate)}
            >
              <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                <NoteMentionCandidateIcon candidate={candidate} />
              </span>
              <span className="truncate">{candidate.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function NoteMentionPicker({
  currentPageCandidates,
  linkedPageCandidates,
  activeCandidatePath,
  status,
  className,
  onSelect,
}: NoteMentionPickerProps) {
  const hasCandidates = currentPageCandidates.length > 0 || linkedPageCandidates.length > 0;

  return (
    <div
      className={cn(
        'absolute bottom-full mb-2 max-h-72 overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 shadow-xl dark:border-gray-700 dark:bg-[#1d1d1d] z-40',
        className ?? 'left-3 right-3',
      )}
      data-no-focus-input="true"
    >
      <div className="space-y-2">
        {hasCandidates ? (
          <>
            <NoteMentionSection
              title="Current page"
              candidates={currentPageCandidates}
              activeCandidatePath={activeCandidatePath}
              onSelect={onSelect}
            />
            <NoteMentionSection
              title="Link to page"
              candidates={linkedPageCandidates}
              activeCandidatePath={activeCandidatePath}
              onSelect={onSelect}
            />
          </>
        ) : (
          <p className="px-2 py-1.5 text-sm text-gray-500 dark:text-gray-400">
            {status === 'loading' ? 'Loading notes...' : 'No matching notes'}
          </p>
        )}
      </div>
    </div>
  );
}
